/* eslint-disable */
class Vagon {
  static _listeners = [];
  static _onInstallingListeners = [];
  static _onInstallationFailedListeners = [];
  static _onConnectedListeners = [];
  static _onDisconnectedListeners = [];
  static _onInactiveListeners = [];
  static _onFailedListeners = [];
  static _onSessionInformationListeners = [];
  static _onInitializationListeners = [];
  static _onPreparingAssetsListeners = [];
  static _onPreloadedFilesDownloadCompletedListerners = [];
  static _onSessionExpiredListeners = [];
  static _onPointerLockChangeListeners = [];
  static _onResponseListeners = [];
  static _qualities = ["standard", "moderate", "high"];

  static _connected = false;

  static start() {
    window.addEventListener("message", (evt) => {
      const vagonDomain = /^https?:\/\/(.*\.)?vagon.io$/;
      const localDomain = /^https?:\/\/localhost(:\d+)?$/;

      // Debug Log
      console.log("VagonSDK Debug: Received message", { origin: evt.origin, data: evt.data });

      if (!vagonDomain.test(evt.origin) && !localDomain.test(evt.origin)) {
        console.warn("VagonSDK Debug: Origin check failed", evt.origin);
        return;
      }

      if (!evt.data) {
        return;
      }

      if (typeof evt.data.startsWith !== "function") {
        return;
      }

      if (evt.data.startsWith("##vagon")) {
        switch (evt.data) {
          case "##vagonConnect":
            this._connected = true;
            return;
          case "##vagonDisconnect":
            this._connected = false;
            return;
          case "##vagonFOCUSIFRAME":
            this.focusIframe();
            return;
          case "##vagonONINSTALLING":
            this._onInstallingListeners.forEach((cb) => cb());
            return;
          case "##vagonONINSTALLATIONFAILED":
            this._onInstallationFailedListeners.forEach((cb) => cb());
            return;
          case "##vagonONCONNECTED":
            this._onConnectedListeners.forEach((cb) => cb());
            return;
          case "##vagonONDISCONNECTED":
            this._onDisconnectedListeners.forEach((cb) => cb());
            return;
          case "##vagonONINACTIVE":
            this._onInactiveListeners.forEach((cb) => cb());
            return;
          case "##vagonONFAILED":
            this._onFailedListeners.forEach((cb) => cb());
            return;
          case "##vagonONINITIALIZATION":
            this._onInitializationListeners.forEach((cb) => cb());
            return;
          case "##vagonONPREPARINGASSETS":
            this._onPreparingAssetsListeners.forEach((cb) => cb());
            return;
          case "#vagonONPRELOADEDFILESDOWNLOADCOMPLETED":
            this._onPreloadedFilesDownloadCompletedListerners.forEach((cb) => cb());
            return;
          case "##vagonONSESSIONEXPIRED":
            this._onSessionExpiredListeners.forEach((cb) => cb());
          case "##vagonONPOINTERLOCKENABLED":
            this._onPointerLockChangeListeners.forEach((cb) => cb(true));
            return;
          case "##vagonONPOINTERLOCKDISABLED":
            this._onPointerLockChangeListeners.forEach((cb) => cb(false));
            return;
          default:
            if (evt.data.startsWith("##vagonONSESSIONINFORMATION##")) {
              const data = evt.data.replace("##vagonONSESSIONINFORMATION##", "");
              const sessionInformation = JSON.parse(data);
              this._onSessionInformationListeners.forEach((cb) => cb(sessionInformation));
              return;
            } else if (evt.data.startsWith("##vagonPSRESPONSE##")) {
              const data = evt.data.replace("##vagonPSRESPONSE##", "");
              const psResponse = JSON.parse(data);
              this._onResponseListeners.forEach((cb) => cb(psResponse));
              return;
            }
            break;
        }
      }

      const event = { message: evt.data };

      this._listeners.forEach((cb) => cb(event));
    });
  }

  static onApplicationMessage(cb) {
    this._listeners.push(cb);
  }

  static onInstalling(cb) {
    this._onInstallingListeners.push(cb);
  }

  static onConnected(cb) {
    this._onConnectedListeners.push(cb);
  }

  static onDisconnected(cb) {
    this._onDisconnectedListeners.push(cb);
  }

  static onInactive(cb) {
    this._onInactiveListeners.push(cb);
  }

  static onFailed(cb) {
    this._onFailedListeners.push(cb);
  }

  static onInstallationFailed(cb) {
    this._onInstallationFailedListeners.push(cb);
  }

  static onSessionInformation(cb) {
    this._onSessionInformationListeners.push(cb);
  }

  static onInitialization(cb) {
    this._onInitializationListeners.push(cb);
  }

  static onPreparingAssets(cb) {
    this._onPreparingAssetsListeners.push(cb);
  }

  static onPreloadedFilesDownloadCompleted(cb) {
    this._onPreloadedFilesDownloadCompletedListerners.push(cb);
  }

  static onSessionExpired(cb) {
    this._onSessionExpiredListeners.push(cb);
  }

  static onPointerLockChange(cb) {
    this._onPointerLockChangeListeners.push(cb);
  }

  static onResponse(cb) {
    this._onResponseListeners.push(cb);
  }

  static sendApplicationMessage(msg) {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    if (msg.length > 64 * 1024) {
      console.error("Vagon SDK: Message size too high");
      return;
    }

    child.contentWindow.postMessage({ target: "vagon-streams-sdk", payload: msg }, "*");
  }

  static emitUIInteraction(descriptor) {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    const payload = `##EMITUIEVENT##${JSON.stringify(descriptor)}`;
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: payload }, "*");
  }

  static emitCommand(descriptor) {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    const payload = `##EMITCOMMANDEVENT##${JSON.stringify(descriptor)}`;
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: payload }, "*");
  }

  static get isConnected() {
    return this._connected;
  }

  static resizeFrame() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##RESIZE##" }, "*");
  }

  static focusIframe() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.focus();
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-asas", payload: "##FOCUSIFRAME##" }, "*");
  }

  static showKeyboard() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##SHOWKEYBOARD##" }, "*");
  }

  static hideKeyboard() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##HIDEKEYBOARD##" }, "*");
  }

  static enableGameMode() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##ENABLEGAMEMODE##" }, "*");
  }

  static disableGameMode() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##DISABLEGAMEMODE##" }, "*");
  }

  static keepAlive() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##KEEPALIVE##" }, "*");
  }

  static shutdown() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage({ target: "vagon-streams-sdk-internal", payload: "##SHUTDOWN##" }, "*");
  }

  static setQuality(quality) {
    if (!this._qualities.includes(quality)) {
      console.error("Vagon SDK: Invalid quality");
      return;
    }
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
    }
    child.contentWindow.postMessage(
      { target: "vagon-streams-sdk-internal", payload: `##SETQUALITY##${quality.toUpperCase()}` },
      "*",
    );
  }

  static getSessionInformation() {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage(
      { target: "vagon-streams-sdk-internal", payload: "##REQUESTSESSIONINFORMATION##" },
      "*",
    );
  }

  static setVideoVolume(volume) {
    const child = document.querySelector("#vagonFrame");
    if (!child) {
      console.error("Vagon SDK: No vagon iframe found");
      return;
    }
    child.contentWindow.postMessage(
      {
        target: "vagon-streams-sdk-internal",
        payload: {
          type: "##SETVOLUMEVALUE##",
          volume: volume,
        },
      },
      "*",
    );
  }
}

window.Vagon = Vagon;
window.Vagon.start();
