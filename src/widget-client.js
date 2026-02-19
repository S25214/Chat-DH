
import { StreamPixelApplication } from "streampixelsdk";

// Wait for load
window.addEventListener('DOMContentLoaded', () => {
    // We expect the streamUrl or ID to be passed via URL params or postMessage.
    // However, the iframe src is set initially without params perhaps.
    // The previous logic passed `streamUrl` as `src`.
    // Now `src` is `widget-client.html`. 
    // We can pass the streamId in the hash or query string.

    // Let's listen for an initialization message from the parent.
});

let sdk = null; // { pixelStreaming, appStream }


window.addEventListener('message', async (event) => {
    const data = event.data;
    if (!data) return;

    if (data.command === 'init_sdk') {
        const streamId = data.streamId;
        const config = data.config || {};
        initSDK(streamId, config);
    } else if (sdk && sdk.appStream && sdk.appStream.stream) {
        // Delegate commands to the SDK
        if (data.command === 'unMuteAudio') {
            sdk.UIControl.toggleAudio();
        } else if (data.command === 'microphone') {
            await navigator.mediaDevices.getUserMedia({ audio: data.value })
        } else {
            sdk.appStream.stream.emitUIInteraction({ ...data });
        }
    }
});

async function initSDK(streamId, config) {
    if (sdk) return;

    const streamContainer = document.getElementById('stream-container');
    // REMOVED: if (config.microphone) await navigator.mediaDevices.getUserMedia({audio:true});

    try {
        console.log("Initializing StreamPixel WebSDK with appId:", streamId);

        // SDK configuration
        const sdkConfig = {
            appId: streamId,
            AutoConnect: true,
            StartVideoMuted: true,
            checkHoveringMouse: true,
            useMic: true
        };

        const result = await StreamPixelApplication(sdkConfig);

        sdk = result;
        console.log("SDK Initialized:", sdk);
        console.log("SDK Keys:", Object.keys(sdk));
        if (sdk.UIControl) {
            console.log("SDK.UIControl is available");
        } else {
            console.warn("SDK.UIControl is MISSING");
        }

        const { appStream, pixelStreaming } = sdk;

        // Use SDK event for video initialization
        if (appStream) {
            appStream.onVideoInitialized = () => {
                console.log("SDK: onVideoInitialized triggered.");
                if (appStream.rootElement && !streamContainer.contains(appStream.rootElement)) {
                    streamContainer.appendChild(appStream.rootElement);
                }
                console.log("Stream Video detected and ready.");
                window.parent.postMessage({ value: 'loadingComplete' }, '*');
                const loader = document.getElementById('custom-loader');
                if (loader) loader.style.display = 'none';
            };
        }

        // Fallback: Manually mount if not handled by event (though event is preferred)
        if (appStream && appStream.rootElement && !streamContainer.contains(appStream.rootElement)) {
            console.log("Mounting SDK root element immediately (fallback)...");
            streamContainer.appendChild(appStream.rootElement);
        }

        // Optional: Listen for Unreal responses
        if (pixelStreaming) {
            pixelStreaming.addResponseEventListener("handle_responses", (payload) => {
                console.log("Received from Unreal:", payload);
            });
        }

    } catch (e) {
        console.error("SDK Init Error", e);
    }
}
// Removed waitForVideoReady polling function

