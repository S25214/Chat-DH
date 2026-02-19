
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
            console.log("Received 'unMuteAudio' command. SDK state:", sdk);
            if (sdk.UIControl) {
                console.log("Toggling audio via UIControl");
                try {
                    sdk.UIControl.toggleAudio();
                    console.log("Audio toggle called successfully");
                } catch (e) {
                    console.error("Error calling toggleAudio:", e);
                }
            } else {
                console.warn("UIControl not available for unMuteAudio. SDK keys:", Object.keys(sdk));
            }
        } else if (data.command === 'microphone') {
            if (sdk.pixelStreaming) {
                console.log("Toggling microphone via PixelStreaming");
                if (data.value) {
                    try {
                        await navigator.mediaDevices.getUserMedia({ audio: true });
                        console.log("Microphone access granted.");
                    } catch (e) {
                        console.error("Microphone access denied:", e);
                        return;
                    }
                }
                sdk.pixelStreaming.unmuteMicrophone(data.value);
            } else {
                console.warn("PixelStreaming not available for microphone");
            }
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
            StartVideoMuted: false,
            checkHoveringMouse: true,
            ...config
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

        // Manually mount the video element
        if (appStream && appStream.rootElement) {
            console.log("Mounting SDK root element...");
            streamContainer.appendChild(appStream.rootElement);
        } else {
            console.error("SDK did not return appStream.rootElement");
        }

        // Optional: Listen for Unreal responses
        if (pixelStreaming) {
            pixelStreaming.addResponseEventListener("handle_responses", (payload) => {
                console.log("Received from Unreal:", payload);
            });
        }

        // Wait for video to be ready before signalling parent
        waitForVideoReady();

    } catch (e) {
        console.error("SDK Init Error", e);
    }
}

function waitForVideoReady() {
    const maxAttempts = 600; // 60 seconds roughly (if 100ms interval)
    let attempts = 0;

    const interval = setInterval(() => {
        attempts++;
        const video = document.querySelector('video');

        // Check if video exists and has data
        if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA
            console.log("Stream Video detected and ready.");
            clearInterval(interval);

            // Notify parent
            window.parent.postMessage({ value: 'loadingComplete' }, '*');

            // Hide custom loader
            const loader = document.getElementById('custom-loader');
            if (loader) {
                loader.style.display = 'none';
            }
        }

        if (attempts >= maxAttempts) {
            console.warn("Timed out waiting for video stream.");
            clearInterval(interval);
            // Maybe signal failure? For now, we just stop checking.
        }
    }, 100);
}

