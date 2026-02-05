document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        bots: [],
        currentBotId: null,
        apiKey: localStorage.getItem('gemini_api_key') || '',
        modelName: localStorage.getItem('gemini_model_name') || 'gemini-2.5-flash-lite',
        dhStreamId: localStorage.getItem('dh_stream_id') || '',
        ttsUrl: localStorage.getItem('tts_url') || '',
        ttsToken: localStorage.getItem('tts_token') || '',
        ttsUrl: localStorage.getItem('tts_url') || '',
        ttsToken: localStorage.getItem('tts_token') || '',
        ttsParams: localStorage.getItem('tts_params') || '{}',
        isDhConnected: false,
        mcpServers: []
    };

    // Elements
    const botListEl = document.getElementById('bot-list');
    const chatAreaEl = document.getElementById('chat-area');
    const emptyStateEl = document.getElementById('empty-state');
    const chatInterfaceEl = document.getElementById('chat-interface');
    const messagesContainerEl = document.getElementById('messages-container');
    const messageInputEl = document.getElementById('message-input');
    const sendBtnEl = document.getElementById('send-btn');
    const currentBotAvatarEl = document.getElementById('current-bot-avatar');
    const currentBotNameEl = document.getElementById('current-bot-name');
    const mobileBackBtn = document.getElementById('mobile-back-btn');

    // Buttons
    const createBotBtn = document.getElementById('create-bot-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const editBotBtn = document.getElementById('edit-bot-btn');
    const deleteBotBtn = document.getElementById('delete-bot-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const saveBotBtn = document.getElementById('save-bot-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const dhConnectBtn = document.getElementById('dh-connect-btn');

    // Modals
    const botModal = document.getElementById('bot-modal');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');

    const mcpUrlInputEl = document.getElementById('mcp-url-input');
    const mcpProxyCheckEl = document.getElementById('mcp-proxy-check');
    const addMcpBtn = document.getElementById('add-mcp-btn');
    const mcpServerListEl = document.getElementById('mcp-server-list');

    // -- Initialization --
    loadBots();
    loadMcpServers(); // Initialize MCP

    if (state.apiKey) document.getElementById('api-key-input').value = state.apiKey;
    if (state.modelName) document.getElementById('model-name-input').value = state.modelName;
    if (state.dhStreamId) document.getElementById('dh-stream-id').value = state.dhStreamId;
    if (state.ttsUrl) document.getElementById('tts-url').value = state.ttsUrl;
    if (state.ttsToken) document.getElementById('tts-token').value = state.ttsToken;
    if (state.ttsParams) document.getElementById('tts-params').value = state.ttsParams;

    if (!state.apiKey) {
        openModal(settingsModal);
    }

    if (!state.apiKey) {
        openModal(settingsModal);
    }

    // -- Event Listeners --

    // Mobile Back Button
    if (mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            toggleMobileChat(false);
            // Optional: clear selection if you want them to re-select
            // state.currentBotId = null; 
            // renderBotList();
        });
    }

    // Modal controls
    createBotBtn.addEventListener('click', () => {
        resetBotForm();
        document.getElementById('modal-title').innerText = 'Create New Bot';
        openModal(botModal);
    });

    settingsBtn.addEventListener('click', () => {
        // Re-render list to ensure it's up to date
        renderMcpList();
        openModal(settingsModal);
    });

    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal-overlay'));
        });
    });

    // Save Bot
    saveBotBtn.addEventListener('click', () => {
        const id = document.getElementById('bot-id').value;
        const name = document.getElementById('bot-name').value;
        const instruction = document.getElementById('bot-instruction').value;
        const avatar = document.getElementById('bot-avatar').value || '🤖';

        if (!name) return alert('Available Name required');

        const payload = { id: id || null, name, instruction, avatar };

        try {
            const result = window.storageManager.saveBot(payload);
            const savedId = result.id;

            closeModal(botModal);
            loadBots();

            if (state.currentBotId === savedId) {
                updateChatHeader(payload);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save bot');
        }
    });

    // Save Settings
    saveSettingsBtn.addEventListener('click', () => {
        const key = document.getElementById('api-key-input').value.trim();
        const model = document.getElementById('model-name-input').value.trim() || 'gemini-2.5-flash-lite';
        const streamId = document.getElementById('dh-stream-id').value.trim();
        const ttsUrl = document.getElementById('tts-url').value.trim();
        const ttsToken = document.getElementById('tts-token').value.trim();
        const ttsParams = document.getElementById('tts-params').value.trim();

        // Validate JSON
        try {
            if (ttsParams) JSON.parse(ttsParams);
        } catch (e) {
            alert('Invalid JSON in TTS Custom Params');
            return;
        }

        if (key) {
            const settings = {
                apiKey: key,
                modelName: model,
                dhStreamId: streamId,
                ttsUrl: ttsUrl,
                ttsToken: ttsToken,
                ttsParams: ttsParams
            };

            // Update state
            state.apiKey = key;
            state.modelName = model;
            state.dhStreamId = streamId;
            state.ttsUrl = ttsUrl;
            state.ttsToken = ttsToken;
            state.ttsParams = ttsParams;

            // Save to storage
            window.storageManager.saveSettings(settings);

            closeModal(settingsModal);
        } else {
            alert('Please enter a valid API Key');
        }
    });

    // Digital Human Connect/Disconnect
    dhConnectBtn.addEventListener('click', () => {
        if (state.isDhConnected) {
            // Disconnect
            if (window.DigitalHuman && window.DigitalHuman.disconnect) {
                window.DigitalHuman.disconnect();
            }
            state.isDhConnected = false;
            updateDhButtonState();
        } else {
            // Connect
            if (!state.dhStreamId) {
                alert('Please set Digital Human Stream ID in Settings first.');
                openModal(settingsModal);
                return;
            }
            if (window.DigitalHuman && window.DigitalHuman.init) {
                window.DigitalHuman.init(state.dhStreamId, { autoUnmute: false, showUI: false, lookAt: true, camera: { x: 0, y: -15, z: 120 }, microphone: false });
                state.isDhConnected = true;
                updateDhButtonState();
            } else {
                alert('Digital Human script not loaded.');
            }
        }
    });

    // Chat Controls
    editBotBtn.addEventListener('click', () => {
        const bot = state.bots.find(b => b.id === state.currentBotId);
        if (bot) {
            document.getElementById('bot-id').value = bot.id;
            document.getElementById('bot-name').value = bot.name;
            document.getElementById('bot-instruction').value = bot.instruction;
            document.getElementById('bot-avatar').value = bot.avatar;
            document.getElementById('modal-title').innerText = 'Edit Bot';
            openModal(botModal);
        }
    });

    deleteBotBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this bot and its history?')) {
            window.storageManager.deleteBot(state.currentBotId);
            state.currentBotId = null;
            showEmptyState();
            loadBots();
        }
    });

    clearChatBtn.addEventListener('click', () => {
        if (confirm('Clear chat history?')) {
            window.storageManager.clearHistory(state.currentBotId);
            messagesContainerEl.innerHTML = '';
        }
    });

    // Sending Messages
    sendBtnEl.addEventListener('click', sendMessage);
    messageInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // -- MCP Settings UI Events --
    addMcpBtn.addEventListener('click', () => {
        const url = mcpUrlInputEl.value.trim();
        const useProxy = mcpProxyCheckEl.checked;

        if (url) {
            // Check for duplicates (by URL)
            if (!state.mcpServers.some(s => s.url === url)) {
                state.mcpServers.push({ url, useProxy });
                window.storageManager.saveMcpServers(state.mcpServers);
                window.mcpManager.updateServers(state.mcpServers);
                renderMcpList();
                mcpUrlInputEl.value = '';
                mcpProxyCheckEl.checked = false;
            } else {
                alert('Server already added.');
            }
        }
    });


    // -- Functions --

    function openModal(modal) {
        modal.classList.remove('hidden');
    }

    function closeModal(modal) {
        modal.classList.add('hidden');
    }

    function resetBotForm() {
        document.getElementById('bot-id').value = '';
        document.getElementById('bot-name').value = '';
        document.getElementById('bot-instruction').value = '';
        document.getElementById('bot-avatar').value = '';
    }

    function loadBots() {
        state.bots = window.storageManager.getBots();
        renderBotList();
    }

    function renderBotList() {
        botListEl.innerHTML = '';
        state.bots.forEach(bot => {
            const el = document.createElement('div');
            el.className = `bot-item ${bot.id === state.currentBotId ? 'active' : ''}`;
            el.innerHTML = `
                <div class="bot-avatar">${bot.avatar}</div>
                <div class="bot-info">
                    <h4>${bot.name}</h4>
                    <p>${bot.instruction.substring(0, 30)}...</p>
                </div>
            `;
            el.addEventListener('click', () => selectBot(bot));
            botListEl.appendChild(el);
        });
    }

    function selectBot(bot) {
        state.currentBotId = bot.id;
        renderBotList(); // update active class

        emptyStateEl.classList.add('hidden');
        chatInterfaceEl.classList.remove('hidden');
        updateChatHeader(bot);

        loadHistory(bot.id);
        toggleMobileChat(true);
    }

    function updateChatHeader(bot) {
        currentBotNameEl.innerText = bot.name;
        currentBotAvatarEl.innerText = bot.avatar;
    }

    function showEmptyState() {
        emptyStateEl.classList.remove('hidden');
        chatInterfaceEl.classList.add('hidden');
    }

    function loadHistory(botId) {
        messagesContainerEl.innerHTML = ''; // clear previous
        const history = window.storageManager.getHistory(botId);
        history.forEach(msg => appendMessageUI(msg));
        scrollToBottom();
    }

    async function sendMessage() {
        const content = messageInputEl.value.trim();
        if (!content || !state.currentBotId) return;

        if (!state.apiKey) {
            alert('Please set your Gemini API Key in Settings.');
            openModal(settingsModal);
            return;
        }

        // Add user message immediately
        const userMsg = { role: 'user', content, timestamp: Date.now() };
        appendMessageUI(userMsg);
        window.storageManager.appendMessage(state.currentBotId, 'user', content);

        messageInputEl.value = '';
        scrollToBottom();

        // Add loading state
        const loadingId = 'loading-' + Date.now();
        const loadingMsg = { role: 'bot', content: '<i class="fa-solid fa-spinner fa-spin"></i> Typing...', id: loadingId };
        appendMessageUI(loadingMsg);
        scrollToBottom();

        try {
            // Get Bot/History for context
            const bot = state.bots.find(b => b.id === state.currentBotId);
            const history = window.storageManager.getHistory(state.currentBotId);

            // Prepare context for Gemini
            // The history from storage ALREADY includes the new user message we just added.

            const apiHistory = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // Note: Gemini API treats the last item in contents as the prompt.

            const responseText = await callGeminiAPI(state.apiKey, state.modelName, bot.instruction, apiHistory);

            // Remove loading
            document.getElementById(loadingId).remove();

            // Save and Display Bot Response
            window.storageManager.appendMessage(state.currentBotId, 'bot', responseText);
            appendMessageUI({ role: 'bot', content: responseText });

            // Send TTS if connected
            if (state.isDhConnected && state.ttsUrl) {
                if (window.DigitalHuman && window.DigitalHuman.sendJob) {
                    let params = {};
                    try {
                        params = state.ttsParams ? JSON.parse(state.ttsParams) : {};
                    } catch (e) {
                        console.error("Failed to parse TTS Params", e);
                    }
                    window.DigitalHuman.sendJob(responseText, state.ttsUrl, state.ttsToken, params);
                }
            }

        } catch (err) {
            document.getElementById(loadingId).remove();
            appendMessageUI({ role: 'bot', content: `**Error:** ${err.message}` });
            console.error(err);
        }
        scrollToBottom();
    }

    async function callGeminiAPI(apiKey, modelName, systemInstruction, history) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // Prepare Tools
        const mcpTools = window.mcpManager.getAllTools();
        let tools = [];
        if (mcpTools.length > 0) {
            tools = [{ function_declarations: mcpTools }];
        }

        let currentHistory = [...history];
        let keepGoing = true;
        let finalResponseText = '';

        // Max turns to prevent infinite loops
        let turnCount = 0;
        const MAX_TURNS = 5;

        while (keepGoing && turnCount < MAX_TURNS) {
            turnCount++;

            const payload = {
                contents: currentHistory,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                }
            };

            if (tools.length > 0) {
                payload.tools = tools;
                // Auto-calling is default but can be explicit
                // payload.tool_config = { function_calling_config: { mode: "AUTO" } };
            }

            console.log("Calling Gemini API", payload);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Gemini API Error');
            }

            if (!data.candidates || data.candidates.length === 0) {
                return "No response from Gemini.";
            }

            const candidate = data.candidates[0];
            const content = candidate.content;
            const parts = content.parts || [];

            // Add assistant response to history
            currentHistory.push({
                role: 'model',
                parts: parts
            });

            // Check for function calls
            const functionCalls = parts.filter(p => p.functionCall);

            if (functionCalls.length > 0) {
                console.group(`[LLM] 🤖 Tool Execution Group`);

                const functionResponses = [];

                for (const call of functionCalls) {
                    const fc = call.functionCall;
                    try {
                        console.log(`%c🛠️ Calling Tool: ${fc.name}`, 'color: #2979FF; font-weight: bold;', fc.args);
                        const result = await window.mcpManager.executeTool(fc.name, fc.args);

                        console.log(`%c✅ Result for ${fc.name}:`, 'color: #00C853;', result);

                        // Unpack MCP result for Gemini
                        // MCP tools often return { content: [ { type: 'text', text: 'JSON_STRING' } ] }
                        // We want to pass the parsed JSON to Gemini if possible.
                        let responseContent = result;

                        if (result && result.content && Array.isArray(result.content)) {
                            // Filter for text content
                            const textContent = result.content
                                .filter(item => item.type === 'text')
                                .map(item => item.text)
                                .join('\n');

                            if (textContent) {
                                try {
                                    // Try to parse as JSON if it looks like it
                                    if (textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
                                        responseContent = JSON.parse(textContent);
                                    } else {
                                        responseContent = { result: textContent };
                                    }
                                } catch (e) {
                                    responseContent = { result: textContent };
                                }
                            }
                        }

                        functionResponses.push({
                            functionResponse: {
                                name: fc.name,
                                response: { name: fc.name, content: responseContent }
                            }
                        });
                    } catch (e) {
                        console.error(`Tool execution failed for ${fc.name}`, e);
                        functionResponses.push({
                            functionResponse: {
                                name: fc.name,
                                response: { name: fc.name, content: { error: e.message } }
                            }
                        });
                    }
                }

                console.groupEnd(); // End Tool Usage Group

                // Add function responses to history
                currentHistory.push({
                    role: 'function',
                    parts: functionResponses
                });

                // Loop continues to get the model's interpretation of results
                keepGoing = true;

            } else {
                // No function calls, just text
                // Combine text parts
                const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
                finalResponseText = textParts;
                keepGoing = false;
            }
        }

        return finalResponseText || "Finished tool execution.";
    }

    function loadMcpServers() {
        state.mcpServers = window.storageManager.getMcpServers();
        renderMcpList();
        // Trigger connection
        window.mcpManager.updateServers(state.mcpServers);
    }

    function renderMcpList() {
        if (!mcpServerListEl) return;
        mcpServerListEl.innerHTML = '';
        state.mcpServers.forEach((server, index) => {
            const el = document.createElement('div');
            el.className = 'mcp-server-item';
            el.innerHTML = `
                <div style="overflow:hidden; display:flex; flex-direction:column;">
                    <span title="${server.url}">${server.url}</span>
                    ${server.useProxy ? '<small style="color:var(--primary-color); font-size:0.75rem;">via Proxy</small>' : ''}
                </div>
                <button type="button" class="remove-mcp-btn" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
            `;
            mcpServerListEl.appendChild(el);
        });

        // Bind remove buttons
        document.querySelectorAll('.remove-mcp-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                state.mcpServers.splice(idx, 1);
                window.storageManager.saveMcpServers(state.mcpServers);
                window.mcpManager.updateServers(state.mcpServers);
                renderMcpList();
            });
        });
    }

    function appendMessageUI(msg) {
        // Determine role class
        const isUser = msg.role === 'user';
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        if (msg.id) msgDiv.id = msg.id;

        const avatar = isUser ? '<i class="fa-solid fa-user"></i>' : (state.bots.find(b => b.id === state.currentBotId)?.avatar || '🤖');

        // Render Markdown for bot messages content
        // Ensure marked is available
        const contentHtml = (isUser || !window.marked) ? msg.content : window.marked.parse(msg.content);

        msgDiv.innerHTML = `
            <div class="bot-avatar">${avatar}</div>
            <div class="message-content">${contentHtml}</div>
        `;

        messagesContainerEl.appendChild(msgDiv);
    }

    function scrollToBottom() {
        messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
    }

    function updateDhButtonState() {
        if (state.isDhConnected) {
            dhConnectBtn.innerHTML = '<i class="fa-solid fa-power-off"></i> DH';
            dhConnectBtn.className = 'danger-btn';
        } else {
            dhConnectBtn.innerHTML = '<i class="fa-solid fa-headset"></i> DH';
            dhConnectBtn.className = 'secondary-btn';
        }
    }
    function toggleMobileChat(showChat) {
        if (showChat) {
            document.body.classList.add('mobile-chat-active');
            if (mobileBackBtn) mobileBackBtn.classList.remove('hidden');
        } else {
            document.body.classList.remove('mobile-chat-active');
            if (mobileBackBtn) mobileBackBtn.classList.add('hidden');
        }
    }
});
