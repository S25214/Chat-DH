(function () {
    const INIT_WIDTH = "360px";
    const INIT_HEIGHT = "360px";
    const MIN_WIDTH = "360px";
    const MIN_HEIGHT = "360px";
    const MESSAGE_DELAY = 2000;
    const LOOK_AT_DELAY = 2000;
    const LOOK_AT_INTERVAL = 1000;

    // State variables
    let container = null;
    let iframe = null;
    let overlay = null;
    let isLoaded = false;
    let messageQueue = [];
    let queueInterval = null;
    let config = {
        autoUnmute: true,
        showUI: true,
        lookAt: false,
        camera: null,
        microphone: true,
        provider: null
    };

    // Face Detection State
    let fd = null;
    let cameraStream = null; // Replaces 'camera' object from utils
    let videoElement = null;
    let faceDetectReqId = null; // Request Animation Frame ID
    let lookAtInterval = null;
    let faceState = {
        cx: 0.5, cy: 0.5, // Current smoothed values
        tx: 0.5, ty: 0.5, // Target values
        lastDetection: 0,
        count: 0
    };
    let enableLookAt = false;
    let enableLookAtTimeout = null;

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

    async function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
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

            // Queue Microphone Enable
            if (config.microphone) {
                messageQueue.push({ command: 'microphone', value: true });
            }
            // Queue Auto-Unmute
            if (config.autoUnmute) {
                console.log("Queueing Auto-unmuting Audio (Config Enabled)");
                messageQueue.push({ command: 'unMuteAudio' });
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
            if (!config.showUI) {
                console.log("Queueing UI Off");
                messageQueue.push({ command: "generic_message", message: "uiOff" });
            }

            // Queue Camera Config if present
            if (config.camera) {
                console.log("Queueing Camera Config", config.camera);
                messageQueue.push({
                    command: "camera",
                    x: config.camera.x,
                    y: config.camera.y,
                    z: config.camera.z
                });
            }

            // Calculate Delay for LookAt
            // 5 seconds + (number of messages * MESSAGE_DELAY)
            const queueDelay = (messageQueue.length * MESSAGE_DELAY) + LOOK_AT_DELAY;
            console.log(`LookAt will be enabled in ${queueDelay / MESSAGE_DELAY} seconds.`);

            if (enableLookAtTimeout) clearTimeout(enableLookAtTimeout);
            enableLookAtTimeout = setTimeout(() => {
                enableLookAt = true;
                console.log("LookAt is now ENABLED.");
            }, queueDelay);

        }
        console.log("Received Message from Iframe:", event.data);
    }

    function processQueue() {
        if (!isLoaded || messageQueue.length === 0) return;

        // Vagon Logic
        if (config.provider === 'vagon') {
            if (!window.Vagon || !window.Vagon.isConnected) return;
            const data = messageQueue.shift();
            data.padding = "||END||";
            window.Vagon.emitUIInteraction(JSON.stringify(data));
            console.log("Processed message from queue:", data);
        } else if (config.provider === 'streampixel') {
            if (!iframe || !iframe.contentWindow) return;
            const data = messageQueue.shift();
            data._padding = "||END||";
            iframe.contentWindow.postMessage(data, '*');
            console.log("Processed message from queue:", data);
        }
    }

    // --- DETERMINE BASE URL ---
    // Capture the script's location to resolve relative paths for assets (like widget-client.html)
    // regardless of where the script is run from.
    const currentScript = document.currentScript;
    let baseUrl = "";
    if (currentScript) {
        const src = currentScript.src;
        // removing "digitalhuman-widget.js" from the end
        baseUrl = src.substring(0, src.lastIndexOf('/') + 1);
    }

    // --- MAIN INIT FUNCTION ---
    function init(streamUrl, optionsOrContainer = null) {
        if (container) {
            alert("DigitalHuman widget is already initialized.");
            console.warn("DigitalHuman widget is already initialized.");
            return;
        }

        if (streamUrl) {
            if (streamUrl.includes('vagon.io')) {
                config.provider = 'vagon';
                console.log("Auto-detected Provider: Vagon");
            } else if (streamUrl.includes('streampixel.io')) {
                config.provider = 'streampixel';
                console.log("Auto-detected Provider: StreamPixel");
            } else {
                alert("Unknown Streaming Provider. Please check your URL.");
                console.error("Unknown Streaming Provider. URL must contain 'vagon.io' or 'streampixel.io'");
                return;
            }
        } else {
            alert("No Stream URL provided.");
            console.error("No Stream URL provided.");
            return;
        }

        // Parse Options
        let customContainer = null;
        config.autoUnmute = true; // Reset default
        config.showUI = true;
        config.lookAt = false;
        config.camera = null;
        config.microphone = true;


        if (optionsOrContainer) {
            if (optionsOrContainer instanceof HTMLElement) {
                customContainer = optionsOrContainer;
            } else if (typeof optionsOrContainer === 'object') {
                if (optionsOrContainer.container) customContainer = optionsOrContainer.container;
                if (optionsOrContainer.autoUnmute === false) config.autoUnmute = false;
                if (optionsOrContainer.showUI === false) config.showUI = false;
                if (optionsOrContainer.lookAt === true) config.lookAt = true;
                if (optionsOrContainer.camera) config.camera = optionsOrContainer.camera;
                if (optionsOrContainer.microphone === false) config.microphone = false;
            }
        }

        // Initialize Queue Processing
        messageQueue = [];
        if (queueInterval) clearInterval(queueInterval);
        queueInterval = setInterval(processQueue, MESSAGE_DELAY);

        enableLookAt = false;
        if (enableLookAtTimeout) clearTimeout(enableLookAtTimeout);

        // Initialize Face Detection if enabled
        if (config.lookAt) {
            initFaceDetection();
        }

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

            // --- HELPER FOR TOUCH/MOUSE ---
            function getClientPos(e) {
                if (e.touches && e.touches.length > 0) {
                    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                return { x: e.clientX, y: e.clientY };
            }

            // --- RESIZING LOGIC ---
            let isResizing = false;
            let startX, startY, startWidth, startHeight;
            let currentResizeShield = null;

            function startResize(e) {
                if (e.cancelable) e.preventDefault();
                isResizing = true;
                currentResizeShield = createDragShield('nwse-resize');

                const pos = getClientPos(e);
                startX = pos.x;
                startY = pos.y;
                startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);

                document.addEventListener('mousemove', doDrag, { capture: true, passive: false });
                document.addEventListener('mouseup', stopDrag, true);
                document.addEventListener('touchmove', doDrag, { capture: true, passive: false });
                document.addEventListener('touchend', stopDrag, true);
                document.addEventListener('touchcancel', stopDrag, true);
            }

            handle.addEventListener('mousedown', startResize);
            handle.addEventListener('touchstart', startResize, { passive: false });

            function doDrag(e) {
                if (!isResizing) return;
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                const pos = getClientPos(e);
                const deltaX = startX - pos.x;
                const deltaY = startY - pos.y;

                container.style.width = (startWidth + deltaX) + 'px';
                container.style.height = (startHeight + deltaY) + 'px';
            }

            function stopDrag(e) {
                isResizing = false;
                if (iframe) iframe.style.pointerEvents = 'auto';
                removeDragShield(currentResizeShield);
                currentResizeShield = null;

                document.removeEventListener('mousemove', doDrag, { capture: true });
                document.removeEventListener('mouseup', stopDrag, true);
                document.removeEventListener('touchmove', doDrag, { capture: true });
                document.removeEventListener('touchend', stopDrag, true);
                document.removeEventListener('touchcancel', stopDrag, true);
            }

            // --- MOVING LOGIC ---
            let isMoving = false;
            let startMoveX, startMoveY, startRight, startBottom;
            let currentMoveShield = null;

            function startMove(e) {
                if (e.cancelable) e.preventDefault();
                isMoving = true;
                currentMoveShield = createDragShield('move');

                const pos = getClientPos(e);
                startMoveX = pos.x;
                startMoveY = pos.y;

                const computedStyle = document.defaultView.getComputedStyle(container);
                startRight = parseInt(computedStyle.right, 10);
                startBottom = parseInt(computedStyle.bottom, 10);

                document.addEventListener('mousemove', doMove, { capture: true, passive: false });
                document.addEventListener('mouseup', stopMove, true);
                document.addEventListener('touchmove', doMove, { capture: true, passive: false });
                document.addEventListener('touchend', stopMove, true);
                document.addEventListener('touchcancel', stopMove, true);
            }

            moveHandle.addEventListener('mousedown', startMove);
            moveHandle.addEventListener('touchstart', startMove, { passive: false });

            function doMove(e) {
                if (!isMoving) return;
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();

                const pos = getClientPos(e);
                const deltaX = pos.x - startMoveX;
                const deltaY = pos.y - startMoveY;

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
                if (newRight > viewportWidth - width) newRight = viewportWidth - width;

                // 3. Bottom Boundary check (Bottom edge shouldn't go < 0)
                if (newBottom < 0) newBottom = 0;

                // 4. Top Boundary check (Top edge shouldn't go < 0)
                if (newBottom > viewportHeight - height) newBottom = viewportHeight - height;

                container.style.right = newRight + 'px';
                container.style.bottom = newBottom + 'px';
            }

            function stopMove(e) {
                isMoving = false;
                if (iframe) iframe.style.pointerEvents = 'auto';
                removeDragShield(currentMoveShield);
                currentMoveShield = null;

                document.removeEventListener('mousemove', doMove, { capture: true });
                document.removeEventListener('mouseup', stopMove, true);
                document.removeEventListener('touchmove', doMove, { capture: true });
                document.removeEventListener('touchend', stopMove, true);
                document.removeEventListener('touchcancel', stopMove, true);
            }
        }



        // 3. Create Iframe
        iframe = document.createElement('iframe');

        if (config.provider === 'vagon') {
            console.log("Initializing Vagon Widget...");

            // 3a. LOAD Vagon SDK
            // We assume vagonsdk.js is in the same folder as this script
            loadScript(baseUrl + "vagonsdk.js").then(() => {
                console.log("Vagon SDK Loaded.");
                // 3b. Setup Iframe for Vagon
                let allowFeatures = "autoplay *; camera *; display-capture *; clipboard-read *; clipboard-write *; encrypted-media *;";
                if (config.microphone) {
                    allowFeatures += "; microphone *";
                }
                iframe.id = "vagonFrame"; // REQUIRED by Vagon SDK
                iframe.src = streamUrl;
                iframe.allow = allowFeatures;
                iframe.style.cssText = "width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;";

                if (window.Vagon) {
                    console.log("Vagon SDK is ready.");
                    window.Vagon.onConnected(() => {
                        console.log("User Connected");
                        isLoaded = true;
                        if (overlay) {
                            overlay.style.cursor = 'pointer';
                            // Show unmute UI? Vagon usually handles its own or we can force it.
                            overlay.style.display = 'flex';
                            overlay.style.justifyContent = 'center';
                            overlay.style.alignItems = 'center';
                            overlay.innerHTML = `
                                <div style="background: rgba(0, 0, 0, 0.6); padding: 12px 20px; border-radius: 8px; text-align: center; color: white; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); backdrop-filter: blur(4px);">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="stroke: #ff5555;">
                                        <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M23 9L17 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M17 9L23 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    <span style="font-family: sans-serif; font-size: 14px; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">Click to Start</span>
                                </div>
                            `;
                        }
                    });
                    window.Vagon.onDisconnected(() => {
                        console.log("User Disconnected");
                        isLoaded = false;
                    });

                    window.Vagon.onApplicationMessage((evt) => {
                        console.log("Received Message from Unreal:", evt.message);
                        // Optional: You can choose to dispatch this to the parent window or handle it here
                    });

                    window.Vagon.onResponse((data) => {
                        console.log("Received Response from Unreal (Pixel Streaming):", data);
                    });

                    container.appendChild(iframe);
                }
            }).catch(e => {
                console.error("Failed to load Vagon SDK", e);
            });

        } else {
            // StreamPixel (Default) Logic
            iframe.src = baseUrl + "widget-client.html";
            console.log("Loading widget client from:", iframe.src);

            iframe.onload = () => {
                // Extract Stream ID from the original URL if necessary, or assume input is ID
                let sId = streamUrl;
                try {
                    const urlObj = new URL(streamUrl);
                    // extracting the last part of the path as ID
                    const parts = urlObj.pathname.split('/').filter(p => p);
                    if (parts.length > 0) {
                        sId = parts[parts.length - 1];
                    }
                } catch (e) {
                    // Not a URL, stick with original value
                }

                console.log("Initializing WebSDK with Stream ID:", sId);
                iframe.contentWindow.postMessage({
                    command: 'init_sdk',
                    streamId: sId,
                    config: config
                }, '*');
            };

            let allowFeatures = "autoplay *; camera *; display-capture *";
            if (config.microphone) {
                allowFeatures += "; microphone *";
            }
            iframe.allow = allowFeatures;
            iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
            iframe.style.cssText = "width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0;";
            container.appendChild(iframe);
        }

        // 4. Create Click Overlay (For Unmuting)
        overlay = document.createElement('div');
        overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000; background: transparent; cursor: wait;";
        container.appendChild(overlay);

        // --- AUDIO UNMUTE LOGIC ---
        window.removeEventListener('message', handleIframeMessage);
        window.addEventListener('message', handleIframeMessage);

        overlay.addEventListener('click', function () {
            if (!isLoaded) return;

            if (config.provider === 'vagon') {
                if (window.Vagon) {
                    // Try to unmute or focus
                    window.Vagon.focusIframe();
                    // Some basic initial interaction
                    // Vagon typically starts with audio enabled if policy allows, otherwise interaction starts it.
                    // We can try setting volume.
                    window.Vagon.setVideoVolume(1);
                    console.log("Clicked Overlay (Focus/Unmute)");
                }
            } else {
                messageQueue.push({ command: 'unMuteAudio' });
                console.log("Unmuted Audio");
            }

            overlay.remove();
            overlay = null; // Clear reference
            if (config.microphone) {
                messageQueue.push({ command: 'microphone', value: true });
            }
            if (iframe) iframe.focus();
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
            if (config.provider === 'vagon' && window.Vagon) {
                try {
                    // Clean up Vagon
                    window.Vagon.shutdown();
                } catch (e) { console.warn("Vagon cleanup warning:", e); }
            }
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
                if (container && container.parentNode) {
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
        enableLookAt = false;
        if (enableLookAtTimeout) {
            clearTimeout(enableLookAtTimeout);
            enableLookAtTimeout = null;
        }

        cleanupFaceDetection();

        console.log("DigitalHuman disconnected.");
    }

    // --- FACE DETECTION LOGIC ---
    async function initFaceDetection() {
        if (fd) return; // Already initialized

        console.log("Initializing Face Detection...");
        try {
            await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js");
            // No longer using camera_utils to ensure mobile selfie camera support
            // await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");

            videoElement = document.createElement('video');
            videoElement.style.display = 'none';
            videoElement.setAttribute('playsinline', ''); // Critical for iOS
            videoElement.setAttribute('muted', '');
            document.body.appendChild(videoElement);

            fd = new FaceDetection({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}` });
            fd.setOptions({ model: 'short', minDetectionConfidence: 0.65 });

            fd.onResults(onFaceResults);

            // Manual Camera Setup for Mobile Selfie Support
            const constraints = {
                video: {
                    facingMode: 'user', // Force front camera
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            };

            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = cameraStream;
            await videoElement.play();

            // Start Analysis Loop
            const processFrame = async () => {
                if (!fd || !videoElement) return;
                // Only send if video is ready
                if (videoElement.readyState >= 2) {
                    await fd.send({ image: videoElement });
                }
                faceDetectReqId = requestAnimationFrame(processFrame);
            };
            processFrame();

            // Start sending lookAt commands
            if (lookAtInterval) clearInterval(lookAtInterval);
            lookAtInterval = setInterval(() => {
                if (window.DigitalHuman && window.DigitalHuman.lookAt) {
                    // faceState.cx += (faceState.tx - faceState.cx) * 0.2;
                    // faceState.cy += (faceState.ty - faceState.cy) * 0.2;

                    faceState.cx = faceState.tx;
                    faceState.cy = faceState.ty;

                    // Check if we lost tracking for > 3s
                    if (Date.now() - faceState.lastDetection > 3000) {
                        faceState.tx = 0.5;
                        faceState.ty = 0.5;
                    }

                    // Only send if loaded
                    window.DigitalHuman.lookAt(faceState.count, faceState.cx, faceState.cy);
                }
            }, LOOK_AT_INTERVAL);

            console.log("Face Detection Initialized.");

        } catch (e) {
            console.error("Failed to initialize Face Detection", e);
        }
    }

    function onFaceResults(results) {
        const faces = results.detections;
        faceState.count = faces ? faces.length : 0;

        if (faces && faces.length > 0) {
            let wx = 0, wy = 0, tot = 0;
            // Calculate Weighted Average
            for (const f of faces) {
                const b = f.boundingBox;
                const area = b.width * b.height;
                wx += b.xCenter * area;
                wy += b.yCenter * area;
                tot += area;
            }
            faceState.tx = wx / tot;
            faceState.ty = wy / tot;
            faceState.lastDetection = Date.now();
        }
    }

    function cleanupFaceDetection() {
        if (faceDetectReqId) {
            cancelAnimationFrame(faceDetectReqId);
            faceDetectReqId = null;
        }

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        if (fd) {
            fd.close();
            fd = null;
        }

        if (videoElement && videoElement.parentNode) {
            videoElement.parentNode.removeChild(videoElement);
            videoElement = null;
        }

        if (lookAtInterval) {
            clearInterval(lookAtInterval);
            lookAtInterval = null;
        }

        // Reset state
        faceState = { cx: 0.5, cy: 0.5, tx: 0.5, ty: 0.5, lastDetection: 0, count: 0 };
    }

    // --- INTERNAL LOGIC ---
    const sendMessageToIframe = (data) => {
        console.log("Queueing message:", data);
        messageQueue.push(data);
    };

    // --- EXPOSE API TO PARENT ---
    window.DigitalHuman = window.DigitalHuman || {};

    window.DigitalHuman.init = init;
    window.DigitalHuman.disconnect = disconnect;

    window.DigitalHuman.setCamera = function (x, y, z) {
        const payload = {
            command: "camera",
            x: x,
            y: y,
            z: z
        };
        console.log("Sending Camera Command:", payload);
        sendMessageToIframe(payload);
    };

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

    window.DigitalHuman.lookAt = function (faces, x, y) {
        if (!isLoaded || !iframe || !iframe.contentWindow || !enableLookAt) return;

        const payload = {
            command: "look_at",
            faces: faces,
            x: x,
            y: y
        };
        payload._padding = "||END||";
        if (config.provider === 'vagon') {
            window.Vagon.emitUIInteraction(payload);
        } else if (config.provider === 'streampixel') {
            iframe.contentWindow.postMessage(payload, '*');
        }
    };

})();
