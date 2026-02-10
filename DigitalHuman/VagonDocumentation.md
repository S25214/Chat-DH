# Javascript SDK

You can use Streams JS SDK to send messages from the client side to your application.

Embed the script code between the `<head> </head>` tags inside the page you embedded your Streams Link via iframe.

```html
<script src="https://app.vagon.io/vagonsdk.js"></script>
```

{% hint style="info" %}
Despite you added the JS SDK script between the tags in your client code, if you can not establish a connection, please be sure that you copied the iFrame tag from the Vagon Streams dashboard.

If you manually created your iFrame code by adding your Streams Link, please check that you applied the id tag and other required iFrame properties correctly from the sample code below.

```html
<iframe id="vagonFrame" allow="microphone  *; clipboard-read *; clipboard-write *; encrypted-media *;" src="_Stream_URL_"/>
```

{% endhint %}

<figure><img src="https://957593864-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FaBZSLkY0LBQ4VmKzrByg%2Fuploads%2FGxvwlzEVvtVubLZd3dE3%2Fiframe.png?alt=media&#x26;token=bd901037-4f78-4e93-b1ff-6711882d12ae" alt=""><figcaption></figcaption></figure>

Then you will be able to use the JS methods to create your custom user experience for your application Stream.

**Demo HTML**

```html
<!DOCTYPE html>
<html>
	<head>
		<script src="https://app.vagon.io/vagonsdk.js"></script>
	</head>
	<body>
		<iframe id="vagonFrame" style="height:100vh; width: 100vw;" allow="microphone  *; clipboard-read *; clipboard-write *; encrypted-media *;" src="__Stream_URL__"/>
	</body>
</html>
```

## Unreal Engine Pixel Streaming EmitUI Messages

You can use both EmitUI and [Client Side Messaging](#client-side-integration-functions) functionalities for Unreal Engine Pixel Streaming enabled Stream links.

### emitUIInteraction

```javascript
window.Vagon.emitUIInteraction("payload")
```

### emitCommand

```javascript
window.Vagon.emitCommand("payload")
```

### onResponse

```javascript
function onResponse(data) {
  console.log(data)
}

window.Vagon.onResponse(onResponse);
```

## Client-side Integration Functions

Client-side Integration Functionalities and events have support for all types of Streaming you can use inside Vagon Streams.

### **isConnected**

```javascript
window.Vagon.isConnected()
```

Connection status, returns boolean.

### **sendApplicationMessage**

```javascript
window.Vagon.sendApplicationMessage("Hello My Application!") 
```

Sends the related message to your application.

### resizeFrame

```javascript
window.Vagon.resizeFrame()
```

Updates the streaming resolution and matches the iframe height and width when initiated.

### focusIframe

<pre class="language-javascript"><code class="lang-javascript"><strong>window.Vagon.focusIframe()
</strong></code></pre>

Keeps the browser window focused on the streaming iframe. In case you are facing issues with keyboard inputs, you can use this method.

### showKeyboard

```javascript
window.Vagon.showKeyboard()
```

If your visitors are using your Applications on mobile/tablet devices, you can also allow them to type with the on-screen keyboard inside Vagon Streams.&#x20;

### hideKeyboard

```javascript
window.Vagon.hideKeyboard()
```

When the focus changes from the text input, you can hide the on-screen keyboard button from the screen as well.&#x20;

### enableGameMode

```javascript
window.Vagon.enableGameMode()
```

Activates 360 View cursor mode inside an active Stream.

### disableGameMode

```javascript
window.Vagon.disableGameMode()
```

Disable 360 View cursor mode inside an active Stream.

### keepAlive

```javascript
window.Vagon.keepAlive()
```

Reset Idle Timer by sending a simulated user input when the Idle Duration Limit is active.

### shutdown

```javascript
window.Vagon.shutdown()
```

Shut down the Stream Machine and terminate the related session immediately.

### setQuality

```javascript
window.Vagon.setQuality(quality)
```

Quality parameters can be set as "standard", "moderate" or "high". Session will be refreshed automatically after the quality is set.

### getSessionInformation

```javascript
window.Vagon.getSessionInformation()
```

Triggers the `onSessionInformation` event, data must be collected via `onSessionInformation` event.

### setVideoVolume

```javascript
window.Vagon.setVideoVolume(0.5)
```

Set the sound of your Stream link between 0 to 1.

## Client-side Integration Events

*All events except onApplicationMessage, onConnected and onDisconnected are only available in Enterprise Plan.*

### **onApplicationMessage**

Prints out the message sent from the application, for application-side integration please check Unreal Engine and Unity SDKs.

```javascript
window.Vagon.onApplicationMessage(evt => {
	console.log(evt.message);
});
```

### onPointerLockChange

Prints out the message when the pointer lock (360 View Mode) state changes.

```javascript
window.Vagon.onPointerLockChange((locked) => {
    console.log(`Pointer Lock is Active: ${locked}`);
});
```

### onInitialization

Prints out the message during the Stream initialization process.

```javascript
window.Vagon.onInitialization(() => {
	console.log("Application is Initializing");
});
```

### onPreparingAssets

Prints out the message during the pixel streaming asset preparation process. Only available in Pixel Streaming enabled Streams.

```javascript
window.Vagon.onPreparingAssets(() => {
	console.log("Application is Preparing Assets");
});
```

### **onInstalling**

Prints out the message when application is on installing state.

```javascript
window.Vagon.onInstalling(() => {
	console.log("Application Installing");
});
```

### **onConnected**

Prints out the message when user is connected.

```javascript
window.Vagon.onConnected(() => {
	console.log("User Connected");
});
```

### **onDisconnected**

Prints out the message when user is disconnected.

```javascript
window.Vagon.onDisconnected(() => {
	console.log("User Disconnected");
});
```

### **onInactive**

Prints out the message when user is inactive. Only available when Idle Duration Limit is active.

```javascript
window.Vagon.onInactive(() => {
	console.log("User Inactive");
});
```

### **onInstallationFailed**

Prints out the message when app installation is failed.&#x20;

```javascript
window.Vagon.onInstallationFailed(() => {
	console.log("App Installation is Failed");
});
```

### **onFailed**

Prints out the message when connection is failed.&#x20;

```javascript
window.Vagon.onFailed(() => {
	console.log("Connection is Failed");
});
```

### onSessionInformation

Prints out the message when connection is failed.&#x20;

```javascript
window.Vagon.onSessionInformation((session_data) => {
	console.log(session_data);
});
```

**Sample Session Data**

```json
{
  "session": {
    ping: 150, // Available for Session Data Collection enabled Streams.
    os: "windows", // Available for Session Data Collection enabled Streams.
    device_type: "desktop", // Available for Session Data Collection enabled Streams.
  },
  "machine": {
    "status": "runinng",
    "friendly_status": "ready",
    "connection_status": "connected",
    "region": "dublin",
    "uid": "05545648-c292-4ef4-b571-d10797f83069",
    "application_id": 1,
    "stream_id": 1,
    "machine_id": 1,
    
  }
}
```
