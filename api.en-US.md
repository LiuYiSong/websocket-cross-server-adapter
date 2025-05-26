# Table of Contents
[中文版本](./api.zh-CN) 

- [WebSocketCrossServerAdapter](#websocketcrossserveradapter)
  - [Constructor(options)](#constructoroptions)
  - [onCrossServerEvent(event, listener, tag)](#oncrossserverevent-event-listener-tag)
  - [onceCrossServerEvent(event, listener, tag)](#oncecrossserverevent-event-listener-tag)
  - [offCrossServerEvent(event, listenerOrTag)](#offcrossserverevent-event-listenerortag)
  - [publishRedisMessage(channel, message)](#publishredismessagechannel-message)
  - [emitCrossServer(event, message, callback, options)](#emitcrossserverevent-message-callback-options)
  - [emitCrossServerWithPromise(event, message, options)](#emitcrossserverwithpromiseevent-message-options)
  - [deleteCrossServerCallback(callbackId)](#deletecrossservercallbackcallbackid)
  - [manualSubscribe(channel)](#manualsubscribechannel)
  - [manualUnsubscribe(channel)](#manualunsubscribechannel)
  - [setCustomChannelHandler(handler)](#setcustomchannelhandlerhandler)
  - [removeCustomChannelHandler()](#removecustomchannelhandler)
  - [addRedisInstance(config)](#addredisinstanceconfig)
  - [getHealthyRedisInstancesCount(type)](#gethealthyredisinstancescounttype)
  - [getRedisInstancesCount()](#getredisinstancescount)
  - [onWebSocketEvent(event, listener, tag)](#onwebsocketeventevent-listener-tag)
   - [System WebSocket Events](#system-websocket-events)
  - [onceWebSocketEvent(event, listener, tag)](#oncewebsocketeventevent-listener-tag)
  - [offWebSocketEvent(event, listenerOrTag)](#offwebsocketeventevent-listenerortag)
  - [broadcastToRoom(roomNamespace, roomId, event, data, options)](#broadcasttoroomroomnamespace-roomid-event-data-options)
  - [toSocketId(socketId, event, data)](#tosocketidsocketid-event-data)
  - [toSocketIds(socketIds, event, data)](#tosocketidssocketids-event-data)
  - [broadcast(event, data, localOnly)](#broadcastevent-data-localonly)
  - [joinRoom(roomNamespace, roomId, socketId)](#joinroomroomnamespace-roomid-socketid)
  - [leaveRoom(roomNamespace, roomId, socketId)](#leaveroomroomnamespace-roomid-socketid)
  - [removeRoom(roomNamespace,roomId)](#removeroomroomnamespace-roomid)
  - [getSocketCountInRoom(roomNamespace, roomId, options)](#getsocketcountinroomroomnamespace-roomid-options)
  - [getRoomSocketIds(roomNamespace, roomId, options)](#getroomsocketidsroomnamespace-roomid-options)
  - [getJoinedRooms(socketId, roomNamespace)](#getjoinedroomssocketid-roomnamespace)
  - [isJoinedRoom(socketId, roomNamespace, roomId)](#isjoinedroomsocketid-roomnamespace-roomid)
  - [getRoomCount(roomNamespace, options)](#getroomcountroomnamespace-options)
  - [getRoomIds(roomNamespace, options)](#getroomidsroomnamespace-options)
  - [setUserSocket(socketId, socket)](#setusersocketsocketid-socket)
  - [removeUserSocket(socketId)](#removeusersocketsocketid)
  - [getSocketInstance(socketId)](#getsocketinstancesocketid)
  - [getSocketClientCount()](#getsocketclientcount)
  - [getServerName()](#getservername)
  - [getWss()](#getwss)
  - [parseWsRequestParams(req, options)](#parsewsrequestparamsreq-options)

- [WebSocketConnector](#websocketconnector)
  - [constructor(options)](#constructoroptions-1)
  - [on(event, listener, tag)](#onevent-listener-tag)
  - [once(event, listener, tag)](#onceevent-listener-tag)
  - [off(event, listenerOrTag)](#offevent-listenerortag)
  - [emit(event, data, callback, options)](#emitevent-data-callback-options)
  - [emitWithPromise(event, data, options)](#emitwithpromiseevent-data-options)
  - [reconnect(repeatReset)](#reconnectrepeatReset)
  - [reconnecting()](#reconnecting)
  - [setPingInterval(newInterval, immediate)](#setpingintervalnewinterval-immediate)
  - [getPingInterval()](#getpinginterval)
  - [manualClose()](#manualClose)
  - [Events](#events)
  

# WebSocketCrossServerAdapter 

## Constructor(options)

### Description
The constructor for `WebSocketCrossServerAdapter`. This is used to initialize a WebSocket cross-server communication adapter with various configuration options.

### Parameters

- `options` `{Object}`: Configuration options for the adapter.

  - `serverName` `{string}`: (Required) A **globally unique identifier** for the current server node, used for cross-server communication and callback ID generation.

    Example values include `"us-east-1-node3"` or `"game-server-42"`.

    ### Description

    - Must be unique across all server nodes.
    - Recommended length is no more than **16** characters to avoid communication overhead.
    - The `serverName` is included in cross-server messages; longer names may impact communication efficiency.


  - `bridgePrefix` `{string}`: (Optional) Cross-server bridge channel prefix. Default is `'csbp:'`.

    **Description:**  
    This prefix is used to identify **all cross-server messages' Redis channels**.  
    All cross-server communications will use Redis channels with this prefix.  
    It is a key identifier that distinguishes cross-server messages from other messages, and must be consistent and unique across all server nodes.  
    **Note:** This value **must be different** from `wsPrefix` to avoid message collision and processing confusion.

  - `wsPrefix` `{string}`: (Optional) WebSocket channel prefix. Default is `'ws:'`.

    **Description:**  
    This prefix is used to mark Redis channels for WebSocket routing, specifically for managing client connection room messages.  
    Its role is to distinguish regular cross-server bridge messages (`bridgePrefix`) from WebSocket-based room communication messages.  
    Similarly, this value **must be different** from `bridgePrefix` to ensure the two types of messages do not get mixed on Redis channels.

    ⚠️ **Important Note**:  
    `bridgePrefix` and `wsPrefix` **cannot be the same**.  
    If both prefixes are set to the same value, cross-server messages and WebSocket room messages will be confused, potentially causing communication errors and data loss.

  - `wsOptions` `{Object}`: (Optional) WebSocket server configuration options.If this parameter is not provided, it indicates that the WebSocket service will not be started. 

    **Description**: This object contains configuration options for the WebSocket server. All WebSocket-related settings should be placed in this object. For more details, refer to the [ws official documentation](https://github.com/websockets/ws?tab=readme-ov-file).

    **Common Configuration Options**:

    - `noServer` `{boolean}`: Whether to use `noServer` mode. Default is `false`.

    - `server` `{Object}`: External provided HTTP/HTTPS server.

    - `port` `{number}`: WebSocket server port.


  - `serverPingInterval` `{number}`: (Optional) Interval at which the **server sends WebSocket protocol-level `ping` frames** to all connected clients. Default is `20000`.

    **Description**:  
    This interval (in milliseconds) controls how often the server sends low-level WebSocket `ping` frames to clients. These are **not application-level heartbeats**, but rather a mechanism provided by the WebSocket protocol itself to detect dead TCP connections.  
    When a client receives a `ping` frame, it will automatically respond with a `pong` frame. If the connection is broken, the absence of a `pong` allows the server to detect it and close the socket.  

    ⚠️ **Note**: Do **not** confuse this with custom heartbeat messages implemented in your application logic (e.g., a text string like `"ping"`). Those are client-initiated and used to detect logical disconnection.


  - `enterBackgroundCloseTime` `{number}`: (Optional) Timeout for forcibly closing the WebSocket connection after the client enters background mode. Default is `10000` (10 seconds).

    **Description**: This setting controls how long to wait (in milliseconds) after a client enters background mode before forcibly closing the WebSocket connection.  
    On iOS and Android, entering background is handled differently. You can monitor this event on the client side and notify the server with a timestamp.  
    If the client remains in background mode beyond this duration, the server can proactively close the connection.  
    If you do not need this feature, simply do not send background-enter events from the client.

  - `heartbeatStr` `{string}`: (Optional) Heartbeat string. Default is an empty string `''`.

    **Description**: The specific string the server listens for to recognize a heartbeat signal from the client.  
    This value **must be consistent** with the heartbeat payload sent by the client (e.g., via a `WebSocketConnector` class).  
    When the server receives a message matching this string, it replies with the same content as a heartbeat response.

  - `redisForcePing` `{boolean}`: (Optional) Whether to force-enable Redis ping health monitoring. Default is `true`.
  - `redisPingInterval` `{number}`: (Optional) Redis ping interval. Default is `5000`.
  - `redisPingTimeout` `{number}`: (Optional) Redis ping timeout. Default is `2000`.
  - `selectionStrategy` `{string}`: (Optional) Redis node selection strategy. Default is `'random'`. Possible values: `'random'`, `'round-robin'`, `'fastest'`.
  - `enableRedisDataCompression` `{boolean}`: (Optional) Whether to enable Redis data compression. Default is `true`.
  - `onRedisHealthChange` `{function}`: (Optional) Callback function triggered when Redis health status changes.
  - `onRedisSubscriptionError` `{function}`: (Optional) Callback function triggered when Redis subscription fails.
  - `presetRoomNamespaces` `{Array<string>}`: (Optional) Predefined WebSocket room namespaces.

    **Description**: Developers can predefine a set of WebSocket room namespaces, such as `"chat"`, `"game"`, `"group"`, etc.  
    These namespaces will be **automatically subscribed to Redis channels** during Redis initialization.  
    Alternatively, you can choose not to predefine them and instead subscribe to Redis channels **dynamically** when the client joins a room via `joinRoom`.  
    Namespace design should follow your business logic and room categorization strategy.

  - `autoUnsubscribe` `{boolean}`: (Optional) Whether to automatically unsubscribe from a room namespace's Redis channel when no clients remain in that namespace.  
    This only applies to non-predefined (non-preset) room namespaces.  
    Predefined rooms listed in `presetRoomNamespaces` are not affected and remain subscribed. Default is `true`.

  - `customChannels` `{Array<string>|string}`: (Optional) Custom Redis channel(s).

    **Description**: A set of custom-defined Redis channels intended for developer-specific use cases.  
    These channels will be **automatically subscribed** during Redis initialization.  
    You can register a **custom channel handler** to process messages from these channels as needed.  
    This allows you to implement custom cross-server communication logic beyond the built-in WebSocket/room-related features.

  - `redisConfig` `{Array<Object>}`: (Optional) Redis node configuration.

    **Description**: Configuration array for connecting to one or more Redis nodes.  
    Each object in the array should contain the connection options required by [ioredis](https://github.com/redis/ioredis),  
    such as `host`, `port`, `password`, `db`, `tls`, and others.  
    This configuration is used to establish both publisher and subscriber connections  
    for cross-server communication, health monitoring, and message routing.

---

## onCrossServerEvent(event, listener, tag)

### Description  
Registers a **cross-server event listener** to handle events broadcasted from other server nodes.

This method supports registering multiple listeners for the same event.  
Each time a remote server emits the event, all local listeners for that event will be executed.

> 💡 Note: This function is effective only when `enableCrossServer` is enabled.

### Parameters

- `event` `{string}`: Name of the cross-server event to listen for.
- `listener` `{Function}`: Event handler function that will be invoked with the broadcasted data.
- `tag` `{string|number}` [optional]: A custom tag to identify the listener for future removal.

### Returns

- `void`

---

## onceCrossServerEvent(event, listener, tag)

### Description  
Registers a **one-time cross-server event listener** that handles an event sent from other servers.  
The listener will be automatically removed after it is triggered once.

> 💡 Note: This function is effective only when `enableCrossServer` is enabled.

### Parameters

- `event` `{string}`: The name of the cross-server event to listen for.
- `listener` `{Function}`: The handler function to be called once when the event occurs.
- `tag` `{string|number}` [optional]: A custom tag to identify the listener for future removal.

### Returns

- `void`

---

## offCrossServerEvent(event, listenerOrTag)

### Description

Removes listeners for a cross-server event.  
- If `listenerOrTag` is a function, removes the matching listener function.  
- If `listenerOrTag` is a string or number, removes listeners with the matching tag.  
- If `listenerOrTag` is not provided, removes all listeners for the event.

### Parameters

- `event` `{string}`: The name of the event to remove listeners from.
- `listenerOrTag` `{Function|string|number}` [optional]: The listener function or tag to remove.

### Returns

- `void`

---

## publishRedisMessage(channel, message)

### Description

Publishes a message to a specified Redis channel, primarily used internally for cross-server broadcasts and WebSocket routing.  
Developers only need to call this method when sending messages to custom Redis channels. Otherwise, it is generally not necessary to call it directly.


### Parameters

- `channel` `{string}`: The Redis channel to publish to, must be a non-empty string.
- `message` `{Object}`: The message object to send, which will be converted to a string or compressed before sending.

### Returns

- `{boolean}`: Whether the publish operation was successful.

### Details

This method publishes a message to a specified Redis channel, supporting internal room broadcasts and custom channel communications.  
If cross-server functionality is not enabled, the publish will fail and return `false`.  
The message object is converted either to a string (using JSON.stringify) or compressed with notepack, depending on configuration.  
If no healthy Redis instance is available or conversion fails, the publish fails.  
Returns `true` if published successfully, otherwise `false`.

---

## emitCrossServer(event, message, callback, options)

### Description

Sends event messages to target servers, supporting both broadcast and targeted sending.  
This method supports a request-response mechanism with a callback function, where in broadcast mode the callback is invoked for each target server’s response.  
The callback is called every time a target server responds, with the callback parameter including how many expected responses are still pending.  
If all expected responses are received or the timeout is reached, the callback is triggered to notify the caller.  
Messages are processed locally first (if applicable), then forwarded to other servers via Redis channels.  
If cross-server functionality is disabled or parameters are invalid, the method returns immediately without sending.

### Parameters

- `event` `{string}`: Event name, must not be an empty string.
- `message` `{Object}`: The message payload to send.
- `callback` `{Function}` (optional): Callback function to handle responses from target servers, invoked multiple times.
- `options` `{Object}` (optional): Configuration object.
  - `targetServer` `{string|string[]}` (default `[]`): Target server(s) to send to; empty array or string means broadcast to all servers.
  - `timeout` `{number}` (default `5000` ms): Callback timeout; triggers one final callback on timeout.
  - `expectedResponses` `{number}` (default is 1 for broadcast, or number of target servers for targeted send): Expected number of server responses.
  - `exceptSelf` `{boolean}` (default `false`): Whether to exclude the current server from handling the message during broadcast.  
  This parameter only takes effect when performing a global broadcast, i.e., when `targetServer` is an empty array (`[]`).  
  If `targetServer` specifies one or more servers, `exceptSelf` is ignored and the current server will handle the message if included.

### About `expectedResponses`

In broadcast mode (`targetServer` is `[]`), the system cannot automatically determine the total number of active server nodes in the cluster.  
Originally, this was solved by statically registering all server names in advance. However, this approach proved to be inflexible and difficult to maintain—especially when server nodes are added or removed dynamically.

To address this, we leave the management of the server list to the developer.  
When broadcasting a message, the developer is expected to provide the `expectedResponses` value, which indicates how many server responses are expected for the callback.  
This design makes the system **more flexible and scalable**, allowing server clusters to expand or shrink without requiring central coordination.

> In point-to-point mode (when `targetServer` is a specific list), `expectedResponses` is automatically set to the number of target servers.

### Returns

- `void`: No return value.

### Details

This method is a core interface for cross-server event sending, supporting sending to specific servers or broadcasting to all.  
The callback function is invoked every time a target server responds, and receives a parameter object including:

- `success` `{boolean}`: Whether the current response was successful.
- `data` `{Object}`: The data returned from the target server (on success).
- `remainingResponses` `{number}`: The count of expected responses still pending.
- `error` `{string}` (on failure): Error message.
- `callbackId` `{string}`: Unique ID identifying this callback instance.
- `unrespondedCount` `{number}` (on timeout): Number of servers that did not respond.

When all expected responses have been received or the timeout occurs, the callback is triggered one last time to notify the caller.  
In broadcast mode, the current server also handles the message unless `exceptSelf` is set to `true`.  
For targeted sends, the expected response count defaults to the number of target servers; for broadcasts it defaults to 1 unless overridden.  
Messages are first handled locally if applicable, then published to other servers through Redis channels.  
If cross-server feature is disabled or the message is invalid, the method returns immediately without action.


### Example

```js

adapter.emitCrossServer(
  'updateGameState',  // Event name
  { state: 'levelUp', level: 5 },  // Message payload
  (response) => {  // Callback, may be invoked multiple times
    if (response.success) {
      console.log(`Received response from a server, remaining unresponded count: ${response.remainingResponses}`);
      console.log('Response data:', response.data);

      // Important:
      // response.data.callbackId contains the unique callback ID for this request.
      // You can use this with your business logic to determine if enough servers have responded.
      // If so, call this.deleteCrossServerCallback(callbackId) to proactively remove the callback,
      // so no further responses will trigger the callback.
      // Otherwise, you can leave it alone and the system will clean it up after timeout.
      // - response.data.senderServer indicates which server sent the response.Useful for identifying the source of each response in a multi-server broadcast.
    } else {
      console.error('Broadcast callback failed or timed out:', response.error);
      console.error('Unresponded server count:', response.unrespondedCount);
    }
  },
  { timeout: 3000, expectedResponses: 3 }  // 3 seconds timeout, expecting 3 server responses
  // By default, omitting targetServer or setting it to [] indicates broadcast mode.
  // In broadcast mode, expectedResponses specifies the expected number of responding servers (must be set manually),
  // otherwise it will default to 1.
  // If targetServer is set (e.g., ['serverA','serverB']), it means targeted messaging.
  // In that case, expectedResponses is optional and will default to the number of target servers.
);

```

### Additional Tip: Identify Responding Server

Each callback response includes the field `response.data.senderServer`,  
which indicates **which server** the response came from.

This allows developers to:

- Track which servers have responded
- Match responses with custom business logic
- Dynamically decide whether to early-terminate the callback (e.g., via `deleteCrossServerCallback(callbackId)`)

---

## emitCrossServerWithPromise(event, message, options)

### Description

Emit a cross-server event and return a promise that resolves when all expected responses are received or the timeout is reached.

This method allows sending a message to one or more servers (or broadcasting), and waiting for responses from the target servers. It uses a promise-based approach for cleaner async handling.

### Parameters

- `event` `{string}`  
  The event name to emit.

- `message` `{Object}`  
  The payload to send along with the event.

- `options` `{Object}` (optional)  
  Additional configuration options.

  - `targetServer` `{string|string[]}` (default `[]`)  
    Target server(s) to send the message to. Empty array or omitted means broadcasting to all servers.

  - `timeout` `{number}` (default `5000`)  
    Timeout in milliseconds to wait for responses before resolving with failure.

  - `expectedResponses` `{number}` (default `1`)  
    Number of expected responses. For broadcasts, must be specified explicitly or will default to 1.  
    For specific targets, automatically set to target count.

  - `exceptSelf` `{boolean}` (default `false`)  
    When broadcasting, excludes the current server from handling the event if true.

### Returns

  `Promise<Object>` — Resolves with:

  - On success (all expected responses received):
    ```js
    {
      success: true,
      responses: { [serverName]: responseData, ... }
    }
    ```
  - On timeout:

    ```js
    {
      success: false,
      message: 'Cross-server callback timed out.',
      responses: { [serverName]: responseData, ... },
      unrespondedCount: number
    }
    ```
### Note

  This function differs from `emitCrossServer` in that it returns a Promise which resolves **only after all expected responses have been received** or the timeout is reached. 

  Unlike `emitCrossServer`, which invokes the callback immediately each time a server responds, `emitCrossServerWithPromise` waits for **all** responses before resolving the Promise.

### Example Code

  ```js
  // Broadcast mode, wait for 3 server responses, 3 seconds timeout
  adapter.emitCrossServerWithPromise(
    'syncPlayerData',                  // Event name
    { playerId: 123, score: 4567 },   // Message payload
    { timeout: 3000, expectedResponses: 3 } // Options: 3 seconds timeout, expect 3 responses
  ).then(result => {
    if (result.success) {
      console.log('All servers responded:', result.responses);
    } else {
      console.warn('Some servers did not respond, timed out or failed', result.unrespondedCount);
      console.log('Responses received:', result.responses);
    }
  });
  ```

  ```js
  async function syncData() {
    const result = await adapter.emitCrossServerWithPromise(
      'syncPlayerData',                  // Event name
      { playerId: 123, score: 4567 },   // Message payload
      { timeout: 3000, expectedResponses: 3 } // Options: 3 seconds timeout, expect 3 responses
    );

    if (result.success) {
      console.log('All servers responded:', result.responses);
    } else {
      console.warn('Some servers did not respond, timed out or failed', result.unrespondedCount);
      console.log('Responses received:', result.responses);
    }
  }

  syncData();
  ```
---

## deleteCrossServerCallback(callbackId)

### Description

Manually delete a cross-server callback by its ID.

### Parameters

- `callbackId` `{string}`: The ID of the callback to remove.

### Returns

- `{boolean}`: Returns true if the callback existed and was removed; otherwise false.

### Usage Scenario  

When using `emitCrossServer` for global broadcasting with a registered callback, developers can manually delete the callback based on the results and expected responses. If not deleted manually, the system will automatically clear the callback after the set timeout if the expected server responses are not fully collected.

Therefore, developers should call this method at an appropriate time according to their business logic. After deletion, any subsequent server responses related to this callback will no longer be received or processed.

---

## manualSubscribe(channel)

### Description

Subscribe manually to a specific Redis channel.

### Parameters

- `channel` `{string}`: The name of the Redis channel to subscribe to.

### Returns

- `void`

---

## manualUnsubscribe(channel)

### Description

Unsubscribe manually from a specific Redis channel.

### Parameters

- `channel` `{string}`: The name of the Redis channel to unsubscribe from.

### Returns

- `void`

---

## setCustomChannelHandler(handler)

### Description

Sets the custom channel message handler function.

### Parameters

- `handler` `{Function}`: The custom message handler function.

### Returns

- `void`

---

## removeCustomChannelHandler()

### Description

Removes the custom channel message handler function.

### Parameters

None.

### Returns

- `void`

---

## addRedisInstance(config)

### Description

Add a Redis instance and optionally start a health check mechanism based on the configuration.

This function allows dynamically adding new Redis nodes (publisher and subscriber) to the system and sets up related event listeners and message handlers. If multiple Redis instances exist and either:

1. `redisForcePing` is enabled, or  
2. `selectionStrategy` is set to `'fastest'`

then a ping timer is started to periodically ping all Redis nodes to monitor their health status. The actual publishing of messages is determined by the configured selection strategy.

### Parameters

- `config` `{object}`: Redis client connection configuration object.

### Returns

- `void`

---

## getHealthyRedisInstancesCount(type)

### Description

Gets the count of healthy Redis instances of a specified type.

This method filters all Redis instances by the specified type ('publisher' or 'subscriber'), checks their health status (`isHealthy`), and returns the number of healthy instances.

### Parameters

- `type` `{string}`: The type of Redis instance to count. Must be either `'publisher'` or `'subscriber'`.

### Returns

- `{number}`: The count of healthy Redis instances of the specified type.

---

## getRedisInstancesCount()

### Description

Returns the total number of Redis instances currently managed.

### Parameters

None

### Returns

- `{number}`: The total count of Redis instances.

---

## onWebSocketEvent(event, listener, tag)

### Description
Registers a listener for a specific WebSocket event.  
You can register handlers for the built-in system events to process system-level WebSocket events:

### System WebSocket Events
- `connection`: Triggered when a client connects. Callback parameters: `(socket, req)`
- `close`: Triggered when a client disconnects. Callback parameters: `(socket, req, code, reason)`
- `error`: Triggered when a client error occurs. Callback parameters: `(socket, req, error)`
- `pong`: Triggered when a client responds to a server ping frame. Callback parameters: `(socket, req)`
- `message`: Triggered when a client message is received. Callback parameters: `(socket, message)`
- `client-ping`: Triggered when a client sends an active ping message. Callback parameters: `(socket)`
- `server-error`: Triggered when the WebSocket server encounters an error. Callback parameters: `(err)`
- `listening`: Triggered when the WebSocket server starts listening.
- `ws-server-close`: Triggered when the WebSocket server closes.

### Parameters
- `event` {string|number} — The name of the event to listen for.
- `listener` {Function} — The callback function to be invoked when the event is triggered.
- `tag` {string|number} [optional] — A custom tag to identify the listener for future removal.

### Returns
- void

---

## onceWebSocketEvent(event, listener, tag)

### Description
Registers a listener that will only be triggered once for a specific WebSocket event.

### Parameters
- `event` {string|number} — The name of the event to listen for.
- `listener` {Function} — The callback function to be invoked when the event is triggered.
- `tag` {string|number} [optional] — A custom tag to identify the listener for future removal.

### Returns
- void

---

## offWebSocketEvent(event, listenerOrTag)

### Description
Removes a listener from a specific WebSocket event.  
- If `listenerOrTag` is a function, removes the corresponding listener function.  
- If it is a string or number, removes listeners matching that tag.  
- If omitted, removes all listeners for the event.

### Parameters
- `event` {string|number} — The name of the event to remove listeners from.
- `listenerOrTag` {Function|string|number} [optional] — The listener function or tag to remove. If omitted, all listeners for the event will be removed.

### Returns
- void

---

## broadcastToRoom(roomNamespace, roomId, event, data, options)

### Description
Broadcasts a message to all WebSocket clients in a specific room.
- If `options.localOnly` is true, only broadcast to local clients.
- You can exclude specific clients using `options.excludeSocketIds`.
- If `options.localOnly` is false, broadcast via Redis across servers.
- If `options.roomDstroy` is true, destroy the room immediately after broadcasting.

### Parameters
- `roomNamespace` {string} - The room namespace (e.g., 'chat', 'gameRoom').
- `roomId` {string} - The specific room ID within the namespace.
- `event` {string} - The name of the event to broadcast.
- `data` {Object} - The message data to be sent to the room.
- `options` {Object} [optional] - Additional optional parameters.
  - `excludeSocketIds` {string[]} [optional, default=[]] - List of socketIds to exclude from receiving the message.
  - `localOnly` {boolean} [optional, default=false] - Whether to only broadcast to local clients.
  - `roomDstroy` {boolean} [optional, default=false] - Whether to delete the room after local broadcast.

### Returns
- `void`

---

## toSocketId(socketId, event, data)

### Description
Sends a message to a specific player identified by their WebSocket `socketId`.  
- If the WebSocket service is disabled, the message will not be sent.  
- If the player is connected locally, the message is sent directly.  
- Otherwise, the message is published via Redis for cross-server delivery.  


### Parameters
- `socketId` {string} - The WebSocket socketId of the player. Must be a non-empty string.
- `event` {string} - The event name to be sent.
- `data` {Object} - The message data to be sent. 

### Returns
- `void`

---

## toSocketIds(socketIds, event, data)

### Description
Sends a message to multiple players identified by their WebSocket `socketIds`.  
- If the WebSocket service is disabled, the operation is skipped.  
- Messages are sent directly to locally connected players.  
- For players not connected locally, the message is published via Redis for cross-server delivery.

### Parameters
- `socketIds` {Array<string>} - Array of WebSocket socketIds for the players.
- `event` {string} - The event name to be sent.
- `data` {Object} - The message data to be sent.

### Returns
- `void`

---

## broadcast(event, data, localOnly)

### Description
Broadcasts a message to all connected WebSocket clients.  
- If `localOnly` is true, broadcasts only to local clients.  
- If `localOnly` is false or omitted, the message is also published to Redis for cross-server broadcasting.  
- Skips operation if WebSocket service is disabled.

### Parameters
- `event` {string} - The event name to broadcast.
- `data` {Object} - The message data to be broadcasted.
- `localOnly` {boolean} [optional] - Whether to broadcast only locally. Default is `false`.

### Returns
- `void`

---

## joinRoom(roomNamespace, roomId, socketId)

### Description  
Adds the specified `socketId` to a given room, manages the local membership, and ensures cross-server synchronization via Redis subscription.

- The `roomNamespace` parameter defines the granularity and category of the room. Developers can customize the naming convention freely, for example, using hierarchical formats like `app:chat:game:hot` to represent different room types or levels.  
- **Note:** To ensure that clients in the room on the local server can receive messages, the server **must subscribe** to the corresponding Redis channel for that `roomNamespace`.  
- It is recommended to pre-subscribe to required channels by setting them in the `presetRoomNamespaces` option of the adapter constructor, or rely on the built-in auto-subscription logic within this method.  
- The subscription process includes internal checks to avoid duplicate subscriptions.

### Parameters  
- `roomNamespace` `{string}` – The namespace of the room, used to categorize and define the room granularity, e.g., `app:chat`, `game:hot`, etc. **The corresponding Redis channel must be subscribed for local clients to receive messages.**  
- `roomId` `{string}` – A unique identifier for the room under the given namespace.  
- `socketId` `{string}` – The socketId of the player to be added to the room.

### Returns  
- `void`

---

## leaveRoom(roomNamespace, roomId, socketId)

### Description  
Removes the specified socketId from a specific room and updates the local membership data structure.

- `roomNamespace` is the namespace of the room.  
- When a room under the namespace becomes empty, it will be deleted.  
- When there are no rooms left under the namespace, the namespace will also be removed.  
- The server will decide whether to automatically unsubscribe from the corresponding Redis channel based on the `autoUnsubscribe` option configured in the adapter constructor, helping reduce unnecessary message reception.  
- The local mapping of socketId to rooms is updated accordingly to keep the internal state consistent.

### Parameters  
- `roomNamespace` {string} - The room namespace to remove the socketId from.  
- `roomId` {string} - The unique identifier of the room to leave.  
- `socketId` {string} - The socketId of the player leaving the room.

### Returns  
- `void`

---

## removeRoom(roomNamespace,roomId)

### Description
Removes the specified room and cleans up all socketId mappings related to the room.

This method will:  
- Remove all socketIds from the specified room.  
- Clean up the mapping from each socketId to this room under the given roomNamespace.  
- Delete the room entry from the global room map.  
- If the roomNamespace no longer contains any rooms after removal, it will also be deleted.

**Note:**  
- This does NOT handle Redis channel unsubscription; if needed, manage that separately.  
- Use this method when you want to completely delete a room and clean all related references.

### Parameters
- `roomNamespace {string}`: The room namespace (type/category).
- `roomId {string}`: The unique identifier of the room to remove.

### Returns
- `void`

---

## getSocketCountInRoom(roomNamespace, roomId, options)

### Description
Get the user count in a specified room or room namespace.

- If `roomId` is provided, counts users in that specific room.  
- If `roomId` is not provided, counts users in all rooms under the given namespace.  
- Supports exact or fuzzy matching by roomId prefix.

### Parameters
- `roomNamespace {string}`: The room namespace (e.g., 'chat', 'gameRoom').
- `roomId {string} [optional]`: The specific room ID to count users in.
- `options {Object} [optional]`: Matching options.
  - `exactMatch {boolean} [default=true]`: Whether to perform exact match or fuzzy match (prefix match).

### Returns
- `number`: The count of sockets/users in the matched room(s).

---

## getRoomSocketIds(roomNamespace, roomId, options)

### Description
Retrieves all socket IDs in rooms under a given room namespace, optionally filtered by roomId.

- If `roomId` is provided, returns socket IDs in the exact or fuzzy matched room(s).  
- If `roomId` is not provided, returns socket IDs of all rooms under the namespace.

### Parameters
- `roomNamespace {string}`: The room namespace to query.
- `roomId {string|null} [optional]`: The room ID to filter by.
- `options {Object} [optional]`: Options object.
  - `exactMatch {boolean} [default=true]`: Whether to use exact or fuzzy matching.

### Returns
- `Set<string>`: A set of socket IDs in the matched rooms.

---

## getJoinedRooms(socketId, roomNamespace)

### Description
Get the rooms the specified socketId has joined, optionally filtered by room namespace prefix.

- Returns a Map where keys are room namespaces and values are sets of room IDs.  
- If `roomNamespace` is provided, only returns rooms whose namespace starts with the prefix.

### Parameters
- `socketId {string}`: The socket ID to query.  
- `roomNamespace {string|null} [optional]`: Room namespace prefix to filter by (default: null, no filtering).

### Returns
- `Map<string, Set<string>>`: A map of room namespaces to sets of room IDs that the socket has joined.

---

## isJoinedRoom(socketId, roomNamespace, roomId)

### Description
Check whether the specified socketId has joined a room or any room under a room namespace.

- If `roomId` is provided, checks if the socket has joined that specific room.  
- If `roomId` is not provided, checks if the socket has joined any room under the room namespace.

### Parameters
- `socketId {string}`: The socket ID to check.  
- `roomNamespace {string}`: The room namespace prefix to check under.  
- `roomId {string} [optional]`: The specific room ID (optional).

### Returns
- `boolean`: Returns `true` if the socket has joined the specified room or room namespace, otherwise `false`.

---

## getRoomCount(roomNamespace, options)

### Description
Get the number of rooms under the specified room namespace.

- If `options.exactMatch` is `true`, returns the count of rooms exactly matching the given `roomNamespace`.  
- If `false`, returns the count of all rooms whose namespaces start with the given `roomNamespace`.

### Parameters
- `roomNamespace {string}`: The room namespace prefix.  
- `options {object}`: Matching options.  
  - `exactMatch {boolean}`: Whether to perform exact match. Defaults to `true`.

### Returns
- `{number}`: The number of matching rooms.

---

## getRoomIds(roomNamespace, options)

### Description
Get the list of room IDs under the specified room namespace.

- If `options.exactMatch` is `true`, only room IDs exactly matching the `roomNamespace` are returned.  
- If `false`, all room IDs under namespaces starting with the given `roomNamespace` are returned.

### Parameters
- `roomNamespace {string}`: The room namespace prefix.  
- `options {object}`: Matching options.  
  - `exactMatch {boolean}`: Whether to perform exact match. Defaults to `true`.

### Returns
- `{string[]}`: An array of matching room IDs.

---

## setUserSocket(socketId, socket)

### Description
Adds a user-socket mapping.

**Important Note:**  
Client message sending mainly depends on the mapping from `socketId` to `socket`.  
Please ensure to authenticate the user after the WebSocket connection is established or the protocol is upgraded, then use this method to set the mapping between the user's `socketId` and the `socket` instance.  

Correspondingly, when the client disconnects, the mapping from `socketId` to the `socket` instance should be promptly removed to avoid resource leaks and inconsistent states.  

`socketId` must be a string and globally unique across all server nodes, such as a user’s unique ID. Since the adapter uses a `Set()` to store socketId mappings, numeric socketIds—even if equal in value—will be treated as different keys, causing duplicates or mapping errors.  
Therefore, if you use numeric IDs, you must convert them to strings before storing to ensure uniqueness and correctness.
**All socketIds in this class must follow this convention.**

### Parameters
- `socketId {string}`: The user's socket ID (must be a non-empty string).
- `socket {Object}`: The WebSocket connection object.

### Throws
- Throws an error if `socketId` is not a string or if `socket` is falsy.

---

## removeUserSocket(socketId)

### Description
Removes a user-socket mapping, cleaning up related room mappings.
This method should be called when the client disconnects to properly clear the socketId to socket mapping and associated resources.

### Parameters
- `socketId {string}`: The user's socket ID (must be a non-empty string).

### Throws
- Throws `TypeError` if `socketId` is not a string.

---

## getSocketInstance(socketId)

### Description
Gets the WebSocket instance for a given socket ID.

### Parameters
- `socketId {string}`: The user's socket ID (must be a non-empty string).

### Returns
- `WebSocket|null`: The WebSocket instance if found, otherwise null.

### Throws
- Throws `TypeError` if `socketId` is not a string.

---

## getSocketClientCount()

### Description
Get the total number of clients connected on the current server node.

### Returns
- `number`: The count of connected clients.

---

## getServerName()

### Description  
Get current server name.

### Parameters  
None

### Returns  
- `string`: The current server name.

---

## getWss()

### Description  
Get the WebSocket server instance.

### Parameters  
None

### Returns  
- `WebSocket.Server | null`: Returns the WebSocket server instance if initialized; otherwise, returns null.

---

## parseWsRequestParams(req, options)

### Description  
Parse URL and headers parameters from a WebSocket request.

- Parses query parameters from the request URL.
- Supports options to control parsing behavior such as case conversion and path extraction.
- **Note:** This parsing relies on the client using the `WebSocketConnector` class and passing parameters according to the agreed convention, otherwise parsing results may be incomplete or incorrect.

### Parameters  
- `req {object}`: WebSocket request object.  
- `options {object} [optional]`: Parsing options.  
  - `autoLowerCaseKeys {boolean} [default=false]`: Whether to convert parameter keys to lowercase automatically.  
  - `parsePath {boolean} [default=true]`: Whether to parse and return the request path.  
  - `autoRemoveLeadingSlash {boolean} [default=true]`: Whether to remove leading slash from the parsed path.

### Returns  
- `{object}` Parsed result object containing:  
  - `params {object}`: Parsed URL query parameters.  
  - `path {string|null}`: Parsed URL path without leading slash (if enabled).Example: For a URL like `ws://localhost:8080/chat`, the path name `chat` can be extracted for routing or type identification.

---

# WebSocketConnector

## constructor(options)

### Description  
Initialize the WebSocket client instance with custom configuration options.

### Parameters  
- options {Object}: Configuration options  
  - url {string}: Full WebSocket connection URL, must start with `ws://` or `wss://`, e.g., `ws://127.0.0.1:8081`  
  - pingInterval {number}: Interval in ms to send a ping message (default: `10000`)  
  - pongTimeout {number}: Timeout in ms to wait for pong after sending ping (default: `2000`)  
  - fastReconnectThreshold {number}: Maximum number of fast retry attempts (default: `3`)  
  - fastReconnectInterval {number}: Time interval between attempts during the fast reconnection phase (default: `3000`)  
  - reconnectMaxInterval {number}: Maximum interval between reconnection attempts after exponential backoff (default: `120_000`)  
  - pingMsg {string}: Message to send with ping (default: `""`)  
  - callbackTimeout {number}: Timeout for callback and Promise-style responses (default: `5000`)  
  - repeatLimit {number|null}: Max number of total reconnection attempts (default: `null` for unlimited)  
  - pendingTimeout {number}: Time before triggering "pending" callback (default: `100`)  
  - customParams {Object}: Custom parameters to pass (key-value pairs)

### Example
  ```js
  const client = new WebSocketConnector({
    url: 'ws://localhost:9000/chat',
    customParams: {
      name: 'sam',
      id: 888
    }
  });
  ```
---

## on(event, listener, tag)

### Description  
Registers an event listener that will be executed whenever the specified event is triggered.

### Parameters  
- event {string}: Name of the event to listen for  
- listener {function}: Callback function to execute when the event is triggered  
- tag {string|number} [optional]: A custom tag to identify the listener for future removal

## Returns
- `void`

---

## once(event, listener, tag)

### Description  
Registers a one-time event listener that will be triggered only once and then automatically removed.

### Parameters  
- event {string}: Name of the event to listen for  
- listener {function}: Callback function to execute once when the event is triggered  
- tag {string|number} [optional]: A custom tag to identify the listener for future removal

## Returns
- `void`

---

## off(event, listenerOrTag)

### Description  
Removes previously registered event listeners for a given event.

- If `listenerOrTag` is a function, removes the matching listener function.  
- If `listenerOrTag` is a string or number, removes listeners with the matching tag.  
- If `listenerOrTag` is not provided, removes all listeners for the event.

### Parameters  
- event {string}: Name of the event whose listener(s) should be removed  
- listenerOrTag {function|string|number} [optional]: The listener function or tag to remove

## Returns
- `void`

---

## emit(event, data, callback, options)

### Description  
Sends an event and data to the WebSocket server, with optional support for response callback and pending handling.

This function checks whether the WebSocket is open before sending data.  
If a callback is provided, a unique callback ID is generated and attached to the data, and the callback is registered.  
You may also define an optional "pending" function that triggers if the response is delayed.

### Parameters  
- event {string}: The name of the event to emit.  
- data {Object}: The payload data to send with the event.  
- callback {function} (optional): Callback function to be invoked when a response is received.  
- options {Object} (optional): Additional settings for callback behavior.  
  - options.callbackTimeout {number} (optional): Timeout for the callback in milliseconds.  
  - options.onPending {function} (optional): Function called if the server delays response beyond `pendingTimeout`.  
  - options.pendingTimeout {number} (optional): Duration before `onPending` is triggered.

## Returns
- `void`

### Example

  ```js
  // Emit the 'say' event to the server with a message payload,
  // along with a result callback to handle the response or error,
  // and an optional onPending handler for delayed response indication.

  client.emit('say', { msg: 'Hi server' }, (err, data) => { 
    if (err) { 
      console.error('Received error:', err);
    } else {
      console.log('Received response:', data);
    }
  }, {
    onPending: () => { 
      console.log('Pending... waiting for response');
    }
  });

  // Example err object:
  // {
  //   error: 'WebSocket is not open',      // Error message for debugging and logging
  //   errorCode: 'WS_NOT_OPEN'              // Error code used for programmatic handling
  // }
  // Or:
  // {
  //   error: `Is callback timeout: ${callbackId}`,  // Callback timeout description
  //   errorCode: 'CALLBACK_TIMEOUT'                   // Timeout error code
  // }
  ```
---

## emitWithPromise(event, data, options)

### Description  
Sends event data to the WebSocket server and returns a `Promise` that resolves with the response or error.

If the WebSocket is connected, it registers a callback with a unique `callbackId` and sends the event.  
Supports configurable timeout and a pending handler that executes before timeout.  
If the connection is invalid, the promise resolves immediately with an error.

### Parameters  
- event {string}: The name of the event to emit.  
- data {Object}: The data payload to be sent with the event.  
- options {Object} (optional): Additional options to configure the behavior.  
  - options.onPending {function} (optional): Function to invoke before timeout if the response is delayed.  
  - options.pendingTimeout {number} (optional): Delay before invoking `onPending` (in milliseconds).  
  - options.callbackTimeout {number} (optional): Timeout duration for the response (in milliseconds).

### Returns  
- `Promise<Object>`: Resolves with the server response or an error object.

### Example

  ```js
  // Emit the 'say' event to the server with a message payload,
  // and use the Promise-based interface to handle the result.
  // Also supports an onPending callback for indicating delayed response.

  client.emitWithPromise('say', { msg: 'Hi server' }, {
    onPending: () => { 
      console.log('requesting...')
    }
  }).then((result) => {
    if (result.success) {
      console.log('Received response:', result.data);
    } else {
      console.error('Received error:', result.error, result.errorCode);
    }
  })

 
  // Use async/await to emit the 'say' event with a message payload and an onPending handler.
  // Errors are captured as result.success === false, not as thrown exceptions.

  const result = await client.emitWithPromise('say', { msg: 'Hi server' }, {
    onPending: () => {
      // Called if the server response is delayed
      console.log('requesting...');
    }
  });

  if (result.success) {
    // Handle successful response
    console.log('Received response:', result.data);
  } else {
   // Handle failed response (not an exception), e.g., timeout or business error
    console.error('Received error:', result.error, result.errorCode);
  }

  // errorCode: The error code used to identify the type of error.
  // Common error codes include but are not limited to:
  // - 'WS_NOT_OPEN'      means the WebSocket connection is not open.
  // - 'CALLBACK_TIMEOUT' means the callback response timed out.
  // error: The corresponding descriptive error message string for debugging and logging.

  ```
---

## reconnect(repeatReset)

### Description  
Manually starts the WebSocket reconnection process.

### Parameters  
- repeatReset {boolean} (optional): Whether to reset the current retry count before attempting to reconnect. default is false

## Returns
- `void`

---

## reconnecting()

### Description  
Determines whether the WebSocket is currently in the process of automatic reconnection.

This method checks the internal retry count. If `repeat > 0`, it indicates that reconnection attempts are ongoing.

### Parameters  
None

### Returns  
- `boolean`: Returns `true` if the WebSocket is reconnecting; otherwise `false`.

---

## setPingInterval(newInterval, immediate)

### Description  
Dynamically sets the heartbeat ping interval for the WebSocket connection.  
This allows you to adjust the ping frequency in real-time based on application context (e.g., lower frequency for idle views, higher for active interaction).

If `immediate` is `true` and the connection is active, the existing heartbeat timer will be cleared and restarted immediately using the new interval.

### Parameters  
- `newInterval` {number}: The new ping interval in milliseconds. Must be a positive number.
- `immediate` {boolean} (optional): Whether to apply the new interval immediately by resetting the timer. Default is `false`.

### Returns  
- `void`

---

## getPingInterval()

### Description  
Retrieves the currently configured interval between heartbeat pings.

Useful for diagnostics, debugging, or adaptive logic that depends on the current heartbeat frequency.

### Parameters  
None

### Returns  
- `{number}`: The current ping interval in milliseconds.

---

## manualClose()

### Description  
Manually closes the WebSocket connection and disables the reconnection mechanism.

This method will disable automatic reconnection, clear heartbeat timers, and release WebSocket event references to speed up garbage collection.

### Parameters  
None

## Returns
- `void`

---

# Events
---
## open
- Triggered when the connection is successfully established  
- Callback parameter: event  
---
## close
  ### Description
  - Triggered when the WebSocket connection is closed.
  - Callback parameter: event (includes code and reason for disconnection details)

    ### Important Notice ⚠️
    The client will not automatically reconnect after a close event.
    This is because in many scenarios—such as the server forcibly kicking a client—automatic reconnection is inappropriate.
    To reconnect, you must manually call reconnect() based on your business logic.

    ### WebSocket Close Codes Usage Guidelines

    Please **do not use the reserved close codes defined by the WebSocket protocol** itself.  
    For details, see [MDN WebSocket CloseEvent Status Codes](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code).

    ### Custom Close Codes (≥ 4000)

    Codes 4000 and above are reserved for application-specific use.

    Our `WebSocketConnector` class already defines the following codes for internal use:

    | Code | Meaning                    |
    |-------|----------------------------|
    | 4001  | Client manually closed     |
    | 4002  | Pong timeout (heartbeat lost) |

    You can use other custom codes starting from 4010 for your own logic, for example:

    | Code | Meaning                   |
    |-------|---------------------------|
    | 4010  | Forced logout             |
    | 4011  | Authentication failed    |
    | 4012  | Kicked by concurrent login |

    ### Summary

    - **Do not use WebSocket standard codes (<4000).**  
    - **Respect codes 4001 and 4002 reserved by this client SDK.**  
    - Use codes ≥ 4010 for your custom close reasons to avoid conflicts.


    ### Example
    ```js
      client.on('close', (event) => {
        console.log(`client close`, event.code, event.reason);

        // Handle cases where reconnection should NOT happen:
        // 4001: Client manually closed
        // 4010, 4011, 4012: Forced logout, auth failure, kicked by concurrent login
        if (
          event.code === 4001 ||
          event.code === 4010 ||
          event.code === 4011 ||
          event.code === 4012
        ) {
          console.log('Connection closed manually or by forced logout/auth failure. No reconnection.');
          // Handle cleanup or UI update here
        } else {
          // For other codes (e.g. pong timeout 4002), try to reconnect
          console.log('Attempting to reconnect...');
          client.reconnect();
        }
      });

      // Example: Server side closing client connection with code and reason
      // socket.close(4010, 'Forced logout');
      // Client will receive this code and reason in the 'close' event to handle accordingly.

---  ```
## error
- Triggered when a connection error occurs  
- Callback parameter: (event)  
- Will trigger automatic reconnection by default (unless `manualClose` is explicitly called to close the connection)
---
## message
- Triggered when a message is received  
- Callback parameter: data  
---
## ping
- Triggered when a ping is sent  
- No callback parameters  
---
## pong
- Triggered when a pong response is received from the server  
- Callback parameter: speed, the elapsed time since the last ping (ms), used to measure latency  

  ### Example
    ```js
    // Listen for the 'pong' event to get the latency (in milliseconds) from the server's pong response.
    // This latency measurement is very useful for displaying the player's connection status or network signal strength.
    client.on('pong', (speed) => { 
      console.log(`Network latency: ${speed} ms`);
    })
---  ```
## repeat-limit
- Triggered when the maximum reconnect attempts have been reached  
- Callback parameter: repeatLimit, the maximum reconnect count  
---
## reconnect
- Triggered when preparing to reconnect  
- Callback parameters: object { repeat, timeout }, repeat (current reconnect attempt count), timeout (ms before actual reconnect)  
---
## pong-timeout
- Triggered when a pong response is not received within the expected timeout after a ping  
- No callback parameters  


