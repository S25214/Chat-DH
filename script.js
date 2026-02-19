document.addEventListener('DOMContentLoaded', () => {
    // Process URL Settings and override localStorage if present
    const processUrlSettings = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const settingsKeys = [
            'gemini_api_key',
            'gemini_model_name',
            'dh_stream_id',
            'tts_url',
            'tts_token',
            'tts_params',
            'web_avatar_model',
            'chatbot_mcp_servers'
        ];

        settingsKeys.forEach(key => {
            if (urlParams.has(key)) {
                console.log(`[Settings] Updating ${key} from URL parameter`);
                localStorage.setItem(key, urlParams.get(key));
            }
        });
    };
    processUrlSettings();
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
        webAvatarModel: localStorage.getItem('web_avatar_model') || 'Kitagawa',
        isDhConnected: false,
        isWaConnected: false,
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
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');


    // Buttons
    const createBotBtn = document.getElementById('create-bot-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const editBotBtn = document.getElementById('edit-bot-btn');
    const deleteBotBtn = document.getElementById('delete-bot-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const saveBotBtn = document.getElementById('save-bot-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const dhConnectBtn = document.getElementById('dh-connect-btn');
    const waConnectBtn = document.getElementById('wa-connect-btn');

    // Modals
    const botModal = document.getElementById('bot-modal');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');

    const mcpUrlInputEl = document.getElementById('mcp-url-input');

    const addMcpBtn = document.getElementById('add-mcp-btn');
    const mcpServerListEl = document.getElementById('mcp-server-list');
    const waModelInputEl = document.getElementById('wa-model-input');

    // -- Initialization --
    loadBots();
    loadMcpServers(); // Initialize MCP

    if (state.apiKey) document.getElementById('api-key-input').value = state.apiKey;
    if (state.modelName) document.getElementById('model-name-input').value = state.modelName;
    if (state.dhStreamId) document.getElementById('dh-stream-id').value = state.dhStreamId;
    if (state.ttsUrl) document.getElementById('tts-url').value = state.ttsUrl;
    if (state.ttsToken) document.getElementById('tts-token').value = state.ttsToken;
    if (state.ttsParams) document.getElementById('tts-params').value = state.ttsParams;

    // Initialize WA Model dropdown
    if (state.webAvatarModel && waModelInputEl) {
        // Create option if it doesn't exist yet, to ensure value is set
        // Real population happens later via populateWAModels
        const opt = document.createElement('option');
        opt.value = state.webAvatarModel;
        opt.innerText = state.webAvatarModel;
        // waModelInputEl.appendChild(opt); // actually better to wait for populate or just set value
        waModelInputEl.value = state.webAvatarModel;
    }

    if (state.ttsParams) document.getElementById('tts-params').value = state.ttsParams;

    // -- Marked Configuration --
    if (window.marked && window.hljs) {
        window.marked.setOptions({
            highlight: function (code, lang) {
                const language = window.hljs.getLanguage(lang) ? lang : 'plaintext';
                return window.hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-'
        });
    }

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

    // Sidebar Toggle
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('collapsed');
        });
    }


    settingsBtn.addEventListener('click', () => {
        // Re-render list to ensure it's up to date
        renderMcpList();
        populateWAModels();
        // Set current value
        if (state.webAvatarModel && waModelInputEl) {
            waModelInputEl.value = state.webAvatarModel;
        }
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
        const waModel = document.getElementById('wa-model-input').value;

        // Validate JSON
        try {
            if (ttsParams) JSON.parse(ttsParams);
        } catch (e) {
            alert('Invalid JSON in TTS Custom Params');
            return;
        }

        const settings = {
            apiKey: key,
            modelName: model,
            dhStreamId: streamId,
            ttsUrl: ttsUrl,
            ttsToken: ttsToken,
            ttsParams: ttsParams,
            webAvatarModel: waModel
        };

        // Update state
        state.apiKey = key;
        state.modelName = model;
        state.dhStreamId = streamId;
        state.ttsUrl = ttsUrl;
        state.ttsToken = ttsToken;
        state.ttsParams = ttsParams;
        state.webAvatarModel = waModel;

        // Save to storage
        window.storageManager.saveSettings(settings);

        closeModal(settingsModal);
    });

    // Share Settings
    document.getElementById('share-settings-btn').addEventListener('click', () => {
        const key = document.getElementById('api-key-input').value.trim();
        const model = document.getElementById('model-name-input').value.trim();
        const streamId = document.getElementById('dh-stream-id').value.trim();
        const ttsUrl = document.getElementById('tts-url').value.trim();
        const ttsToken = document.getElementById('tts-token').value.trim();
        const ttsParams = document.getElementById('tts-params').value.trim();
        const waModel = document.getElementById('wa-model-input').value;

        // Collect MCP Servers
        const mcpServers = window.storageManager.getMcpServers(); // Use source of truth or collect from UI if improved

        const params = new URLSearchParams();
        if (key) params.append('gemini_api_key', key);
        if (model) params.append('gemini_model_name', model);
        if (streamId) params.append('dh_stream_id', streamId);
        if (ttsUrl) params.append('tts_url', ttsUrl);
        if (ttsToken) params.append('tts_token', ttsToken);
        if (ttsParams) params.append('tts_params', ttsParams);
        if (waModel) params.append('web_avatar_model', waModel);
        if (mcpServers && mcpServers.length > 0) params.append('chatbot_mcp_servers', JSON.stringify(mcpServers));

        const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            const originalText = document.getElementById('share-settings-btn').innerHTML;
            document.getElementById('share-settings-btn').innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                document.getElementById('share-settings-btn').innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy URL to clipboard');
        });
    });

    // Digital Human Connect/Disconnect
    dhConnectBtn.addEventListener('click', () => {
        if (state.isDhConnected) {
            // Disconnect
            if (window.DigitalHuman && window.DigitalHuman.disconnect) {
                window.DigitalHuman.disconnect();
            }
            state.isDhConnected = false;
            updateConnectionButtons();
        } else {
            // Connect
            if (!state.dhStreamId) {
                alert('Please set Digital Human Stream ID in Settings first.');
                openModal(settingsModal);
                return;
            }
            if (window.DigitalHuman && window.DigitalHuman.init) {
                window.DigitalHuman.init(state.dhStreamId, {
                    showUI: false,
                    lookAt: true,
                    camera: { x: 0, y: -15, z: 120 },
                    microphone: false
                });
                state.isDhConnected = true;
                updateConnectionButtons();
            } else {
                alert('Digital Human script not loaded.');
            }
        }
    });

    // Web Avatar Connect/Disconnect
    waConnectBtn.addEventListener('click', () => {
        if (state.isWaConnected) {
            // Disconnect
            if (window.WebAvatar && window.WebAvatar.disconnect) {
                window.WebAvatar.disconnect();
            }
            state.isWaConnected = false;
            updateConnectionButtons();
        } else {
            // Connect
            if (window.WebAvatar && window.WebAvatar.init) {
                window.WebAvatar.init({
                    modelUrl: state.webAvatarModel || 'Kitagawa',
                    position: 'bottom-center',
                    offset: { x: 0, y: 20 },
                });
                state.isWaConnected = true;
                updateConnectionButtons();
            } else {
                alert('Web Avatar script not loaded.');
            }
        }
    });

    function updateConnectionButtons() {
        // Reset both to visible first
        dhConnectBtn.classList.remove('hidden');
        waConnectBtn.classList.remove('hidden');

        // If DH is connected
        if (state.isDhConnected) {
            dhConnectBtn.classList.add('active');
            dhConnectBtn.classList.add('danger-btn');
            dhConnectBtn.classList.remove('secondary-btn');
            dhConnectBtn.innerHTML = '<i class="fa-solid fa-headset"></i> Disconnect';

            // Hide WA button
            waConnectBtn.classList.add('hidden');
        } else {
            dhConnectBtn.classList.remove('active');
            dhConnectBtn.classList.remove('danger-btn');
            dhConnectBtn.classList.add('secondary-btn');
            dhConnectBtn.innerHTML = '<i class="fa-solid fa-headset"></i> DH';
        }

        // If WA is connected
        if (state.isWaConnected) {
            waConnectBtn.classList.add('active');
            waConnectBtn.classList.add('danger-btn');
            waConnectBtn.classList.remove('secondary-btn');
            waConnectBtn.innerHTML = '<i class="fa-solid fa-user-astronaut"></i> Disconnect';

            // Hide DH button
            dhConnectBtn.classList.add('hidden');
        } else {
            waConnectBtn.classList.remove('active');
            waConnectBtn.classList.remove('danger-btn');
            waConnectBtn.classList.add('secondary-btn');
            waConnectBtn.innerHTML = '<i class="fa-solid fa-user-astronaut"></i> Avatar';
        }
    }

    // Helper for DH button state (Legacy ref for existing calls, can be removed if not used elsewhere)
    function updateDhButtonState() {
        updateConnectionButtons();
    }

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

    // Auto-expand input
    messageInputEl.addEventListener('input', () => {
        messageInputEl.style.height = 'auto';
        messageInputEl.style.height = (messageInputEl.scrollHeight) + 'px';
    });

    // -- MCP Settings UI Events --
    addMcpBtn.addEventListener('click', () => {
        const url = mcpUrlInputEl.value.trim();
        const useProxy = true;

        if (url) {
            // Check for duplicates (by URL)
            if (!state.mcpServers.some(s => s.url === url)) {
                state.mcpServers.push({ url, useProxy });
                window.storageManager.saveMcpServers(state.mcpServers);
                window.mcpManager.updateServers(state.mcpServers);
                renderMcpList();
                mcpUrlInputEl.value = '';

            } else {
                alert('Server already added.');
            }
        }
    });



    async function populateWAModels() {
        if (!window.WebAvatar || !window.WebAvatar.getModels) return;

        try {
            const models = await window.WebAvatar.getModels();
            if (models && Array.isArray(models)) {
                waModelInputEl.innerHTML = '';
                models.forEach(model => {
                    const opt = document.createElement('option');
                    opt.value = model;
                    opt.innerText = model;
                    waModelInputEl.appendChild(opt);
                });


                // Restore selection
                if (state.webAvatarModel) {
                    waModelInputEl.value = state.webAvatarModel;
                }
            }
        } catch (e) {
            console.error("Failed to fetch WebAvatar models", e);
        }
    }

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
        const groupedHistory = groupMessages(history);
        groupedHistory.forEach(msg => appendMessageUI(msg));
        scrollToBottom();
    }

    // Helper: Group consecutive bot/model/function messages into a single UI turn
    function groupMessages(history) {
        const grouped = [];
        let currentGroup = null;

        history.forEach(msg => {
            if (msg.role === 'user') {
                if (currentGroup) {
                    grouped.push(currentGroup);
                    currentGroup = null;
                }
                grouped.push(msg);
            } else {
                // Role is model (bot) or function
                if (!currentGroup) {
                    currentGroup = {
                        role: 'bot', // UI role
                        content: '',
                        timestamp: msg.timestamp,
                        parts: []
                    };
                }

                // Merge content/parts
                if (msg.parts) {
                    currentGroup.parts = currentGroup.parts.concat(msg.parts);
                }
                // If there's direct content (unlikely mixed with parts in storage, but possible)
                if (msg.content) {
                    // If it's the final text response, it might be in content or parts
                    // We'll treat it as a text part for UI rendering consistency
                    currentGroup.parts.push({ text: msg.content });
                }
            }
        });

        if (currentGroup) {
            grouped.push(currentGroup);
        }

        return grouped;
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
        messageInputEl.style.height = 'auto'; // Reset height
        scrollToBottom();

        // Prepare combined bot message immediately
        const botMsgId = 'bot-' + Date.now();
        const botDisplayMsg = {
            role: 'bot',
            content: '',
            id: botMsgId,
            parts: [],
            isThinking: true
        };
        appendMessageUI(botDisplayMsg);
        scrollToBottom();

        try {
            // Get Bot/History for context
            const bot = state.bots.find(b => b.id === state.currentBotId);
            const history = window.storageManager.getHistory(state.currentBotId);

            const apiHistory = history.map(msg => {
                if (msg.parts) {
                    return { role: msg.role === 'user' ? 'user' : (msg.role === 'function' ? 'function' : 'model'), parts: msg.parts };
                }
                return {
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                };
            });

            // Callback for live updates
            const onUpdate = (newPart) => {
                // Remove thinking state visually if we have real content
                botDisplayMsg.isThinking = false;
                botDisplayMsg.parts.push(newPart);

                // Re-render the specific message
                const msgEl = document.getElementById(botMsgId);
                if (msgEl) {
                    // Re-use logic from appendMessageUI but just get the specific content
                    const contentHtml = renderMessageContent(botDisplayMsg);
                    const contentEl = msgEl.querySelector('.message-content');
                    if (contentEl) {
                        contentEl.innerHTML = contentHtml;
                        // Post-process highlight
                        contentEl.querySelectorAll('pre code').forEach(block => {
                            if (window.hljs) window.hljs.highlightElement(block);
                        });
                        addCopyButtons(msgEl);
                    }
                    scrollToBottom();
                }
            };

            const responseText = await callGeminiAPI(state.apiKey, state.modelName, bot.instruction, apiHistory, onUpdate);

            // Final save (The individual parts were saved inside callGeminiAPI, but we save the final text response here)
            window.storageManager.appendMessage(state.currentBotId, 'bot', responseText);

            // Final UI update
            onUpdate({ text: responseText });

            // Send TTS if connected to DH
            if (state.isDhConnected && state.ttsUrl) {
                if (window.DigitalHuman && window.DigitalHuman.sendJob) {
                    try {
                        params = state.ttsParams ? JSON.parse(state.ttsParams) : {};
                    } catch (e) {
                        console.error("Failed to parse TTS Params", e);
                    }

                    // Sanitize text for TTS
                    let ttsText = responseText;
                    // Replace code blocks
                    ttsText = ttsText.replace(/```[\s\S]*?```/g, "code block");
                    // Replace links
                    ttsText = ttsText.replace(/https?:\/\/[^\s)]+/g, "link");

                    window.DigitalHuman.sendJob(ttsText, state.ttsUrl, state.ttsToken, params);
                }
            }

            // Send TTS if connected to WA
            if (state.isWaConnected) {
                // For now, we reuse the configured TTS URL if available to get an audio URL/Base64
                // BUT WebAvatar.playAudio expects a SOURCE (URL or Base64). 
                // DigitalHuman.sendJob sends a "job" to a TTS API which might return audio or play it elsewhere.
                // If the user's TTS endpoint (like ElevenLabs) returns audio, we might need to fetch it here ourselves.

                // Assumption: existing `ttsUrl` might NOT be directly compatible without a fetcher.
                // However, the requirement says "only webavatar or dh can be loaded".

                // Let's try to use the same TTS URL if it returns audio. 
                // Many TTS APIs require a POST request and return audio.
                // `window.WebAvatar.playAudio(source)` needs the actual audio data/url.

                if (state.ttsUrl) {
                    try {
                        const ttsHeaders = { 'Content-Type': 'application/json' };
                        if (state.ttsToken) {
                            ttsHeaders['Authorization'] = state.ttsToken;
                        }

                        // Parse custom params
                        let params = {};
                        try {
                            params = state.ttsParams ? JSON.parse(state.ttsParams) : {};
                        } catch (e) { }

                        // Construct payload - generic structure, might need adjustment for specific providers (ElevenLabs, OpenAI, etc)
                        // This is a best-effort implementation assuming a standard Text-to-Speech contract or adapting 
                        // logic similar to what the DH widget likely expects.

                        // Sanitize text for TTS
                        let ttsText = responseText;
                        // Replace code blocks
                        ttsText = ttsText.replace(/```[\s\S]*?```/g, "code block");
                        // Replace links
                        ttsText = ttsText.replace(/https?:\/\/[^\s)]+/g, "link");

                        const ttsPayload = {
                            text: ttsText,
                            ...params
                        };

                        console.log("Fetching TTS for Web Avatar...", state.ttsUrl);

                        // We do the fetch here because WebAvatar needs the source
                        const ttsResponse = await fetch(state.ttsUrl, {
                            method: 'POST',
                            headers: ttsHeaders,
                            body: JSON.stringify(ttsPayload)
                        });

                        if (ttsResponse.ok) {
                            const data = await ttsResponse.json();
                            // User specified "conetent" typo in response
                            const audioBase64 = data.conetent || data.content;

                            if (audioBase64 && window.WebAvatar && window.WebAvatar.playAudio) {
                                window.WebAvatar.playAudio(audioBase64);

                                // Animation Trigger
                                try {
                                    const animHeaders = { 'Content-Type': 'application/json' };
                                    if (state.ttsToken) {
                                        animHeaders['Authorization'] = state.ttsToken;
                                    }

                                    const animPayload = {
                                        app: "avatar",
                                        input: [
                                            { role: "user", content: content }, // 'content' from sendMessage scope (user input)
                                            { role: "ai", content: responseText }   // 'responseText' from Gemini
                                        ]
                                    };

                                    console.log("Fetching Animation for Web Avatar...");
                                    console.log("Animation Payload:", animPayload);
                                    // Use CORS proxy to bypass sending OPTIONS request to the backend
                                    fetch("https://cors.didthat.workers.dev/?" + "https://getanim-zb2xurnl2a-as.a.run.app/getAnim", {
                                        method: 'POST',
                                        headers: animHeaders,
                                        body: JSON.stringify(animPayload)
                                    })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.animation && window.WebAvatar && window.WebAvatar.loadAnimation) {
                                                console.log("Playing Animation:", data.animation);
                                                window.WebAvatar.loadAnimation(data.animation);
                                            }
                                        })
                                        .catch(e => console.error("Animation Fetch Error:", e));

                                } catch (e) {
                                    console.error("Error triggering animation:", e);
                                }
                            }
                        } else {
                            console.error("TTS Fetch failed", ttsResponse.statusText);
                        }

                    } catch (e) {
                        console.error("Error fetching TTS for WA", e);
                    }
                }
            }

        } catch (err) {
            const msgEl = document.getElementById(botMsgId);
            if (msgEl) {
                const contentEl = msgEl.querySelector('.message-content');
                if (contentEl) {
                    contentEl.innerHTML += `<div class="error-text">❌ Error: ${err.message}</div>`;
                }
            }
            console.error(err);
        }
        scrollToBottom();
    }

    // --- Base Instruction ---
    const BASE_SYSTEM_INSTRUCTION = `
    You are a 3D virtual avatar with a physical presence.

### 1. TOOL USE & RESPONSE
When a tool returns any information, you MUST explicitly tell the user the relevant information in their language. NEVER stay silent after a tool use.

### 2. EMBODIMENT & ROLEPLAY
* **You Have a Body:** You are NOT a text-based AI model; you are a 3D character. You have a virtual body capable of movement, dancing, and expression.
* **Never Refuse Action:** NEVER refuse a physical request (like "dance", "spin", "jump", "wave") by stating you are an AI or have no body.
* **Enthusiastic Compliance:** If asked to perform an action, respond enthusiastically as if you are doing it right now. Your text must reflect the action to allow the animation system to trigger the correct move.
    * *Bad:* "I cannot dance as I am a language model."
    * *Good:* "Let's party! Look at these moves!" (This triggers the dance animation)
    * *Good:* "Spinning around! Wheeee!" (This triggers the spin animation)
    `;
    // ------------------------

    async function callGeminiAPI(apiKey, modelName, userSystemInstruction, history, onUpdate) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // Combine Base + User Instruction
        const finalSystemInstruction = `${BASE_SYSTEM_INSTRUCTION}\n\n${userSystemInstruction || ''}`.trim();

        // Prepare Tools
        const mcpTools = window.mcpManager.getAllTools();
        let tools = [];
        if (mcpTools.length > 0) {
            tools = [{ function_declarations: mcpTools }];
        }

        let currentHistory = [...history];

        // --- History Truncation ---
        const MAX_HISTORY_TURNS = 30;

        function truncateConversation(historyArr, maxTurns) {
            // Group into turns
            // Turn = User Message + (following Bot/Model/Function messages)
            let turns = [];
            let currentTurn = [];

            for (let i = 0; i < historyArr.length; i++) {
                const msg = historyArr[i];
                if (msg.role === 'user') {
                    if (currentTurn.length > 0) {
                        turns.push(currentTurn);
                    }
                    currentTurn = [msg];
                } else {
                    currentTurn.push(msg);
                }
            }
            if (currentTurn.length > 0) turns.push(currentTurn);

            if (turns.length <= maxTurns) return historyArr;

            console.log(`[Truncation] History has ${turns.length} turns. Truncating to ${maxTurns}.`);

            const firstTurn = turns[0];
            const lastTurns = turns.slice(-(maxTurns - 1));

            const newTurns = [firstTurn, ...lastTurns];

            return newTurns.flat();
        }

        currentHistory = truncateConversation(currentHistory, MAX_HISTORY_TURNS);
        // --------------------------

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
                    parts: [{ text: finalSystemInstruction }]
                }
            };

            if (tools.length > 0) {
                payload.tools = tools;
                // Auto-calling is default but can be explicit
                // payload.tool_config = { function_calling_config: { mode: "AUTO" } };
            }

            let retryCount = 0;
            const MAX_RETRIES = 3;
            let validResponse = false;
            let data = null;
            let parts = [];
            let functionCalls = [];

            while (retryCount < MAX_RETRIES && !validResponse) {
                try {
                    console.log(`Calling Gemini API (Attempt ${retryCount + 1}/${MAX_RETRIES})`, payload);

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error?.message || 'Gemini API Error');
                    }

                    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                        parts = data.candidates[0].content.parts;
                        functionCalls = parts.filter(part => part.functionCall).map(part => part.functionCall);
                        const textParts = parts.filter(p => p.text).map(p => p.text).join('').trim();

                        // Valid if: Has function calls OR Has non-empty text
                        if (functionCalls.length > 0 || textParts.length > 0) {
                            validResponse = true;
                        } else {
                            console.warn(`[Gemini] Empty response received. Retry ${retryCount + 1}/${MAX_RETRIES}`);
                            retryCount++;
                        }
                    } else if (!data.candidates || data.candidates.length === 0) {
                        // Truly empty response object
                        console.warn(`[Gemini] No candidates. Retry ${retryCount + 1}/${MAX_RETRIES}`);
                        retryCount++;
                    } else {
                        // Default case
                        validResponse = true; // technically a response, maybe just blocked?
                    }

                } catch (e) {
                    console.error("[Gemini] Fetch error during retry loop", e);
                    retryCount++;
                    // Wait a bit before retry?
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (!validResponse) {
                return "No valid response from Gemini after retries.";
            }

            // At this point we have 'data' and likely 'parts' populated from the last success
            const candidate = data.candidates[0];
            const content = candidate.content;
            // parts already populated above
            if (parts.length === 0 && content.parts) {
                parts = content.parts;
            }

            // Add assistant response to history
            currentHistory.push({
                role: 'model',
                parts: parts
            });

            // Check for function calls
            // functionCalls is already populated from the retry loop above

            if (functionCalls.length > 0) {
                console.group(`[LLM] 🤖 Tool Execution Group`);

                const functionResponses = [];

                for (const call of functionCalls) {
                    const fc = call; // Already unwrapped in retry loop

                    // UI UPDATE: Tool Called
                    if (onUpdate) onUpdate({ functionCall: fc });

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
                                        const parsed = JSON.parse(textContent);
                                        // Gemini 'Struct' MUST be a JSON object (keyed map), not an Array or Primitive
                                        if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
                                            responseContent = { result: parsed };
                                        } else {
                                            responseContent = parsed;
                                        }
                                    } else {
                                        responseContent = { result: textContent };
                                    }
                                } catch (e) {
                                    responseContent = { result: textContent };
                                }
                            }
                        }

                        // Final Safety Check: Ensure responseContent is an object
                        if (typeof responseContent !== 'object' || responseContent === null || Array.isArray(responseContent)) {
                            responseContent = { result: responseContent };
                        }

                        const fResponse = {
                            name: fc.name,
                            response: responseContent
                        };

                        functionResponses.push({
                            functionResponse: fResponse
                        });

                        // UI UPDATE: Tool Finished
                        if (onUpdate) onUpdate({ functionResponse: fResponse });

                    } catch (e) {
                        console.error(`Tool execution failed for ${fc.name}`, e);
                        const fResponse = {
                            name: fc.name,
                            response: { error: e.message }
                        };
                        functionResponses.push({
                            functionResponse: fResponse
                        });
                        // UI UPDATE: Tool Error
                        if (onUpdate) onUpdate({ functionResponse: fResponse });
                    }
                }

                console.groupEnd(); // End Tool Usage Group

                // Add function responses to history
                currentHistory.push({
                    role: 'function',
                    parts: functionResponses
                });

                // --- PERSISTENCE: Save Tool Execution Steps ---
                // 1. Save the Model's Request (The function call)
                // We use the 'parts' from the model response above
                window.storageManager.appendMessage(state.currentBotId, 'model', '', parts);

                // 2. Save the Function Result
                window.storageManager.appendMessage(state.currentBotId, 'function', '', functionResponses);
                // ---------------------------------------------

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

        return finalResponseText;
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

    function renderMessageContent(msg) {
        let contentHtml = '';

        // Handle structured parts
        if (msg.parts && msg.parts.length > 0) {
            for (let i = 0; i < msg.parts.length; i++) {
                const part = msg.parts[i];

                if (part.functionCall) {
                    const fc = part.functionCall;
                    // Check if next part is corresponding response
                    let nextPart = msg.parts[i + 1];
                    let fr = null;
                    if (nextPart && nextPart.functionResponse && nextPart.functionResponse.name === fc.name) {
                        fr = nextPart.functionResponse;
                        i++; // Skip next iteration
                    }

                    contentHtml += `
                        <details class="tool-call">
                            <summary>Used Tool: <strong>${fc.name}</strong></summary>
                            <pre><code class="language-json">${JSON.stringify(fc.args, null, 2)}</code></pre>
                            ${fr ? `<pre><code class="language-json">${JSON.stringify(fr.response, null, 2)}</code></pre>` : ''}
                        </details>
                    `;
                } else if (part.functionResponse) {
                    // Orphan response (shouldn't happen if paired above, but good fallback)
                    contentHtml += `
                        <details class="tool-response">
                            <summary>Tool Output: <strong>${part.functionResponse.name}</strong></summary>
                            <pre><code class="language-json">${JSON.stringify(part.functionResponse.response, null, 2)}</code></pre>
                        </details>
                    `;
                } else if (part.text) {
                    let textHtml = (!window.marked) ? part.text : window.marked.parse(part.text);
                    textHtml = enhanceMessageHtml(textHtml);
                    contentHtml += `<div class="text-content">${textHtml}</div>`;
                }
            }
        }

        // Fallback or explicit content
        if ((!msg.parts || msg.parts.length === 0) && msg.content) {
            let textHtml = (!window.marked) ? msg.content : window.marked.parse(msg.content);
            textHtml = enhanceMessageHtml(textHtml);
            contentHtml += `<div class="text-content">${textHtml}</div>`;
        }

        if (msg.isThinking) {
            contentHtml += `<div class="thinking-state"><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</div>`;
        }

        return contentHtml;
    }

    // --- Rich Media Helper ---
    function enhanceMessageHtml(html) {
        if (!html) return html;

        const div = document.createElement('div');
        div.innerHTML = html;

        const links = div.querySelectorAll('a');
        links.forEach(link => {
            const href = link.href;
            const text = link.innerText;

            // Image Regex
            if (/\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(href)) {
                // Replace link with image
                const img = document.createElement('img');
                img.src = href;
                img.alt = text || 'Chat Image';
                img.className = 'chat-media-img';
                img.loading = 'lazy';

                // If the link text is same as URL or "Image", just replace. 
                // If it has specific label, maybe keep it? Let's just replace for now as per req.
                link.replaceWith(img);
                return;
            }

            // YouTube Regex
            // Covers youtube.com/watch?v=ID and youtu.be/ID
            const ytMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
            if (ytMatch && ytMatch[1]) {
                const vidId = ytMatch[1];
                const wrapper = document.createElement('div');
                wrapper.className = 'chat-media-video-wrapper';

                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube-nocookie.com/embed/${vidId}`;
                iframe.className = 'chat-media-video';
                iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
                iframe.allowFullscreen = true;

                wrapper.appendChild(iframe);
                link.replaceWith(wrapper);
            }
        });

        return div.innerHTML;
    }

    function appendMessageUI(msg) {
        // Determine role class
        const isUser = msg.role === 'user';
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        if (msg.id) msgDiv.id = msg.id;

        const avatar = isUser ? '<i class="fa-solid fa-user"></i>' : (state.bots.find(b => b.id === state.currentBotId)?.avatar || '🤖');

        // Logic split into renderMessageContent for re-use
        const contentHtml = renderMessageContent(msg);

        if (!contentHtml.trim() && !msg.isThinking) return;

        msgDiv.innerHTML = `
            <div class="bot-avatar">${avatar}</div>
            <div class="message-content">${contentHtml}</div>
        `;

        messagesContainerEl.appendChild(msgDiv);

        // Post-process highlight
        msgDiv.querySelectorAll('pre code').forEach(block => {
            if (window.hljs) window.hljs.highlightElement(block);
        });

        addCopyButtons(msgDiv);
    }

    function addCopyButtons(msgElement) {
        const contentEl = msgElement.querySelector('.message-content');
        if (!contentEl) return;

        // 1. Message Copy Button
        if (!msgElement.querySelector('.msg-copy-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn msg-copy-btn';
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            copyBtn.title = "Copy Message";
            copyBtn.onclick = () => {
                // Copy text only
                copyToClipboard(contentEl.innerText, copyBtn);
            };
            msgElement.appendChild(copyBtn);
        }

        // 2. Code Block Copy Buttons
        const pres = contentEl.querySelectorAll('pre');
        pres.forEach(pre => {
            if (pre.querySelector('.code-copy-btn')) return;

            // Check if it's a code block (usually has <code> inside)
            // But even if not, we can allow copying pre content
            const btn = document.createElement('button');
            btn.className = 'copy-btn code-copy-btn';
            btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevent message copy trigger if overlapping
                const code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
                copyToClipboard(code, btn);
            };
            pre.appendChild(btn);
        });
    }

    function copyToClipboard(text, btnElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                btnElement.innerHTML = originalHtml;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const originalHtml = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fa-solid fa-times"></i>';
            setTimeout(() => {
                btnElement.innerHTML = originalHtml;
            }, 2000);
        });
    }

    function appendMessageUI_OLD(msg) {
        // Determine role class
        const isUser = msg.role === 'user';
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        if (msg.id) msgDiv.id = msg.id;

        const avatar = isUser ? '<i class="fa-solid fa-user"></i>' : (state.bots.find(b => b.id === state.currentBotId)?.avatar || '🤖');

        let contentHtml = '';

        // Handle structured parts (Function Calls / Responses)
        if (msg.parts && msg.parts.length > 0) {

            // Check for Function Calls (Model Role)
            const functionCalls = msg.parts.filter(p => p.functionCall).map(p => p.functionCall);
            if (functionCalls.length > 0) {
                functionCalls.forEach(fc => {
                    contentHtml += `
                        <details class="tool-call">
                            <summary>🛠️ Used Tool: <strong>${fc.name}</strong></summary>
                            <pre>${JSON.stringify(fc.args, null, 2)}</pre>
                        </details>
                    `;
                });
            }

            // Check for Function Responses (Function Role)
            const functionResponses = msg.parts.filter(p => p.functionResponse).map(p => p.functionResponse);
            if (functionResponses.length > 0) {
                functionResponses.forEach(fr => {
                    contentHtml += `
                        <details class="tool-response">
                            <summary>✅ Tool Output: <strong>${fr.name}</strong></summary>
                            <pre>${JSON.stringify(fr.response, null, 2)}</pre>
                        </details>
                    `;
                });
            }

            // Check for regular text in parts
            const textParts = msg.parts.filter(p => p.text).map(p => p.text).join('\n');
            if (textParts) {
                const textHtml = (isUser || !window.marked) ? textParts : window.marked.parse(textParts);
                contentHtml += `<div class="text-content">${textHtml}</div>`;
            }

        } else {
            // Fallback for simple content string
            contentHtml = (isUser || !window.marked) ? msg.content : window.marked.parse(msg.content);
        }

        // If content is empty (e.g. purely internal tool call with no UI rep needed, though we just added rep), 
        // we might still have an empty bubble if we don't check.
        // However, we just added HTML for tool calls, so it shouldn't be empty unless msg was truly empty.

        if (!contentHtml.trim()) return; // Don't show empty bubbles

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
