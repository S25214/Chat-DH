/**
 * StorageManager - Handles persistence to localStorage
 */
const SEED_BOTS = [
    {
        "id": "1768884292533",
        "name": "Cherry",
        "instruction": "Your name is Cherry. You are a teenage female friend. You will rarely respond with questions. You will respond in the same language that the user use. Do not use emojis.",
        "avatar": "X"
    }
];

const SEED_CHATS = {};

class StorageManager {
    constructor() {
        this.BOTS_KEY = 'chatbot_bots';
        this.CHATS_KEY = 'chatbot_chats';
        this.CHATS_KEY = 'chatbot_chats';
        this.SETTINGS_KEY = 'chatbot_settings';
        this.MCP_SERVERS_KEY = 'chatbot_mcp_servers';

        this.init();
    }

    init() {
        // Initialize Bots
        if (!localStorage.getItem(this.BOTS_KEY)) {
            localStorage.setItem(this.BOTS_KEY, JSON.stringify(SEED_BOTS));
        }

        // Initialize Chats
        if (!localStorage.getItem(this.CHATS_KEY)) {
            localStorage.setItem(this.CHATS_KEY, JSON.stringify(SEED_CHATS));
        }
    }

    // --- Bots ---

    getBots() {
        return JSON.parse(localStorage.getItem(this.BOTS_KEY) || '[]');
    }

    saveBot(botData) {
        const bots = this.getBots();
        const { id, name, instruction, avatar } = botData;

        let newId = id;
        if (id) {
            const index = bots.findIndex(b => b.id === id);
            if (index !== -1) {
                bots[index] = { id, name, instruction, avatar };
            } else {
                bots.push({ id, name, instruction, avatar });
            }
        } else {
            newId = Date.now().toString();
            bots.push({ id: newId, name, instruction, avatar });
        }

        localStorage.setItem(this.BOTS_KEY, JSON.stringify(bots));
        return { success: true, id: newId };
    }

    deleteBot(id) {
        let bots = this.getBots();
        bots = bots.filter(b => b.id !== id);
        localStorage.setItem(this.BOTS_KEY, JSON.stringify(bots));

        // Also delete history
        this.clearHistory(id);

        return { success: true };
    }

    // --- History ---

    getAllChats() {
        return JSON.parse(localStorage.getItem(this.CHATS_KEY) || '{}');
    }

    getHistory(botId) {
        const chats = this.getAllChats();
        return chats[botId] || [];
    }

    saveHistory(botId, history) {
        const chats = this.getAllChats();
        chats[botId] = history;
        localStorage.setItem(this.CHATS_KEY, JSON.stringify(chats));
    }

    appendMessage(botId, role, content, parts = null) {
        const history = this.getHistory(botId);
        const message = {
            role,
            content,
            timestamp: Date.now()
        };
        if (parts) {
            message.parts = parts;
        }
        history.push(message);
        this.saveHistory(botId, history);
        return history;
    }

    clearHistory(botId) {
        const chats = this.getAllChats();
        if (chats[botId]) {
            delete chats[botId];
            localStorage.setItem(this.CHATS_KEY, JSON.stringify(chats));
        }
        return { success: true };
    }


    // --- MCP Servers ---

    getMcpServers() {
        const data = JSON.parse(localStorage.getItem(this.MCP_SERVERS_KEY) || '[]');
        // Migration: Convert strings to objects if necessary
        return data.map(item => {
            if (typeof item === 'string') {
                return { url: item, useProxy: false };
            }
            return item;
        });
    }

    saveMcpServers(servers) {
        localStorage.setItem(this.MCP_SERVERS_KEY, JSON.stringify(servers));
    }

    // --- Settings (Helpers for cleaner access, though direct localStorage was used in script.js) ---
    // We can keep using direct localStorage in script.js for settings to minimize refactor, 
    // or wrap it here. Let's wrap it for consistency.

    getSettings() {
        return {
            apiKey: localStorage.getItem('gemini_api_key') || '',
            modelName: localStorage.getItem('gemini_model_name') || 'gemini-1.5-flash',
            dhStreamId: localStorage.getItem('dh_stream_id') || '',
            ttsUrl: localStorage.getItem('tts_url') || '',
            ttsToken: localStorage.getItem('tts_token') || '',
            ttsParams: localStorage.getItem('tts_params') || '{}'
        };
    }

    saveSettings(settings) {
        if (settings.apiKey !== undefined) localStorage.setItem('gemini_api_key', settings.apiKey);
        if (settings.modelName !== undefined) localStorage.setItem('gemini_model_name', settings.modelName);
        if (settings.dhStreamId !== undefined) localStorage.setItem('dh_stream_id', settings.dhStreamId);
        if (settings.ttsUrl !== undefined) localStorage.setItem('tts_url', settings.ttsUrl);
        if (settings.ttsToken !== undefined) localStorage.setItem('tts_token', settings.ttsToken);
        if (settings.ttsParams !== undefined) localStorage.setItem('tts_params', settings.ttsParams);
    }
}

// Export a singleton instance
window.storageManager = new StorageManager();
