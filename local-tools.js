/**
 * LocalToolsClient
 * Mimics an McpClient but executes tools locally in the browser.
 */
class LocalToolsClient {
    constructor() {
        this.url = "local://browser-tools";
        this.isConnected = true; // Always connected
        this.status = 'connected';

        this.tools = [
            {
                name: "get_current_time_only",
                description: "Get ONLY the current time (e.g., '2:30 PM'). Use when the user asks 'What time is it?'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        timezone: {
                            type: "string",
                            description: "IANA timezone identifier. Defaults to local."
                        },
                        locale: {
                            type: "string",
                            description: "Locale identifier (e.g., 'en-US', 'th-TH'). Defaults to browser's locale."
                        }
                    }
                }
            },
            {
                name: "get_current_date_only",
                description: "Get ONLY the current date (e.g., 'Monday, January 1, 2024'). Use when the user asks 'What day is it?'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        timezone: {
                            type: "string",
                            description: "IANA timezone identifier. Defaults to local."
                        },
                        locale: {
                            type: "string",
                            description: "Locale identifier (e.g., 'en-US', 'th-TH'). Defaults to browser's locale."
                        }
                    }
                }
            },
            {
                name: "get_current_datetime",
                description: "Get the full current date and time. Use for 'What is the date and time?'.",
                inputSchema: {
                    type: "object",
                    properties: {
                        timezone: {
                            type: "string",
                            description: "IANA timezone identifier. Defaults to local."
                        },
                        locale: {
                            type: "string",
                            description: "Locale identifier (e.g., 'en-US', 'th-TH'). Defaults to browser's locale."
                        }
                    }
                }
            },
            {
                name: "get_relative_time",
                description: "Calculate the relative time from now to a specific date (e.g. 'in 2 days', '5 minutes ago').",
                inputSchema: {
                    type: "object",
                    properties: {
                        date: {
                            type: "string",
                            description: "Target date string (ISO format or understandable date string)"
                        }
                    },
                    required: ["date"]
                }
            }
        ];
    }

    async connect() {
        console.log("[Local Tools] Initialized");
        return Promise.resolve();
    }

    async refreshTools() {
        return Promise.resolve(this.tools);
    }

    getGeminiTools() {
        return this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }));
    }

    async callTool(toolName, args) {
        console.log(`[Local Tools] Executing ${toolName}`, args);

        try {
            if (toolName === "get_current_time_only" || toolName === "get_current_date_only" || toolName === "get_current_datetime") {
                const now = new Date();
                const timeZone = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

                let options = { timeZone };

                if (toolName === "get_current_time_only") {
                    options = {
                        ...options,
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    };
                } else if (toolName === "get_current_date_only") {
                    options = {
                        ...options,
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    };
                } else {
                    // DateTime
                    options = {
                        ...options,
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    };
                }

                const formatter = new Intl.DateTimeFormat('en-US', options);
                const infoType = toolName.replace('get_current_', ''); // 'time_only', 'date_only', 'datetime'

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                [infoType]: formatter.format(now),
                                timezone: timeZone
                            })
                        }
                    ]
                };
            }

            if (toolName === "get_relative_time") {
                const target = new Date(args.date);
                if (isNaN(target.getTime())) {
                    throw new Error("Invalid date format");
                }
                const now = new Date();
                const diffMs = target - now;
                const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

                const diffSeconds = Math.round(diffMs / 1000);
                const diffMinutes = Math.round(diffSeconds / 60);
                const diffHours = Math.round(diffMinutes / 60);
                const diffDays = Math.round(diffHours / 24);

                let relativeText = "";
                if (Math.abs(diffDays) > 0) relativeText = rtf.format(diffDays, 'day');
                else if (Math.abs(diffHours) > 0) relativeText = rtf.format(diffHours, 'hour');
                else if (Math.abs(diffMinutes) > 0) relativeText = rtf.format(diffMinutes, 'minute');
                else relativeText = rtf.format(diffSeconds, 'second');

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                target: target.toISOString(),
                                relative: relativeText,
                                diff_milliseconds: diffMs
                            })
                        }
                    ]
                };
            }

            throw new Error(`Tool ${toolName} not implemented locally.`);

        } catch (e) {
            console.error(`[Local Tools] Error executing ${toolName}`, e);
            throw e;
        }
    }

    disconnect() {
        // No-op
    }
}

// Attach to window for Manager to find
window.LocalToolsClient = LocalToolsClient;
