/**
 * McpClient
 * Wrapper around the window.MCP SDK.
 */
class McpClient {
    constructor(url, useProxy = false) {
        this.url = url;
        this.useProxy = useProxy;
        this.client = null;
        this.transport = null;
        this.tools = [];
        this.isConnected = false;
        this.status = 'disconnected';
    }

    async connect() {
        this.status = 'connecting';
        console.log(`[MCP Wrapper] Connecting to ${this.url} via SDK...`);

        try {
            // Initialize Transport
            this.transport = new window.MCP.SSEClientTransport(this.url, {
                useProxy: this.useProxy
            });

            // Initialize Client
            this.client = new window.MCP.Client(
                {
                    name: "chatbot-client",
                    version: "1.0.0"
                },
                {
                    capabilities: {
                        roots: { listChanged: false },
                        sampling: {}
                    }
                }
            );

            // Connect
            await this.client.connect(this.transport);

            this.status = 'connected';
            this.isConnected = true;
            console.log(`[MCP Wrapper] Connected to ${this.url}`);

            // Fetch Tools
            await this.refreshTools();

        } catch (e) {
            console.error(`[MCP Wrapper] Connection failed`, e);
            this.status = 'error';
            this.isConnected = false;
            throw e;
        }
    }

    async refreshTools() {
        if (!this.client) return;
        try {
            const result = await this.client.listTools();
            if (result && result.tools) {
                this.tools = result.tools;
                console.groupCollapsed(`[MCP] Discovered ${this.tools.length} tools`);
                this.tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));
                console.groupEnd();
            }
        } catch (e) {
            console.error("[MCP Wrapper] Failed to list tools", e);
        }
    }

    async callTool(toolName, args) {
        if (!this.client) throw new Error("MCP Client not connected");

        console.log(`[MCP Wrapper] Calling tool ${toolName}`, args);
        const result = await this.client.callTool(toolName, args);

        // MCP results are often { content: [ { type: 'text', text: '...' } ] }
        // We might want to unwrap this for the LLM or UI, but for now returning raw result is safest.
        return result;
    }

    disconnect() {
        if (this.client) {
            this.client.close();
        }
        this.isConnected = false;
        this.status = 'disconnected';
        console.log(`[MCP Wrapper] Disconnected`);
    }

    getGeminiTools() {
        return this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: this.sanitizeSchema(tool.inputSchema)
        }));
    }

    /**
     * Recursively sanitizes JSON Schema to be compatible with Gemini's OpenAPI subset.
     * Removes 'const', 'default', 'additionalProperties' and ensures types.
     */
    sanitizeSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            return schema;
        }

        // Clone to avoid mutating original
        const clean = { ...schema };

        // Gemini doesn't support 'const' in schema properties
        // Re-map it to enum with single value if strictness is needed,
        // or just ignore if it's metadata. 
        // Strategy: Remove it. We rely on the description or handled logic.
        if ('const' in clean) {
            delete clean.const;
        }

        // Gemini Function Declarations don't support 'default' 
        if ('default' in clean) {
            delete clean.default;
        }

        // Gemini often dislikes 'additionalProperties'
        if ('additionalProperties' in clean) {
            delete clean.additionalProperties;
        }

        // Recursively clean properties
        if (clean.properties) {
            const newProps = {};
            for (const key in clean.properties) {
                newProps[key] = this.sanitizeSchema(clean.properties[key]);
            }
            clean.properties = newProps;
        }

        // Recursively clean array items
        if (clean.items) {
            clean.items = this.sanitizeSchema(clean.items);
        }

        // Handling 'anyOf', 'allOf', 'oneOf' if present (recurse)
        ['anyOf', 'allOf', 'oneOf'].forEach(key => {
            if (clean[key] && Array.isArray(clean[key])) {
                clean[key] = clean[key].map(getItem => this.sanitizeSchema(getItem));
            }
        });

        return clean;
    }
}
