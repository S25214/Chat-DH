/**
 * MCP SDK Shim for Browser
 * Mimics @modelcontextprotocol/sdk architecture
 */

(function (window) {
    // --- Types & Constants ---
    const JSONRPC_VERSION = "2.0";

    class JSONRPCError extends Error {
        constructor(code, message, data) {
            super(message);
            this.code = code;
            this.data = data;
        }
    }

    // --- Transport Layer ---

    /**
     * SSEClientTransport
     * Uses fetch + ReadableStream to support custom headers and proxies.
     */
    class SSEClientTransport {
        constructor(url, options = {}) {
            this.url = new URL(url);
            this.options = options; // { useProxy: boolean, proxyUrl: string } (optional custom proxy)
            this.abortController = null;
            this._onOpen = null;
            this._onClose = null;
            this._onError = null;
            this._onMessage = null;
            this.postEndpoint = null;
        }

        /**
         * Callbacks setters
         */
        set onopen(cb) { this._onOpen = cb; }
        set onclose(cb) { this._onClose = cb; }
        set onerror(cb) { this._onError = cb; }
        set onmessage(cb) { this._onMessage = cb; }

        getProxyUrl(targetUrl) {
            // Default proxy logic as per user's previous preference, or allow override
            if (this.options.useProxy) {
                return `https://cors.didthat.workers.dev/?${targetUrl}`;
            }
            return targetUrl;
        }

        async start(initialMessage = null) {
            if (this.abortController) {
                throw new Error("Transport already started");
            }

            this.abortController = new AbortController();
            const connectionUrl = this.getProxyUrl(this.url.toString());

            console.log(`[MCP Transport] Connecting to ${connectionUrl}`);

            const headers = {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            };

            let method = 'GET';
            let body = undefined;

            if (initialMessage) {
                method = 'POST';
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(initialMessage);
                console.log("[MCP Transport] Performing POST handshake", initialMessage);
            }

            try {
                const response = await fetch(connectionUrl, {
                    method,
                    headers,
                    body,
                    signal: this.abortController.signal
                });

                console.log(`[MCP Transport] Response received: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
                }

                if (!response.body) {
                    throw new Error("ReadableStream not supported");
                }

                // Inspect headers for session ID if available (from Inspector logs)
                const sessionId = response.headers.get('mcp-session-id');
                if (sessionId) {
                    this.sessionId = sessionId;
                    console.log(`[MCP Transport] Session ID: ${this.sessionId}`);
                }

                // We are "connected"
                if (this._onOpen) this._onOpen();

                // If we sent an initial message, we assume the response stream might contain the result.
                // We also assume the endpoint for future POSTs is the same URL unless 'endpoint' event says otherwise.
                if (initialMessage && !this.postEndpoint) {
                    this.postEndpoint = this.url.toString(); // Default to same URL for Streamable HTTP
                }

                // Don't await this, let it run in background
                this._processStream(response.body, this.abortController.signal).catch(e => {
                    if (this._onError) this._onError(e);
                });

            } catch (e) {
                if (this._onError) this._onError(e);
                throw e;
            }
        }

        async _processStream(readableStream, signal) {
            const reader = readableStream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    if (signal && signal.aborted) break;
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || '';

                    let eventType = 'message';
                    let dataBuffer = [];

                    for (const line of lines) {
                        if (line.trim() === '') {
                            if (dataBuffer.length > 0) {
                                this.handleEvent(eventType, dataBuffer.join('\n'));
                            }
                            eventType = 'message';
                            dataBuffer = [];
                        } else if (line.startsWith('event:')) {
                            eventType = line.substring(6).trim();
                        } else if (line.startsWith('data:')) {
                            dataBuffer.push(line.substring(5).trim());
                        }
                    }
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    throw e;
                }
            } finally {
                // We don't necessarily want to trigger onClose here for temporary streams (like POST responses)
                // Only trigger onClose if this was the MAIN stream?
                // For now, we'll leave onClose management to the start() method or close() method logic if needed.
                // But the original readStream called _onClose. Let's be careful.
            }
        }

        handleEvent(type, data) {
            if (type === 'endpoint') {
                const endpointUri = data.trim();
                // If endpointUri is relative, resolve it against the ORIGINAL url, not the proxy
                this.postEndpoint = new URL(endpointUri, this.url).toString();
                console.log(`[MCP Transport] Endpoint discovered: ${this.postEndpoint}`);
                return;
            }

            if (type === 'message') {
                try {
                    const json = JSON.parse(data);
                    if (this._onMessage) this._onMessage(json);
                } catch (e) {
                    console.error("[MCP Transport] Failed to parse message", e);
                }
            }
        }

        async send(message) {
            if (!this.postEndpoint) {
                throw new Error("Not connected: No POST endpoint discovered yet.");
            }

            const targetUrl = this.getProxyUrl(this.postEndpoint);
            const headers = { 'Content-Type': 'application/json' };

            if (this.sessionId) {
                headers['mcp-session-id'] = this.sessionId;
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`Message send failed: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('text/event-stream')) {
                // Handle SSE response fro POST
                console.log("[MCP Transport] POST response is Stream, processing...");
                await this._processStream(response.body, null);
            } else {
                // Handle standard JSON/Text response
                // Note: MCP over SSE usually expects the response to the POST to be accepted,
                // but the actual result comes back over the SSE stream (unless it's an error).
                // Some implementations might return the result purely in the body? 
                // The official spec says: "The server MUST respond with a 200 OK or 202 Accepted... The response body... MAY contain the JSON-RPC response..."
                // For safety, we check if there's a JSON body and emit it as a message too, just in case.

                const text = await response.text();
                if (text) {
                    try {
                        const json = JSON.parse(text);
                        // If it looks like a JSON-RPC response/notification, treat it as incoming
                        if (json.jsonrpc === '2.0') {
                            if (this._onMessage) this._onMessage(json);
                        }
                    } catch (e) {
                        // Ignore non-JSON responses to POST
                    }
                }
            }
        }

        close() {
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
            }
        }
    }

    // --- Client Layer ---

    class Client {
        constructor(clientInfo, options = {}) {
            this.clientInfo = clientInfo; // { name, version }
            this.capabilities = options.capabilities || {};
            this.transport = null;
            this._pendingRequests = new Map(); // id -> { resolve, reject }
            this._requestCounter = 0;
            this._notificationHandlers = new Map(); // method -> handler
            this._requestHandlers = new Map(); // method -> handler
        }

        async connect(transport) {
            this.transport = transport;

            // Wire up listeners
            transport.onclose = () => {
                // Fail pending requests
                for (const { reject } of this._pendingRequests.values()) {
                    reject(new Error("Transport closed"));
                }
                this._pendingRequests.clear();
            };

            transport.onerror = (e) => {
                console.error("[MCP Client] Transport error", e);
            };

            transport.onmessage = (message) => {
                this.handleMessage(message);
            };

            // Prepare Initialize Message
            const initMsg = {
                jsonrpc: JSONRPC_VERSION,
                id: this._requestCounter++,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05", // Spec version
                    capabilities: this.capabilities,
                    clientInfo: this.clientInfo
                }
            };

            // Register pending request for initialize logic
            // We expect the result to come back via the stream (transport.onmessage)
            const initPromise = new Promise((resolve, reject) => {
                this._pendingRequests.set(initMsg.id, { resolve, reject });
                // Timeout
                setTimeout(() => {
                    if (this._pendingRequests.has(initMsg.id)) {
                        this._pendingRequests.get(initMsg.id).reject(new Error("Initialize validation timed out"));
                        this._pendingRequests.delete(initMsg.id);
                    }
                }, 10000);
            });

            // Start Transport WITH the initialize message
            await transport.start(initMsg);

            // Wait for result
            const result = await initPromise;
            console.log("[MCP Client] Initialized", result);

            // Send initialized notification
            await this.notification({
                method: "notifications/initialized"
            });
        }

        async waitForEndpoint() {
            // Simple polling for the transport to get the endpoint
            // In a better implementation this would be event driven
            let retries = 20;
            while (!this.transport.postEndpoint && retries > 0) {
                await new Promise(r => setTimeout(r, 200));
                retries--;
            }
            if (!this.transport.postEndpoint) {
                throw new Error("Timed out waiting for MCP endpoint discovery via SSE");
            }
        }

        async request(req, options = {}) {
            const id = this._requestCounter++;
            const msg = {
                jsonrpc: JSONRPC_VERSION,
                id: id,
                method: req.method,
                params: req.params
            };

            return new Promise(async (resolve, reject) => {
                this._pendingRequests.set(id, { resolve, reject });

                // Set timeout
                const timeout = options.timeout || 10000;
                const timer = setTimeout(() => {
                    if (this._pendingRequests.has(id)) {
                        this._pendingRequests.get(id).reject(new Error("Request timed out"));
                        this._pendingRequests.delete(id);
                    }
                }, timeout);

                try {
                    await this.transport.send(msg);
                } catch (e) {
                    clearTimeout(timer);
                    this._pendingRequests.delete(id);
                    reject(e);
                }
            });
        }

        async notification(req) {
            const msg = {
                jsonrpc: JSONRPC_VERSION,
                method: req.method,
                params: req.params
            };
            await this.transport.send(msg);
        }

        handleMessage(msg) {
            // Response
            if (msg.id !== undefined && (msg.result || msg.error)) {
                const handler = this._pendingRequests.get(msg.id);
                if (handler) {
                    if (msg.error) {
                        handler.reject(new JSONRPCError(msg.error.code, msg.error.message, msg.error.data));
                    } else {
                        handler.resolve(msg.result);
                    }
                    this._pendingRequests.delete(msg.id);
                }
                return;
            }

            // Request (from server)
            if (msg.method && msg.id !== undefined) {
                // Not implemented: Server calling client tools
                // We should send a MethodNotFound error or handle it
                console.warn("[MCP Client] Received request from server (not fully implemented):", msg);
                // Implementation: look in _requestHandlers, execute, send result back with msg.id
                return;
            }

            // Notification
            if (msg.method && msg.id === undefined) {
                const handler = this._notificationHandlers.get(msg.method);
                if (handler) {
                    handler(msg.params);
                }
                return;
            }
        }

        async callTool(name, args) {
            const result = await this.request({
                method: "tools/call",
                params: {
                    name,
                    arguments: args
                }
            });
            return result;
        }

        async listTools() {
            const result = await this.request({
                method: "tools/list",
                params: {}
            });
            return result;
        }

        close() {
            if (this.transport) {
                this.transport.close();
            }
        }
    }

    // Expose to window
    window.MCP = {
        Client,
        SSEClientTransport
    };

})(window);
