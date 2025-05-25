## Table of Contents

- [FAQ](#faq)
  - [1. How to implement message forwarding and callback from client → WebSocket server → logic server?](#1-how-to-implement-message-forwarding-and-callback-from-client--websocket-server--logic-server)
  - [2. Does the server support callbacks when sending messages to clients?](#2-does-the-server-support-callbacks-when-sending-messages-to-clients)
  - [3. Will a user automatically leave rooms after the WebSocket connection is closed?](#3-will-a-user-automatically-leave-rooms-after-the-websocket-connection-is-closed)
  - [4. How to Dynamically Add Redis Nodes?](#4-how-to-dynamically-add-redis-nodes)
  - [5. How to Add a New WebSocket Server Node?](#5-how-to-add-a-new-websocket-server-node)
  - [6. Should every server node have the same Redis configuration?](#6-should-every-server-node-have-the-same-redis-configuration)
  - [7. How to Configure Redis Publish Strategy?](#7-how-to-configure-redis-publish-strategy)
  - [8. How Many Redis Nodes Are Appropriate?](#8-how-many-redis-nodes-are-appropriate)
  - [9. When Should the Redis Data Compression Feature Be Enabled in WebSocketCrossServerAdapter?](#9-when-should-the-redis-data-compression-feature-be-enabled-in-websocketcrossserveradapter)
  - [10. Does the WebSocket server-to-client data transmission support compression?](#10-does-the-websocket-server-to-client-data-transmission-support-compression)
  - [11. How Should Room Namespaces Be Designed?](#11-how-should-room-namespaces-be-designed)
  - [12. How to retrieve information about rooms or players in a distributed WebSocket service?](#12-how-to-retrieve-information-about-rooms-or-players-in-a-distributed-websocket-service)
  - [13. How to distribute users to different WebSocket servers in a distributed WebSocket service?](#13-how-to-distribute-users-to-different-websocket-servers-in-a-distributed-websocket-service)
  - [14. Does WebSocketConnector automatically reconnect after disconnection?](#14-does-websocketconnector-automatically-reconnect-after-disconnection)
  - [15. How to Use the WebSocketConnector Class in Frontend Environments?](#15-how-to-use-the-websocketconnector-class-in-frontend-environments)
  - [16. Can the WebSocketConnector client only pass parameters via the URL?](#16-can-the-websocketconnector-client-only-pass-parameters-via-the-url)
  - [17. How to securely and compatibly transmit authentication and other sensitive information?](#17-how-to-securely-and-compatibly-transmit-authentication-and-other-sensitive-information)
  - [18. Why does WebSocket still need a heartbeat mechanism? Isn’t the close event enough?](#18-why-does-websocket-still-need-a-heartbeat-mechanism-isnt-the-close-event-enough)

## FAQ

### 1. How to implement message forwarding and callback from client → WebSocket server → logic server?
In a typical game scenario, the client sends a request (e.g., a matchmaking request) to the WebSocket server it is connected to. These requests are usually processed by a dedicated game logic server (e.g., GameServer), and the result is returned to the client.

1. The client sends a request, for example:

```js
client.emit('matchRequest', { mode: 'ranked' }, (err, data) => {
  if (data) {
      // Handle the match result
  }
})
```

2. The WebSocket server receives the event and forwards it to gameServer:

```js
wsServer.onWebSocketEvent('matchRequest', (socket, data, callback) => {
  wsServer.emitCrossServer('matchRequest', {
    data
  }, (res) => { 
    // Received callback from gameServer, then return the result to the client
    if (callback) callback(res);
  }, {
    targetServer: ['gameServer'],
  })
});
``` 

3. The gameServer processes the event and calls back with the result:

```js
gameServer.onCrossServerEvent('matchRequest', (data, callback, clientCallback) => {
  let matchResult = {};
  // After processing the matchmaking logic, callback to the WebSocket server
  if (callback) { 
    callback(matchResult);
  }
})

```

### 2. Does the server support callbacks when sending messages to clients?

No, it does not. The reasons include:

- The client environment and network are relatively unstable, so relying on client callback responses for business logic on the server side is risky and unreliable.  
- The server-to-client relationship is one-to-many; registering callbacks for every request would cause significant overhead, affecting performance and scalability.  
- Therefore, this feature is not currently designed. Developers are encouraged to implement it themselves if needed.

The implementation principle is similar to the client callback mechanism:  
The server generates a unique callback event ID. When the client receives an event that requires a callback, it processes the event and returns the result along with the callback ID to the server. The server then invokes the registered callback function based on the callback ID.  
Special attention is needed to handle one-to-many relationships properly.

### 3. Will a user automatically leave rooms after the WebSocket connection is closed?

After a WebSocket connection is disconnected, you **need to manually call `wsServer.removeUserSocket(socket.playerId)`** to clear all related bindings for that player.

This is because the framework is designed to be flexible and **does not enforce a strict binding between a player ID and a socket instance**. It’s up to the developer to perform this binding after successful authentication. As a result, you also need to handle cleanup manually when the client disconnects.

By calling `removeUserSocket(playerId)`, the framework will:

- Remove the binding between the player and the socket  
- Automatically remove the player from all rooms they joined  
- Delete all internal mapping data related to that player  

This ensures proper cleanup and consistency of room states after a client disconnects.


### 4. How to Dynamically Add Redis Nodes?

During runtime, if you want to add a new Redis node dynamically, you can achieve this by registering a cross-server event handler. For example:

```js
wsServer.onCrossServerEvent('addRedis', (data, callback) => {
  const redisConfig = data.redisConfig;
  if (redisConfig) {
    wsServer.addRedisInstance(redisConfig);
    if (callback) {
      callback({ success: true });
    }
  }
});

Then, you can broadcast the event from any server node to add the new Redis node:

adminServer.emitCrossServer(
  'addRedis',
  { redisConfig },
  () => {
    // Count the number of successful additions
  },
  {
    targetServer: [], // Broadcast to all server nodes
  }
);
```
You can also set the onRedisHealthChange callback in the constructor to monitor the health status of all Redis nodes and view the current connection status.

#### ⚠️ Notes:

Since the framework uses a decentralized architecture, each server node subscribes to all Redis node channels. When publishing messages, it will choose a healthy node based on the configured strategy.

So when dynamically adding Redis nodes, be aware of the following risks:

- If the number of channels is large or the Redis connection is slow to initialize, the new node may not complete its subscription in time.
- In such cases, other servers may already select this node to publish messages, which may result in failed or lost messages.

#### ➡️ Recommendation:

Use dynamic Redis addition with caution in production environments.  
It is recommended to preconfigure all Redis nodes during initialization or update them during scheduled maintenance windows to ensure system stability.

### 5. How to Add a New WebSocket Server Node?

If you wish to add a new WebSocket server node at runtime, simply ensure that its Redis configuration is consistent with the existing nodes — this allows for seamless integration.

After the new node is added, you can redirect part of the client traffic to it using load balancing strategies such as Nginx, for example by distributing requests based on IP, geographic location, or weight.

Since each server node in this architecture has independent distributed messaging capabilities, the newly added node can immediately participate in message handling without requiring additional synchronization or central coordination.

### 6. Should every server node have the same Redis configuration?

Yes, the Redis configuration must remain consistent across all server nodes.
This framework adopts an equal-node design, where each server node subscribes to all Redis channels. This ensures that messages published from any Redis node can be received by all servers.

If a Redis node goes down, it will be marked as unhealthy (healthy = false), and the system will automatically avoid selecting it as a publishing target — ensuring that overall functionality remains unaffected.

⚠️ Note:  

If a server node is missing a Redis configuration, it will **not be able to receive messages published through that Redis node**.  
Therefore, **it is crucial to maintain a consistent and complete Redis configuration across all server nodes**.

### 7. How to Configure Redis Publish Strategy?

The node selection strategy is only enabled when there is more than one Redis node in the cluster. Its purpose is to determine which Redis node to publish messages to based on certain rules, achieving load balancing and high availability. If there is only one Redis node, that node is selected by default, and no additional configuration is needed.

The framework currently supports three Redis publish strategies:

| Strategy       | Description                                  |
|----------------|----------------------------------------------|
| `random`       | Randomly pick a healthy Redis node           |
| `round-robin`  | Pick nodes in order for balanced load        |
| `fastest`      | Choose the node with the lowest ping latency |

#### Strategy Use Case Analysis

##### `random` – Simple & Robust  
- **Best for**: Small or balanced deployments  
- **Pros**: Easy to implement, avoids single-node hotspots  
- **Cons**: May cause load imbalance in short bursts

##### `round-robin` – Fair & Balanced  
- **Best for**: Consistent load distribution  
- **Pros**: Natural load balancing  
- **Cons**: Ignores real-time health or latency

##### `fastest` – Latency First (⚠️ With Caution)  
- **Best for**: Geo-distributed systems with high latency variance  
- **Pros**: Potentially lowest delay  
- **Cons**:
  - Ping latency ≠ real-time Redis performance  
  - Locally fastest node might be globally slow for others  
  - Can lead to message delivery failure in distributed setups


#### Strategy Recommendation

| Scenario                     | Recommended     | Notes |
|-----------------------------|------------------|-------|
| Single machine / local setup| `round-robin`    | Best stability |
| Multi-node no cross-region  | `random` / `round-robin` | Depends on balance needs |
| Distributed across regions  | ✅ `round-robin` | Avoid locality bias |
| Extreme latency optimization | `fastest` (⚠️ monitor carefully) | Should be chosen based on the actual Redis node distribution |


The framework **automatically maintains the health status of all Redis nodes**, so you don’t need to handle it manually:

- Each node is periodically checked via `ping`, connection status, etc., and health states are updated accordingly.
- If a Redis node experiences connection failures or timeouts, it will be marked as **unhealthy**.
- **Message publishing will only select from healthy Redis nodes**, avoiding any failed or unreachable nodes.


#### 🧠 Design Principles Summary

- **Decentralized architecture**: Every server subscribes to all Redis nodes. There’s no single point of failure.
- **High resilience**: A failing node doesn’t disrupt the system. As long as one Redis node is healthy, messages will be processed.
- **Health-first logic**: All publishing strategies (`random`, `round-robin`, `fastest`) only operate on the healthy node set.


### 8. How Many Redis Nodes Are Appropriate?

In this framework, Redis is used solely for Pub/Sub message broadcasting, without involving data persistence, complex transactions, or slow queries. Therefore, the throughput bottleneck mainly depends on the following factors:

- Message size  
- Number of subscribers  
- Network latency  

#### Practical Recommendations:  
If there is no exceptionally high broadcast frequency or a large number of nodes, a single Redis instance is sufficient for most projects.  
You can also flexibly increase the number of Redis instances based on your server hardware configuration to ensure system stability.  
Since only Redis’s publish and subscribe features are used, with no storage operations involved, the cost of adding an additional Redis node is very low.  
Each added node provides an extra layer of reliability, enhancing the system’s fault tolerance and scalability.

If the deployment involves multiple physical servers, it is recommended to elastically increase the number of Redis instances according to the number of nodes, broadcast frequency, and network topology to distribute message forwarding load and alleviate network bottlenecks.

In this framework design, all Redis nodes are equal peers without master-slave relationships.  
Load balancing is uniformly managed by the framework during message publishing.  
Redis nodes can be flexibly added or removed according to actual deployment needs, requiring no changes to any logic code.  
New nodes take effect immediately upon joining, enabling effortless and smooth scaling.

### 9. When Should the Redis Data Compression Feature Be Enabled in WebSocketCrossServerAdapter?

It is recommended to enable the Redis data compression feature only when cross-physical-server communication is involved.  
Within the same physical server or local area network, the performance bottleneck of local data transmission is minimal.  
Frequent compression and decompression may introduce additional CPU overhead, causing performance loss that outweighs the benefits gained from reduced data size.  

Whether to enable compression also depends on factors such as the size of the data packets being transmitted.  
If the data packets are large, enabling compression is advisable.  
The built-in compression module of the framework typically reduces data size by about 30%.  

Therefore, the data compression feature should be enabled in distributed Redis deployments spanning multiple physical servers or networks,  
to effectively reduce network bandwidth pressure and improve overall communication efficiency.

⚠️ **Extremely Important Note:**  
**Compression settings must be consistent across all server nodes.**  
If compression is enabled, it must be enabled on *every* server instance. Inconsistent settings will lead to decoding errors and possibly communication failures.

### 10. Does the WebSocket server-to-client data transmission support compression?

Our WebSocketCrossServerAdapter does not actively perform data compression by itself.

The underlying `ws` library supports the `permessage-deflate` compression extension, which can be enabled via configuration. However, enabling compression requires both server and client to support and agree on the compression protocol. Moreover, `permessage-deflate` may introduce significant performance and memory overhead, especially under high concurrency, potentially causing memory fragmentation and degraded performance.

Browser clients may also have inconsistent support for this compression extension, leading to compatibility issues.

For more details and configuration options, please refer to the [ws official documentation on permessage-deflate](https://github.com/websockets/ws#websocket-compression).

Therefore, we recommend using this feature with caution and implementing custom compression logic according to your project needs.

### 11. How Should Room Namespaces Be Designed?

#### Design Principles
- `roomNamespace` is used to define the granularity and categorization of rooms.  
  Developers are free to design their own naming conventions.  
  It's recommended to use hierarchical delimiters (e.g., `app:chat:game:hot`) to represent different business modules or room types.

- The granularity of namespaces should be balanced:  
  - Too coarse-grained can result in overly broad subscription scopes, wasting resources during message broadcasting.  
  - Too fine-grained may cause a large number of Redis channels and increase subscription management complexity.

- For room namespaces with **no predictable or fixed naming pattern** (e.g., rooms generated per game session), Redis channels will keep being created dynamically.  
  If the adapter is configured with `autoUnsubscribe: false`, **such channels will not be automatically unsubscribed when rooms are emptied**,  
  which can lead to an ever-growing number of Redis channels and unnecessary resource consumption.

- It is highly recommended to place frequently used and predictable channels in the `presetRoomNamespaces` configuration.  
  These channels will be subscribed automatically during initialization and remain active throughout the adapter's lifecycle.  
  Even if the room is empty, they will **not be auto-unsubscribed due to the `autoUnsubscribe` setting**.

- If frequently used channels are not included in `presetRoomNamespaces` and `autoUnsubscribe` is enabled,  
  it may cause frequent subscribe/unsubscribe actions, introducing performance jitter risks.

#### Recommended Configuration Practices

- **Preset commonly used channels to reduce unnecessary subscription overhead:**  
  By placing predictable or commonly used channels into `presetRoomNamespaces`,  
  you avoid repeatedly subscribing each time a room is joined.  
  These channels also won’t be affected by `autoUnsubscribe`, avoiding performance jitter from repeated subscription handling.

- **Keep `autoUnsubscribe` enabled by default to improve maintainability:**  
  For temporary channels not included in `presetRoomNamespaces`, enabling `autoUnsubscribe` ensures that  
  Redis subscriptions are automatically cleaned up when no clients remain in a room,  
  preventing channel bloat and reducing cross-server message traffic and Redis load.


### 12. How to retrieve information about rooms or players in a distributed WebSocket service?

#### Local Statistics

If you only need to retrieve information from the local server, you can directly call the local APIs, for example:

- Get the number of online clients in a specific room:  
  [`getSocketCountInRoom(roomNamespace, roomId, options)`](./api.en-US.md#getsocketcountinroomroomnamespace-roomid-options)
- Get all `socketId`s of clients currently in a room:  
  [`getRoomSocketIds(roomNamespace, roomId, options)`](./api.en-US.md#getroomsocketidsroomnamespace-roomid-options)
- Get all rooms that a specific client has joined:  
  [`getJoinedRooms(socketId)`](./api.en-US.md#getjoinedroomssocketid-roomnamespace)

These interfaces only return data from the current server, with fast response and low overhead.

#### Cross-Server Aggregated Statistics

If you want to aggregate room-related data from all server nodes, use the cross-server event mechanism:

1. Register a cross-server event handler on each server node:

```js
wsServer.onCrossServerEvent('getSocketCountInRoom', (data, callback) => {
  const count = wsServer.getSocketCountInRoom(data.roomNamespace, data.roomId);
  if (callback) {
    callback({ count });
  }
});
```
2. Send a broadcast request from the desired server to aggregate the data:

```js
const result = await crossServer.emitCrossServerWithPromise(
  'getSocketCountInRoom',
  { roomNamespace: 'chat', roomId: 'room123' },
  {
    targetServer: [],         // Empty array means broadcast to all nodes
    expectedResponses: 3      // Assume there are 3 server nodes in the cluster
  }
);

if (result.success) {
  console.log('All expected nodes have responded:', result.responses);
} else {
  console.log('Nodes that have responded so far:', result.responses);
  console.log('Number of servers that did not respond: ' + result.unrespondedCount);
}

```

> ⚠️ **Note**: You need to know the total number of server nodes in the cluster in advance in order to set `expectedResponses` correctly.


All distributed statistics requirements can be handled through this event-based cross-server communication mechanism.
You register handlers with onCrossServerEvent, and trigger remote calls with emitCrossServer or emitCrossServerWithPromise, enabling you to flexibly aggregate data from all nodes.

Alternatively, you can build a centralized data hub (e.g., database or global Redis server) where all nodes dynamically update stats in real-time. This allows central querying, but introduces tight coupling and contradicts this framework’s decentralized design philosophy. Choose the strategy that best fits your architecture.

With the power of [`onCrossServerEvent`](./api.en-US.md#oncrossservereventevent-listener), [`emitCrossServer`](./api.en-US.md#emitcrossserverevent-message-callback-options) , and [`emitCrossServerWithPromise`](./api.en-US.md#emitcrossserverwithpromiseevent-message-options), you can implement most cross-server coordination needs. Feel free to design and extend based on your business scenarios.

### 13. How to distribute users to different WebSocket servers in a distributed WebSocket service?

In a distributed architecture, user connections are typically automatically distributed to multiple WebSocket nodes by a load balancer, or assigned to specific nodes based on custom allocation logic at the application layer.

#### Method 1: Automatic distribution by load balancer and Sticky Session (optional optimization)

In most deployment scenarios, the load balancer (such as Nginx, HAProxy, AWS ELB, etc.) is responsible for automatically distributing client connections to multiple backend WebSocket nodes. The default strategy is usually random distribution or round-robin scheduling, implementing stateless request forwarding.

Some load balancers support configuring "Sticky Session", which allows the same user to preferentially connect to the previously accessed node within a short period to reduce the overhead caused by state migration. Common strategies include:

- Cookie-based binding  
- IP Hash calculation  
- Custom mapping based on Header / URL parameters  

Advantages: can reduce the complexity of state synchronization caused by frequent node switching  
Note: Whether to use sticky sessions depends on business requirements and is not mandatory.

#### Method 2: Custom distribution logic at the application layer

The business layer can implement consistent hashing, sharding, or other strategies based on user ID, Token, or other features, and the login service or gateway guides the client to connect to the designated WebSocket node.

Advantages: fully controllable logic, suitable for complex scheduling or customized sharding scenarios.

#### Principle Overview

The login service, authentication service determines the target WebSocket node a user should connect to during login or initialization. The core process is as follows:

1. The client accesses the login service
2. The login service applies a custom allocation strategy based on user information (e.g., consistent hashing, partition mapping, etc.)
3. It returns the target WebSocket node address to the client
4. The client establishes a connection using this address

#### Common Implementation Strategies

1. Consistent Hashing Allocation

```js
const nodes = ['ws1.example.com', 'ws2.example.com', 'ws3.example.com'];
function getTargetNode(userId) {
  const hash = crc32(userId); // Can use CRC32, md5, murmurhash, etc.
  return nodes[hash % nodes.length];
}
```
2. Room or Channel-Based Allocation
```js
function getTargetNodeByRoom(roomId) {
  return nodes[roomId % nodes.length];
}
```
3. User Tags or Attributes
```js
if (user.isVIP) return 'vip-ws.example.com';
if (user.region === 'CN') return 'cn-ws.example.com';
return 'default-ws.example.com';
```
Client Connection Pseudocode:
```js
// Get the recommended WebSocket node during login
const res = await fetch('/api/get-websocket-node', { method: 'POST', body: { userId: 'u123' } });
const wsUrl = res.data.websocketUrl;

// Connect to WebSocket
const socket = new WebSocketConnector({ url: wsUrl });

```
#### Advantages

- High degree of control, allowing flexible node distribution
- Easily optimized when combined with business logic (e.g., room/channel mapping)
- Low requirement for sticky session support from load balancers
- Facilitates horizontal scalability and routing strategy evolution

#### ⚠️ Notes

- Requires a service that maintains awareness of all WebSocket node statuses
- Fallback mechanisms should be in place if the assigned node is unavailable
- It's recommended to deploy with logging and validation in early stages to avoid uneven load distribution or broken routing

#### Framework-level support for flexible scheduling without relying on sticky connections

Our framework does not rely on sticky connections; users can connect to any node and still function properly. As long as the following core logic is correctly handled, flexible distribution can be achieved:

- **Online detection (connection authentication)**  
  To ensure the uniqueness of a single user's connection mapping globally, developers need to query the user's status on other nodes through cross-server events. If the user is found to be online, the developer should decide to kick out the old connection or reject the current connection, preventing the same user from logging in multiple nodes simultaneously.

- **Offline handling (connection disconnection)**  
  After the user disconnects, clear the user's state on the current node and notify related logic modules of the user's offline status.

- **State broadcasting (inter-node synchronization)**  
  When a user goes online or offline, broadcast the notification to other nodes, e.g., for updating the status of members in a room.

#### About the “ownership” of business state and the principle of “decentralization”

If a user is associated with specific business object instances (such as a game room object), it is recommended to guide the user to reconnect to the original server node during reconnection to avoid the complexity and latency caused by cross-node access to that object.

Our advocated principles are:

- **Decentralized design**  
  Each WebSocket node manages the business objects created locally and does not rely on centralized data storage (such as Redis) for state management.

- **Cross-server discovery mechanism**  
  Use the built-in cross-server event mechanism in the framework for queries like "Is this guy on your node?" or "Which node holds this room instance?"  
  This avoids reliance on a central database, reduces the impact of failures, and improves system resilience.

Such an architecture provides stronger horizontal scalability and better fits the development direction of distributed architectures. Of course, the specific design scheme should be determined according to actual business requirements.

### 14. Does WebSocketConnector automatically reconnect after disconnection?

No, `WebSocketConnector` does **not automatically reconnect on the `close` event** by default.

This is because disconnections can happen for various reasons, such as:

- The server actively closes the connection due to authentication failure;
- The server forcibly kicks the client due to business rules;
- Network interruptions or other unexpected issues.

For the first two cases, automatic reconnection may result in meaningless requests, security risks, or resource waste.

Therefore, **the decision to reconnect is left to the developer**, allowing you to decide when and whether to reconnect based on the reason for disconnection.

Also note:

> **Reconnection will be triggered automatically on the `error` event**  
> (unless `manualClose` is explicitly called to prevent it),  
> while **the `close` event will not trigger reconnection by default**.  
> Developers should check the `code` and `reason` to decide whether to reconnect.

For usage details, please refer to **Chapter 1: Single WebSocket Server** in the examples, where detailed code and comments are provided.

### 15. How to Use the WebSocketConnector Class in Frontend Environments?

If you want to use the WebSocketConnector class in the browser via a <script> tag, you can download and include the client class provided by the project:

🔗 **GitHub links**:  
- [websocketConnector.js](https://github.com/LiuYiSong/websocket-cross-server-adapter/blob/main/src/WebSocketConnector.js)  

Usage:

Include the script in your HTML file with a <script> tag:

```html
<script src="websocketConnector.js"></script>
```

After including the script, WebSocketConnector will be automatically exposed on the global window object and can be used directly:

```js
const connector = new WebSocketConnector({
    url: `ws://localhost:8080`,
  });
```

- **Modern frameworks (React / Vue / React Native)**: Supported via npm package module import. Example:

First, install the dependency:

```bash
npm install websocket-cross-server-adapter

```

Then import and use it in your code:

```js
import { WebSocketConnector } from 'websocket-cross-server-adapter';

const connector = new WebSocketConnector({
    url: `ws://localhost:8080`,
  });

```

Other **frontend platforms based on the standard WebSocket protocol** can also directly use this class for real-time communication.

### 16. Can the WebSocketConnector client only pass parameters via the URL?

Yes. Although in the Node.js environment, the ws module’s client supports passing parameters via custom headers (e.g., for authentication or client identification), the native WebSocket constructor in browsers does not support setting custom request headers and can only pass parameters through the URL.

WebSocketConnector mainly targets browser front-end usage, and also supports environments like Cocos Creator, React Native, and mini-programs. In these environments, WebSocket implementations typically do not support custom headers or have limited support for cookies and other authentication methods, so parameters can only be passed via the URL.

To ensure consistent behavior, best compatibility across all environments, and to simplify development and maintenance, we uniformly use URL parameter passing—even in Node.js environments.

### 17. How to securely and compatibly transmit authentication and other sensitive information?

When transmitting authentication and sensitive information over WebSocket connections, the commonly used and recommended methods include:

1. **URL Parameter Passing**

Since native browser WebSocket does not support custom headers, clients can only pass authentication tokens as query parameters appended to the connection URL. For example:  
`wss://example.com/ws?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
The server parses the token from the URL upon receiving the connection request and performs authentication. This approach is simple to implement and widely compatible, but the token may be exposed in browser history, proxies, and logs, presenting security risks.  
**Long-lived tokens are not recommended to be passed this way; use short-lived or one-time tokens instead.**

2. **Sending Authentication Message After Connection Established**

To avoid exposing sensitive information in the URL, the client can send an authentication message containing the token after the WebSocket connection is established.  
The server validates the token and, if valid, allows the connection to proceed with further interactions. This method avoids token exposure in the URL, supports various client environments (browser, mini-programs, React Native, etc.), but requires the server to implement authentication message handling and timeout disconnection mechanisms.

To prevent malicious clients from connecting without authenticating (which wastes server resources), the server should start an authentication timeout timer upon connection. If the client fails to authenticate within the configured time, the server forcibly closes the connection. Additionally, periodic scans can be used to clean up connections that remain unauthenticated or idle for too long, ensuring efficient resource usage.

3. **Session ID or Short-lived Token Method**

Users obtain a short-lived sessionId or one-time token through an HTTP login API, then pass this sessionId or token as a URL parameter when establishing the WebSocket connection. The server identifies and authenticates the user based on this parameter.


There are some other specialized or auxiliary methods as well:

- **Cookie Method:** Automatically sent by browsers but has poor support in environments like React Native or mini-programs, and may suffer from cross-domain and security issues.

- **Sec-WebSocket-Protocol Header Passing:** Theoretically possible, but browser compatibility and server support are limited, making it error-prone.

In summary, regardless of which method is used to transmit authentication information, it is strongly recommended to use encrypted `wss://` protocol to ensure data security, prevent man-in-the-middle attacks, and avoid leakage of sensitive information.

### 18. Why does WebSocket still need a heartbeat mechanism? Isn’t the close event enough?

Although the WebSocket triggers a close event when the connection is closed normally, in some abnormal cases (such as device power off, network interruption, program crash, network switching like WiFi to 4G, router reboot, NAT or firewall timeout disconnections, etc.), this event may not be triggered timely or may not be triggered at all. At this point, the connection is actually disconnected, but the application layer may still mistakenly believe it is alive, causing a so-called “ghost connection” state.

Therefore, we need to introduce a heartbeat mechanism: the client periodically sends a message of "Am I still alive?" (like a ping) to the server, and the server replies with a corresponding message of "You are still alive" (like a pong). If the client does not receive a response from the server within a certain time, it can determine that the connection has failed and proactively close the connection and perform reconnection or other handling.

**Why do both the server and the client need their own heartbeat mechanisms?**

In WebSocket communication, the heartbeat mechanisms on the server and client sides operate at different layers and have different responsibilities:

The server uses the WebSocket protocol-level ping/pong mechanism. The server actively sends a protocol-defined ping frame (control frame) to the client, and the client automatically responds with a pong frame according to the WebSocket protocol, requiring no extra implementation by developers. This built-in standard mechanism is mainly used to handle server-side logic, helping the server detect whether the client connection is still alive and clean up invalid connections promptly to release resources.

The client heartbeat mechanism is implemented at the application layer. The client periodically sends a custom “Are you still alive?” (ping) message, and the server replies with a corresponding “You are still alive” (pong) message. This mechanism must be implemented by developers in their business logic and mainly serves client-side logic, helping the client confirm whether the server is still online, thus ensuring the client can promptly detect connection issues and respond accordingly.

In summary, the server’s ping/pong is an automatic mechanism at the WebSocket protocol layer mainly for the server to monitor client connection status and manage connections on the server side.

The client heartbeat is a custom mechanism at the application layer that developers must implement, helping the client perceive its own connection status and manage connection logic on the client side.

They run independently and serve their own purposes. This is why both the client and server need to implement their own heartbeat mechanisms.

Reference source code:  
Client heartbeat details can be found in the `_heartStart` method in [WebSocketConnector](src/WebSocketConnector.js).  
Server heartbeat details can be found in the `_setupWsServer` method in [WebSocketCrossServerAdapter](src/WebSocketCrossServerAdapter.js).

Sending heartbeat packets too frequently can consume additional network traffic and system resources, which is especially noticeable on mobile networks or in large-scale connection environments. Therefore, it is recommended to set the heartbeat interval reasonably according to the specific scenario to avoid excessive traffic and performance overhead while ensuring connection timeliness and stability.

`WebSocketConnector` provides a `setPingInterval` method that allows dynamically adjusting the client heartbeat interval, enabling flexible configuration of heartbeat frequency according to the actual scenario, balancing connection stability and traffic consumption.


---

## Contact

If you have any questions or suggestions while using this project, feel free to contact me anytime.
You can also report issues or provide feedback via the GitHub repository's Issues page.

To prevent your email from being classified as spam, please add [WebSocketCrossServerAdapter] at the beginning of the email subject or body.

Email: 349233775@qq.com

---

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
