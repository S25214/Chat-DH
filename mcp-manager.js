/**
 * McpManager
 * Manages multiple McpClient instances.
 */
class McpManager {
    constructor() {
        this.clients = new Map(); // url -> McpClient

        // Initialize Local Tools
        if (window.LocalToolsClient) {
            const localClient = new window.LocalToolsClient();
            this.clients.set('local://browser-tools', localClient);
            localClient.connect().catch(e => console.error("Failed to connect local tools", e));
        }
    }

    /**
     * Reconciles connected clients with the provided list of URLs.
     * Connects new ones, disconnects removed ones.
     */
    async updateServers(serverConfigs) {
        // Map configs by URL to check for existence
        const newConfigs = new Map(serverConfigs.map(c => [c.url, c]));
        const currentUrls = new Set(this.clients.keys());

        // Disconnect removed or changed
        for (const url of currentUrls) {
            // Skip local tools
            if (url === 'local://browser-tools') continue;

            const client = this.clients.get(url);
            const newConfig = newConfigs.get(url);

            if (!newConfig || client.useProxy !== newConfig.useProxy) {
                console.log(`[MCP Manager] Removing server (Config changed or removed): ${url}`);
                client.disconnect();
                this.clients.delete(url);
            }
        }

        // Connect new or update
        for (const [url, config] of newConfigs.entries()) {
            if (!currentUrls.has(url)) {
                console.log(`[MCP Manager] Adding server: ${url} (Proxy: ${config.useProxy})`);
                const client = new McpClient(url, config.useProxy);
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
