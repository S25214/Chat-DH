(function () {
    const INIT_WIDTH = "360px";
    const INIT_HEIGHT = "360px";
    const MIN_WIDTH = "360px";
    const MIN_HEIGHT = "360px";

    // State variables
    let container = null;
    let iframe = null;
    let overlay = null;
    let isLoaded = false;
    let messageQueue = [];
    let queueInterval = null;
    let config = {
        autoUnmute: true,
        showUI: true
    };

    // --- HELPER FUNCTIONS ---

    function createDragShield(cursorType) {
        let dragShield = document.createElement('div');
        dragShield.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647; /* Max Z-Index */
            cursor: ${cursorType};
            background: transparent;
        `;
        document.body.appendChild(dragShield);
        return dragShield;
    }


    function removeDragShield(dragShield) {
        if (dragShield && dragShield.parentNode) {
            dragShield.parentNode.removeChild(dragShield);
        }
    }

    function handleIframeMessage(event) {
        if (!iframe || event.source !== iframe.contentWindow) return;
        if (event.data && event.data.value === 'loadingComplete') {
            isLoaded = true;

            // Queue Auto-Unmute
            if (config.autoUnmute) {
                console.log("Queueing Auto-unmuting Audio (Config Enabled)");
                messageQueue.push({ message: 'unMuteAudio' });
                if (overlay) {
                    overlay.remove();
                    overlay = null;
                }
                iframe.focus();
            } else if (overlay) {
                overlay.style.cursor = 'pointer';
                // Add visual cue (Red Speaker Icon + Text)
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                // overlay.style.backgroundColor = 'rgba(0,0,0,0.1)'; // Optional: slight dim
                overlay.innerHTML = `
                    <div style="background: rgba(0, 0, 0, 0.6); padding: 12px 20px; border-radius: 8px; text-align: center; color: white; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); backdrop-filter: blur(4px);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: #ff5555;">
                            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M23 9L17 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M17 9L23 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span style="font-family: sans-serif; font-size: 14px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">Click to Unmute</span>
                    </div>
                `;
            }

            // Queue UI Toggle
            if (config.showUI) {
                console.log("Queueing UI On");
                messageQueue.push({ command: "generic_message", message: "uiOn" });
            } else {
                console.log("Queueing UI Off");
                messageQueue.push({ command: "generic_message", message: "uiOff" });
            }
        }
        console.log("Received Message from Iframe:", event.data);
    }

    function processQueue() {
        if (!isLoaded || messageQueue.length === 0 || !iframe || !iframe.contentWindow) return;

        const data = messageQueue.shift();
        data._padding = "||END||";
        iframe.contentWindow.postMessage(data, '*');
        console.log("Processed message from queue:", data);
    }

    // --- MAIN INIT FUNCTION ---
    function init(streamUrl, optionsOrContainer = null) {
        if (container) {
            console.warn("DigitalHuman widget is already initialized.");
            return;
        }

        if (!streamUrl) {
            console.error("DigitalHuman init: streamUrl is required.");
            return;
        }

        // Parse Options
        let customContainer = null;
        config.autoUnmute = true; // Reset default
        config.showUI = true;

        if (optionsOrContainer) {
            if (optionsOrContainer instanceof HTMLElement) {
                customContainer = optionsOrContainer;
            } else if (typeof optionsOrContainer === 'object') {
                if (optionsOrContainer.container) customContainer = optionsOrContainer.container;
                if (optionsOrContainer.autoUnmute) config.autoUnmute = true;
                if (optionsOrContainer.showUI === false) config.showUI = false;
            }
        }

        // Initialize Queue Processing
        messageQueue = [];
        if (queueInterval) clearInterval(queueInterval);
        queueInterval = setInterval(processQueue, 600);

        let isCustomContainer = false;

        if (customContainer && customContainer instanceof HTMLElement) {
            container = customContainer;
            isCustomContainer = true;
            // Ensure container has position relative so absolute children are positioned correctly
            if (window.getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
        } else {
            // 1. Create Main Container (Fixed Bottom-Right)
            container = document.createElement('div');
            container.style.cssText = `
                position: fixed; 
                bottom: 20px; 
                right: 20px; 
                width: ${INIT_WIDTH}; 
                height: ${INIT_HEIGHT}; 
                min-width: min(${MIN_WIDTH}, 100vw); 
                min-height: min(${MIN_HEIGHT}, 100vh);
                max-width: 100vw;
                max-height: 100vh;
                background: #000; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); 
                z-index: 99999;
                border-radius: 8px;
                overflow: hidden;
            `;
            document.body.appendChild(container);

            // 2. Create the "Resize Handle" (Top-Left Corner)
            const handle = document.createElement('div');
            handle.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 20px;
                height: 20px;
                background: rgba(255, 255, 255, 0.3);
                cursor: nwse-resize;
                z-index: 100001; /* Highest priority */
                border-bottom-right-radius: 100%; /* Quarter-circle look */
            `;
            handle.innerHTML = '<div style="width:6px; height:6px; background:#fff; position:absolute; top:4px; left:4px; border-radius:50%;"></div>';
            container.appendChild(handle);

            // 2.5 Create the "Move Handle" (Top-Right Corner)
            const moveHandle = document.createElement('div');
            moveHandle.style.cssText = `
                position: absolute;
                top: 0;
                right: 0;
                width: 20px;
                height: 20px;
                background: rgba(255, 255, 255, 0.3);
                cursor: move;
                z-index: 100001;
                border-bottom-left-radius: 100%;
            `;
            moveHandle.innerHTML = '<div style="width:6px; height:6px; background:#fff; position:absolute; top:4px; right:4px; border-radius:50%;"></div>';
            container.appendChild(moveHandle);

            // --- RESIZING LOGIC ---
            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            let currentResizeShield = null;

            handle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                isResizing = true;
                currentResizeShield = createDragShield('nwse-resize');

                startX = e.clientX;
                startY = e.clientY;
                startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);

                document.addEventListener('mousemove', doDrag, true);
                document.addEventListener('mouseup', stopDrag, true);
            });

            function doDrag(e) {
                if (!isResizing) return;
                e.preventDefault();
                e.stopPropagation();

                const deltaX = startX - e.clientX;
                const deltaY = startY - e.clientY;

                container.style.width = (startWidth + deltaX) + 'px';
                container.style.height = (startHeight + deltaY) + 'px';
            }

            function stopDrag(e) {
                isResizing = false;
                if (iframe) iframe.style.pointerEvents = 'auto';
                removeDragShield(currentResizeShield);
                currentResizeShield = null;

                document.removeEventListener('mousemove', doDrag, true);
                document.removeEventListener('mouseup', stopDrag, true);
            }

            // --- MOVING LOGIC ---
            let isMoving = false;
            let startMoveX, startMoveY, startRight, startBottom;
            let currentMoveShield = null;

            moveHandle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                isMoving = true;
                currentMoveShield = createDragShield('move');

                startMoveX = e.clientX;
                startMoveY = e.clientY;

                const computedStyle = document.defaultView.getComputedStyle(container);
                startRight = parseInt(computedStyle.right, 10);
                startBottom = parseInt(computedStyle.bottom, 10);

                document.addEventListener('mousemove', doMove, true);
                document.addEventListener('mouseup', stopMove, true);
            });

            function doMove(e) {
                if (!isMoving) return;
                e.preventDefault();
                e.stopPropagation();

                const deltaX = e.clientX - startMoveX;
                const deltaY = e.clientY - startMoveY;

                let newRight = startRight - deltaX;
                let newBottom = startBottom - deltaY;

                // --- BOUNDARY CHECKS (Strictly inside viewport) ---
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const rect = container.getBoundingClientRect();
                const width = rect.width;
                const height = rect.height;

                // 1. Right Boundary check (Right edge shouldn't go < 0)
                if (newRight < 0) newRight = 0;

                // 2. Left Boundary check (Left edge shouldn't go < 0)
                // Left position = viewportWidth - (newRight + width)
                // We want: viewportWidth - (newRight + width) >= 0 => newRight + width <= viewportWidth => newRight <= viewportWidth - width
                if (newRight > viewportWidth - width) newRight = viewportWidth - width;

                // 3. Bottom Boundary check (Bottom edge shouldn't go < 0)
                if (newBottom < 0) newBottom = 0;

                // 4. Top Boundary check (Top edge shouldn't go < 0)
                // Top position = viewportHeight - (newBottom + height)
                // We want: viewportHeight - (newBottom + height) >= 0 => newBottom + height <= viewportHeight => newBottom <= viewportHeight - height
                if (newBottom > viewportHeight - height) newBottom = viewportHeight - height;

                container.style.right = newRight + 'px';
                container.style.bottom = newBottom + 'px';
            }

            function stopMove(e) {
                isMoving = false;
                if (iframe) iframe.style.pointerEvents = 'auto';
                removeDragShield(currentMoveShield);
                currentMoveShield = null;

                document.removeEventListener('mousemove', doMove, true);
                document.removeEventListener('mouseup', stopMove, true);
            }
        }

        // 3. Create Iframe
        iframe = document.createElement('iframe');
        iframe.src = streamUrl;
        iframe.allow = "autoplay *; microphone *; camera *; display-capture *";
        iframe.style.cssText = "width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;";
        container.appendChild(iframe);

        // 4. Create Click Overlay (For Unmuting)
        overlay = document.createElement('div');
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: transparent; cursor: wait;";
        container.appendChild(overlay);

        // --- AUDIO UNMUTE LOGIC ---
        window.removeEventListener('message', handleIframeMessage);
        window.addEventListener('message', handleIframeMessage);

        overlay.addEventListener('click', function () {
            if (!isLoaded) return;
            iframe.contentWindow.postMessage({ message: 'unMuteAudio' }, '*');
            console.log("Unmuted Audio");
            overlay.remove();
            overlay = null; // Clear reference
            iframe.focus();
        });

        // Store disconnection logic type
        container._isCustomContainer = isCustomContainer;

        // --- WINDOW RESIZE HANDLER ---
        // Ensure widget stays in bounds when window is resized
        window.removeEventListener('resize', handleWindowResize); // Remove old if any (logic safety)
        window.addEventListener('resize', handleWindowResize);
    }


    function handleWindowResize() {
        if (!container || !document.body.contains(container) || container._isCustomContainer) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const rect = container.getBoundingClientRect();

        // Get current "right" and "bottom" computed values
        // Note: We use computed style because style.right might be empty if set via stylesheet initially (though we set it inline in init)
        const computedStyle = window.getComputedStyle(container);
        let currentRight = parseFloat(computedStyle.right);
        let currentBottom = parseFloat(computedStyle.bottom);

        // Sanity: if NaNs (e.g. positioned by left/top primarily), we need to calculate
        if (isNaN(currentRight)) currentRight = viewportWidth - (rect.left + rect.width);
        if (isNaN(currentBottom)) currentBottom = viewportHeight - (rect.top + rect.height);

        let newRight = currentRight;
        let newBottom = currentBottom;
        let needsUpdate = false;

        // Clamp Right (Prevent going off right edge)
        if (newRight < 0) {
            newRight = 0;
            needsUpdate = true;
        }

        // Clamp Left (Prevent going off left edge)
        // newRight max = viewportWidth - width
        if (newRight > viewportWidth - rect.width) {
            newRight = viewportWidth - rect.width;
            needsUpdate = true;
        }

        // Clamp Bottom (Prevent going off bottom edge)
        if (newBottom < 0) {
            newBottom = 0;
            needsUpdate = true;
        }

        // Clamp Top (Prevent going off top edge)
        // newBottom max = viewportHeight - height
        if (newBottom > viewportHeight - rect.height) {
            newBottom = viewportHeight - rect.height;
            needsUpdate = true;
        }

        if (needsUpdate) {
            container.style.right = newRight + 'px';
            container.style.bottom = newBottom + 'px';
        }
    }


    function disconnect() {
        if (container) {
            if (container._isCustomContainer) {
                // If custom container, only remove the iframe and overlay, don't remove the container itself
                if (iframe && iframe.parentNode === container) {
                    container.removeChild(iframe);
                }
                if (overlay && overlay.parentNode === container) {
                    container.removeChild(overlay);
                }
                // Optional: Remove relative positioning if we set it? 
                // Probably better to leave it to avoid layout shifts, or check if we added it.
            } else {
                // Default behavior: remove the entire widget container
                if (container.parentNode) {
                    container.parentNode.removeChild(container);
                }
            }
        }

        window.removeEventListener('message', handleIframeMessage);
        window.removeEventListener('resize', handleWindowResize);

        // Clear Queue Interval
        if (queueInterval) {
            clearInterval(queueInterval);
            queueInterval = null;
        }
        messageQueue = [];

        container = null;
        iframe = null;
        overlay = null;
        isLoaded = false;
        console.log("DigitalHuman disconnected.");
    }

    // --- INTERNAL LOGIC ---
    const sendMessageToIframe = (data) => {
        if (!iframe || !iframe.contentWindow) {
            console.error("Iframe not ready or widget not initialized.");
            return;
        }
        console.log("Queueing message:", data);
        messageQueue.push(data);
    };

    // --- EXPOSE API TO PARENT ---
    window.DigitalHuman = window.DigitalHuman || {};

    window.DigitalHuman.init = init;
    window.DigitalHuman.disconnect = disconnect;

    window.DigitalHuman.sendMessage = function (message) {
        console.log("Sending Message from Parent Site:", message);
        const payload = {
            command: "generic_message",
            message: message
        };
        sendMessageToIframe(payload);
    };

    window.DigitalHuman.setConfigID = function (message) {
        console.log("Sending Message from Parent Site:", message);
        const payload = {
            command: "set_config_id",
            config_id: message
        };
        sendMessageToIframe(payload);
    };

    window.DigitalHuman.sendJob = function (text, callbackUrl, authToken, customParams = {}) {
        const payload = {
            command: "tts_order",
            text: text,
            callback_url: callbackUrl,
            auth_token: authToken,
            ...customParams
        };
        console.log("Sending Job from Parent Site:", payload);
        sendMessageToIframe(payload);
    };

})();
