/**
 * McpManager
 * Manages multiple McpClient instances.
 */
class McpManager {
    constructor() {
        this.clients = new Map(); // url -> McpClient
    }

    /**
     * Reconciles connected clients with the provided list of URLs.
     * Connects new ones, disconnects removed ones.
     */
    async updateServers(serverUrls) {
        const currentUrls = new Set(this.clients.keys());
        const newUrls = new Set(serverUrls);

        // Disconnect removed
        for (const url of currentUrls) {
            if (!newUrls.has(url)) {
                console.log(`[MCP Manager] Removing server: ${url}`);
                const client = this.clients.get(url);
                client.disconnect();
                this.clients.delete(url);
            }
        }

        // Connect new
        for (const url of newUrls) {
            if (!currentUrls.has(url)) {
                console.log(`[MCP Manager] Adding server: ${url}`);
                const client = new McpClient(url);
                this.clients.set(url, client);
                // Fire and forget connection, individual errors shouldn't block others
                client.connect().catch(e => console.error(`[MCP Manager] Failed to connect to ${url}`, e));
            }
        }
    }

    getAllTools() {
        let allTools = [];
        for (const client of this.clients.values()) {
            if (client.isConnected) {
                allTools = [...allTools, ...client.getGeminiTools()];
            }
        }
        return allTools;
    }

    async executeTool(toolName, args) {
        // Find which client has this tool
        for (const client of this.clients.values()) {
            if (client.isConnected) {
                const tool = client.tools.find(t => t.name === toolName);
                if (tool) {
                    console.log(`[MCP Manager] Executing ${toolName} on ${client.url}`);
                    return await client.callTool(toolName, args);
                }
            }
        }
        throw new Error(`Tool ${toolName} not found on any connected MCP server.`);
    }
}

// Singleton
window.mcpManager = new McpManager();
