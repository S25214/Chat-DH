/**
 * McpClient
 * Handles connection to a single MCP server via SSE.
 */
class McpClient {
    constructor(url) {
        this.url = url;
        this.eventSource = null;
        this.sessionId = null;
        this.postEndpoint = null;
        this.tools = [];
        this.isConnected = false;
        this.status = 'disconnected'; // disconnected, connecting, connected, error
    }

    async connect() {
        this.status = 'connecting';
        console.log(`[MCP] Connecting to ${this.url}...`);

        return new Promise((resolve, reject) => {
            try {
                this.eventSource = new EventSource(this.url);

                this.eventSource.onopen = () => {
                    console.log(`[MCP] SSE Connected to ${this.url}`);
                };

                this.eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log(`[MCP] Received event from ${this.url}:`, data);

                        if (data.method === 'initialize') { // Some servers might send this, but usually we get endpoint from 'endpoint' event
                            // standard MCP might differ slightly in handshake depending on transport
                        }
                    } catch (e) {
                        console.error(`[MCP] Error parsing event from ${this.url}`, e);
                    }
                };

                // Listen for specific events if the server sends them for easy configuration
                // Standard MCP over SSE: Client opens connection. Server sends 'endpoint' event with the URI for POST requests.
                this.eventSource.addEventListener('endpoint', (event) => {
                    const endpoint = event.data; // Relative or absolute URL

                    // Resolve relative URL against the SSE URL
                    try {
                        this.postEndpoint = new URL(endpoint, this.url).toString();
                        console.log(`[MCP] POST Endpoint discovered: ${this.postEndpoint}`);

                        this.status = 'connected';
                        this.isConnected = true;

                        // Once connected, initialize header
                        this.initialize().then(() => {
                            resolve();
                        }).catch(reject);

                    } catch (e) {
                        console.error("[MCP] Invalid endpoint URL", e);
                        reject(e);
                    }
                });

                this.eventSource.onerror = (err) => {
                    console.error(`[MCP] Connection error with ${this.url}`, err);
                    this.status = 'error';
                    this.isConnected = false;
                    // If we haven't resolved yet, reject
                    if (this.status === 'connecting') {
                        reject(new Error('SSE Connection Failed'));
                    }
                };

            } catch (e) {
                this.status = 'error';
                reject(e);
            }
        });
    }

    async postRequest(payload) {
        if (!this.postEndpoint) {
            throw new Error('MCP Client not fully connected (missing POST endpoint)');
        }

        // Add session ID if available (from a previous handshake? MCP spec might vary on session management via SSE)
        // Usually jsonrpc 2.0

        const response = await fetch(this.postEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`MCP POST Request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async initialize() {
        // MCP JSON-RPC Initialize
        const response = await this.postRequest({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
                protocolVersion: "0.1.0", // Adjust based on spec
                capabilities: {
                    roots: { listChanged: false },
                    sampling: {}
                },
                clientInfo: {
                    name: "chatbot-client",
                    version: "1.0.0"
                }
            },
            id: 1
        });

        console.log("[MCP] Initialize response:", response);

        // After initialize, send 'notifications/initialized'
        await this.postRequest({
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {}
        });

        // Now fetch tools
        await this.refreshTools();
    }

    async refreshTools() {
        try {
            const response = await this.postRequest({
                jsonrpc: "2.0",
                method: "tools/list",
                params: {},
                id: 2
            });

            if (response.result && response.result.tools) {
                this.tools = response.result.tools;
                console.log(`[MCP] Discovered ${this.tools.length} tools from ${this.url}`);
            }
        } catch (e) {
            console.error(`[MCP] Failed to list tools from ${this.url}`, e);
        }
    }

    async callTool(toolName, args) {
        // Send tools/call
        const response = await this.postRequest({
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            },
            id: Date.now()
        });

        if (response.error) {
            throw new Error(`Tool execution error: ${response.error.message}`);
        }

        return response.result;
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.isConnected = false;
        this.status = 'disconnected';
    }

    getGeminiTools() {
        // Convert MCP tools to Gemini Function Declarations
        return this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema // MCP schema is usually JSON Schema, which matches Gemini
        }));
    }
}
