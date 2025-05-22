# 🚀 A Node.js-Based WebSocket Distributed Framework for Multi-Server Communication

[中文版 README](./README.zh-CN.md)

## Table of Contents

- [Background](#background)
- [Why Build This Framework?](#why-build-this-framework)
- [Project Goals](#project-goals)
- [How It Works (Core Architecture)](#how-it-works-core-architecture)
- [WebSocketCrossServerAdapter (Core Server-Side Communication Module)](#websocketcrossserveradapter-core-server-side-communication-module)
- [WebSocketConnector (Client-Side Connection Manager)](#websocketconnector-client-side-connection-manager)
- [Not Just WebSocket — A Unified Bridge for Microservice Communication](#not-just-websocket--a-unified-bridge-for-microservice-communication)
- [Suitable Scenarios](#suitable-scenarios)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
   - [English API Documentation](./api.en-US.md)
   - [中文API文档](./api.zh-CN.md)
- [Usage Example](#usage-example)
  - [1. Single WebSocket Server Mode (Non-Distributed)](#usage-example)
  - [2. Cross-Server Communication Module (Pure Server Communication)](#2-cross-server-communication-module-pure-server-communication)
  - [3. WebSocket + CrossServer Distributed Communication Example (Cross-Service Scenario)](#3-websocket--crossserver-distributed-communication-example-cross-service-scenario)
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
- [Contact](#Contact)
- [License](#License)

## Background

During the development of a casual real-time game, I chose to use the native WebSocket protocol for communication. The client and server used platform-native interfaces and Node.js's [ws](https://github.com/websockets/ws) module, respectively. This approach provided flexibility at the communication layer but also meant that many fundamental features had to be implemented manually, such as heartbeat mechanisms, reconnection, message callbacks, and room management.

As the project's complexity increased, some limitations of Node.js became apparent. While the single-threaded model excels at handling high-concurrency I/O, it cannot fully utilize multi-core CPUs for compute-intensive tasks. Under high loads, garbage collection (GC) can pause the event loop, reducing response speed and overall throughput.

---

## Why Build This Framework?

Many developers use Node.js WebSocket but rarely seriously consider:

- "What if the number of connections grows large?"  
- "What if the service needs to scale horizontally?"  
- "What if rooms, events, and user states need to be synchronized across multiple nodes?"

In the early stages of a project, the system architecture and concurrency pressure are relatively manageable. A single-process Node.js WebSocket server can easily support tens of thousands of connections, running stable and responsive, meeting critical early-stage needs such as "Is the feature functional?", "Can users connect?", and "Is the experience smooth?".

However, as the business grows and users increase, new challenges gradually arise:

- After deploying multiple instances, user connections are distributed across different nodes, making state synchronization complex;  
- Room logic depends on local memory, making migration and sharing difficult, and limiting dynamic scaling;  
- Broadcasts only affect local nodes, lacking a unified mechanism for cross-node event coordination;  
- Wanting to integrate distributed middleware (like Redis) for communication bridging but lacking flexible and unified interfaces;  
- Custom implementations often lack structure and standards, increasing maintenance costs and coupling.

Notably, although Node.js supports multi-process and cluster deployment, the community nearly lacks a ready-to-use distributed communication framework based on native `ws`. Existing solutions generally fall into two categories:

- Deeply tied to certain framework adapter systems, limiting flexibility and control;  
- Scattered examples, conceptual codes, or experimental projects lacking structured design, hard to deploy in production.

These problems are not architectural mistakes but inevitable challenges when evolving from monolithic to distributed systems. This is the starting point of building this cross-server communication framework.

---

## Project Goals

The core goals of this framework are:

- Solve the basic limitations of native WebSocket: built-in heartbeat, reconnection, event callbacks, room broadcasting, and other out-of-the-box features.
- Break through Node.js's multi-process and distributed deployment limitations: distributed event system based on Redis, supporting message sync and broadcast across multiple nodes.
- Support cross-service communication scenarios: not limited to client messaging, but also usable for inter-service event routing and system-wide messaging.
- Make distribution no longer an “advanced option”: whether developing locally or deploying at scale, simply toggle a switch to run in distributed mode without rewriting your business logic.

---

## How It Works (Core Architecture)

This framework uses Redis's publish/subscribe mechanism as a messaging middleware to achieve cross-server message broadcasting and event synchronization:

- All server nodes subscribe to all Redis channels, achieving decentralized communication between nodes. Redis nodes are independent with no master-slave dependency.
- Built-in health check and self-healing mechanism for fault node isolation, ensuring high availability.
- Message publishing strategies can include random, round-robin, or latency-prioritized node selection.
- A single Redis node failure does not impact overall system operation — the framework is fault-tolerant.
- Supports both single-server multi-process and cross-machine distributed deployment, enabling horizontal scalability.

---

## Project Includes Two Modules: WebSocketCrossServerAdapter and WebSocketConnector

This framework is implemented based on the standard WebSocket protocol and features:
- Only two core class files, keeping the codebase concise and easy to understand.
- No heavy external dependencies, ensuring lightweight and efficient performance.
- Well-organized code structure that avoids frequent file jumps, providing a smooth and coherent development experience.
- Comprehensive and clear comments to help developers quickly grasp the logic.
- Focused on delivering the essential functionalities for WebSocket distributed communication, avoiding unnecessary complexity.
- Simple architecture that facilitates extension and customization.
- Strict adherence to the WebSocket standard, ensuring good compatibility and cross-platform support.

---

## WebSocketCrossServerAdapter (Core Server-Side Communication Module)

A communication adapter designed for distributed architectures. It supports server-side event broadcasting, cross-server messaging, room management, and more. Highly extensible and modular — suitable for game servers, real-time systems, and microservice communication.

Key features:

- Cross-node event communication with callback/Promise support
- Redis-based distributed support: dynamic node addition, full-channel subscription, compressed transmission
- Distributed room broadcasting, client tracking, and global user stats
- Local-first event handling with automatic routing to the target node
- Hot-pluggable expansion without restarting

Supports multiple message delivery granularities (independent of which node the client is connected to):

- Global broadcast (all nodes, all clients)
- Single client messaging (cross-node precision targeting)
- Batch sending via socketId
- Distributed room broadcasting

Supports room namespaces (`roomNamespace`) for managing business isolation.

Provides cross-node statistics: online user counts, room members, etc.

All WebSocket event handlers can be registered on any server node. For events that need to be processed cross-node and then callback to the client, developers can forward the event to the target node manually. The target node handles it and responds directly to the client — no intermediate proxies or re-wrapping required.

---

## WebSocketConnector (Client-Side Connection Manager)

A lightweight and minimalist WebSocket client class, compatible with any platform that supports the standard WebSocket protocol — including browsers, Node.js, Electron, React Native, mobile apps, mini programs, and Cocos Creator.

Built-in features include heartbeat, automatic reconnection, event callbacks, and delayed responses. With clean logic and easy integration, the compressed size is only about 5KB, making it ideal for real-time communication on the front end.

Features:

- Disconnection Reconnection
- Heartbeat keep-alive mechanism
- Network latency detection (based on ping-pong)
- `emit` supports callbacks and timeout handling
- Latency-based callback response (e.g., useful for showing loading states)
- Support parameter injection (URL)

---

## Not Just WebSocket — A Unified Bridge for Microservice Communication

This framework is not only for front-end/back-end WebSocket messaging — it can also serve as an internal messaging bus for backend services. It supports event distribution and responses between various service types (HTTP, file processing, image processing, AI services, etc.):

- 🌐 Global broadcast and single/multi-point directed communication
- 🔁 Event-level callback mechanisms, enabling request-response messaging patterns
- 📊 Result collection and response statistics, facilitating concurrent service coordination
- 🔒 Enables building a high-cohesion communication architecture featuring event-driven design + service isolation + feedback

In this architecture, you’re not limited to connecting clients — you can connect any Node.js service module, making all your services event-capable.

---

## Suitable Scenarios

- Real-time multiplayer game servers
- Multi-room / multi-user chatroom systems
- Interactive education and live streaming platforms
- Microservice communication bridges (event-driven inter-service communication)
- Any project requiring stable, distributed WebSocket communication

---

## Getting Started

```js
npm install websocket-cross-server-adapter

```
## API Documentation

- [English API Documentation](./api.en-US.md)
- [中文API文档](./api.zh-CN.md)

---

## Usage Example

### 1.Single WebSocket Server Mode (Non-Distributed)

If your project only requires a traditional single WebSocket server, there's no need to use Redis or perform any additional distributed configuration.

Simply pass in the configuration just like you would when using the native [ws](https://github.com/websockets/ws) module. The framework will automatically run in single-server mode.

The [ws](https://github.com/websockets/ws) configuration should be provided as an object and follow the specifications in the [official ws module documentation](https://github.com/websockets/ws).

server.js :

```js

  // server.js :
  // If you're not running this in the example folder, replace the require path with the package name:
  // const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
  const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

  // If you're using ES Module, you can import it like this:
  // import { WebSocketCrossServerAdapter } from 'websocket-cross-server-adapter';

  // Default value (if no command-line argument is specified)
  let port = 9000;

  // Parse command-line arguments. You can pass parameters dynamically when running the Node.js process.
  // For example: node server --port=9001

  const args = process.argv.slice(2);
  args.forEach(arg => {
    if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10);
    } 
  });

  console.log(`Using configured values - port: ${port}`);

  const wsServer = new WebSocketCrossServerAdapter({
    wsOptions: {
      port
    }
  });

  wsServer.onWebSocketEvent('connection', (socket, req) => {
    console.log('Client connection');

    // Use the helper method parseWsRequestParams to parse the req object,
    // which contains the parameters passed by the client when connecting via WebSocketConnector (e.g., token, custom params).
    const data = wsServer.parseWsRequestParams(req);

    console.log('Connection params：', data);

    // ✅ Use the ID passed from the client to establish the mapping. 
    // In a real-world application, you should perform proper authentication here (e.g., token verification).
    // For example, use the `jsonwebtoken` module to verify `token` and decide whether to proceed based on the result.
    // However, we strongly recommend performing authentication during the WebSocket upgrade phase using noServer mode,
    // which is more efficient and secure.
    // Although the `ws` library still supports the `verifyClient` option for authentication during connection,
    // this API is no longer recommended and may be removed in future versions.
    // 👉 Refer to the official ws documentation for recommended practices using noServer mode and `server.on('upgrade')`.

    // For demonstration purposes only, we directly use the ID passed from the client here.

    if (data.params.id) {
      const playerId = String(data.params.id);
      console.log('The client’s ID is：' + playerId);
     
      // Store the id in socket.playerId (or other business-specific fields, such as socket.player = { playerId, name }).
      // Just ensure that each socket can be uniquely identified.
      socket.playerId = playerId;

      // It's crucial to map the string-type ID to the socket instance,
      // otherwise broadcast, unicast, and multicast features won't function correctly.
      wsServer.setUserSocket(playerId, socket);
    } else {
    
      // Simulate authentication failure and close the connection with a custom close code (4011).
      // This code should be defined per your business logic.
      // See the API client documentation for details on the `close` event.
      socket.close(4011, 'Auth failure');
    }
  });

  wsServer.onWebSocketEvent('close', (socket, req) => {
    console.log('Client disconnected，id:' + socket.playerId);

    if (socket.playerId) {
      
      // When a client disconnects, make sure to remove the mapping between ID and socket,
      // or the socket instance may not be garbage collected, causing memory leaks.
      wsServer.removeUserSocket(socket.playerId);
    }
  });

  wsServer.onWebSocketEvent('say', (socket, data, callback) => {
    console.log(`Received 'say' event from client ${socket.playerId}:`, data);

    if (callback) {

      // If the client used emit with a callback, or used emitWithPromise,
      // the `callback` will be a valid function, and can be used to return data back to the client.
      callback({ msg: 'I am a callback for your say event' });
    }
  });

  wsServer.onWebSocketEvent('joinRoom', (socket, data, callback) => {
    console.log(`Received 'joinRoom' event from client ${socket.playerId}:`, data);
    if (socket.playerId) { 
    
      // Simulate joining the testRoom with id 1000
      wsServer.joinRoom('testRoom', '1000', socket.playerId);
    }
    if (callback) {
      callback({ msg: 'JoinRoom successfully' });
    }
  });


  // Simulate sending broadcast periodically
  setInterval(() => { 
    wsServer.broadcast('serverSay', { msg: 'I’m sending this message to everyone' });
  }, 15_000)


  // Simulate sending messages periodically to the test room
  setInterval(() => { 
    wsServer.broadcastToRoom('testRoom', '1000', 'roomSay', { msg: 'This is a message sent to the test room' });
  },10_000)

```

client.js ：

```js

  // client.js:
  // const { WebSocketConnector } = require('websocket-cross-server-adapter');
  const WebSocketConnector = require('../../src/WebSocketConnector');

  // Default value (if no command-line argument is specified)
  let port = 9000;
  let id = 1;

  // Parse command-line arguments. You can pass parameters dynamically when running the Node.js process.
  // For example: node client --id=16 --port=9001

  const args = process.argv.slice(2);
  args.forEach(arg => {
    if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--id=')) {
      id = arg.split('=')[1];
    }
  });

  console.log(`Using configured values - port: ${port}, id: ${id}`);


  const client = new WebSocketConnector({
    url: `ws://localhost:${port}`,
   
    customParams: {
      name: 'Sam',
      id
    },
    // To test different reconnection configurations, try stopping the server and observing the client's behavior

    //repeatLimit: 5,
    //fastReconnectThreshold: 1,
  
  });

  client.on('open', () => { 
    console.log('Connect success')
  })

  client.on('close', (event) => {
    console.log('onCode event:', event.code, event.reason);
    if (event.code === 4001 ||
      event.code === 4010 ||
      event.code === 4011 ||
      event.code === 4012
    ) {
      // Manual disconnect or forced logout by server under certain conditions — should not attempt to reconnect
      console.log('Connection closed manually or by forced logout/auth failure. No reconnection.');

      // Even though the connection has been closed, it is important to explicitly disable automatic reconnection and release all timers and WebSocket instances to prevent resource leaks.
      client.manualClose();

    } else {
      // For other cases, manually trigger reconnection
      client.reconnect();
    }
  })

  client.on('error', (event) => {
    console.log('Connect on error');
  });

  client.on('reconnect', ({ repeat, timeout }) => {
    console.log('Preparing for reconnection attempt #' + repeat + ', actual reconnection will occur in ' + timeout + ' ms');
  })

  client.on('repeat-limit', (repeatLimit) => {
    console.log('Reached maximum reconnection attempts: ' + repeatLimit);
  })


  client.on('serverSay', (data) => {
    console.log('Received serverSay event:');
    console.log(data)
  })

  client.on('roomSay', (data) => {
    console.log('Received roomSay event:');
    console.log(data)
  })


  client.on('ping', () => { 
    console.log('Go to ping....')
  })

  client.on('pong', (speed) => { 
    // You can measure current network latency in the pong event
    console.log(`Network latency: ${speed} ms`);
  })


  setTimeout(async () => {
    // Send event with callback using Promise
    let data = await client.emitWithPromise('say', { msg: 'I am a client with ID: ' + id + ', and I need your promise callback.' }, {
      onPending: () => {
        console.log('requesting...')
      }
    });
    console.log('Received promise response:');
    console.log(data);
  }, 2000);


  setTimeout(() => {
    // Send event with callback using traditional callback
    client.emit('say', { msg: 'I am a client with ID: ' + id + ', and I need your callback.' }, (err, data) => {
      if (err) {
        console.log('Callback error occurred');
        console.log(err)
      } else {
        console.log('Received callback response:');
        console.log(data)
      }
    }, {
      onPending: () => {
        console.log('requesting...')
      },
      callbackTimeout: 1000
    })
  }, 4000);

  setTimeout(() => {
    // Simulate a client joining the test room
    client.emit('joinRoom', { msg: 'I want to join the test room' }, (err, data) => {
      if (err) {
        console.log('JoinRoon Callback error occurred');
        console.log(err)
      } else {
        console.log('JoinRoon Received callback response:');
        console.log(data)
      }
    })
  }, 6000);

```

#### Usage

1. Install dependencies

Run the following command in the project root directory to install required dependencies:

```bash
npm install
```

2. Navigate to the examples/cross-server directory:

```bash
cd examples/single-ws-server
```

3. Start the WebSocket server

Start with the default port:

```bash
node server
```

Or start with a custom port:

```bash
node server --port=9001

```
4. Start the client

Start with default settings:

```bash
node client

```

Or start with a specified client ID and port:

```bash
node client --id=16 --port=9001

```

⚠️ Note: Each client must have a unique id. Duplicate IDs are not allowed.

You may run multiple clients with different ids to observe various events.
To simulate reconnection scenarios, try shutting down the server, observe the client's reconnection behavior, and then restart the server to simulate the full cycle:

Disconnected → Reconnecting → Reconnected

#### Additional Notes 1: Targeted Messaging

To test **single-target** or **multi-target** message sending,  
please refer to the API documentation for the following functions and test accordingly:

- [`toSocketId()`](./api.en-US.md#tosocketidsocketid-event-data)
- [`toSocketIds()`](./api.en-US.md#tosocketidssocketids-event-data)

These functions allow you to send event messages to specific socket clients.

#### Additional Notes 2: WebSocket Startup Modes (noServer / with existing Server)

Besides the default port-based startup, the WebSocket server also supports two advanced modes:

#### ✅ 1. Starting WebSocket with an existing HTTP(S) server(Shared Port)

When starting a WebSocket server using an existing HTTP or HTTPS server, the WebSocket connection **shares the same port** as the HTTP(S) service.  
This works via the HTTP protocol’s **Upgrade mechanism**:

- The WebSocket client first sends a standard HTTP request with the `Upgrade: websocket` header;
- The HTTP(S) server receives the request and upgrades the connection to the WebSocket protocol;
- The upgraded connection is then **handled by the `ws.Server` instance**;
- As a result, both HTTP requests and WebSocket connections use the same underlying TCP port (e.g., 8080 or 443).

This approach is especially useful when you want your **web application (e.g., frontend pages or APIs) and WebSocket service to run on the same port**, simplifying deployment and port management.

For more details, please refer to the official documentation: [ws GitHub - External HTTPS Server](https://github.com/websockets/ws?tab=readme-ov-file#external-https-server)

You can attach WebSocket to an existing HTTP server:

```js
const http = require('http');
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');
const server = http.createServer();
const wsServer = new WebSocketCrossServerAdapter({
  wsOptions: {
    server
  }
});

server.listen(9000, () => {
  console.log('Server is running on port 9000');
});

wsServer.onWebSocketEvent('connection', (socket, req) => {
  console.log('Client connection');
})

// ............................other logic remains the same


```

#### ✅ 2. Using noServer Mode (Manually Handle Upgrade Request)

You can use the `noServer` mode to manually handle HTTP upgrade requests. This mode is useful when you want full control over the HTTP service and WebSocket upgrade process — for example, serving both HTTP and WebSocket connections on the same server.

**Use cases:**  
- Sharing the same port between WebSocket and HTTP(S)  
- Implementing custom authentication or permission checks  
- Fine-grained control over how and when to establish WebSocket connections

📚 See official documentation for details:  
[ws GitHub - noServer Mode](https://github.com/websockets/ws#client-authentication)

```js
  const http = require('http');
  const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');
  // const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
  const server = http.createServer();
  const wsServer = new WebSocketCrossServerAdapter({
    wsOptions: {
      noServer: true
    }
  });

  server.listen(9000, () => {
    console.log('Server is running on port 9000');
  });

  server.on('upgrade', (req, socket, head) => {
    // 1. Check that the Upgrade header must be 'websocket'
    if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const data = wsServer.parseWsRequestParams(req);
    console.log('Passed parameters:')
    console.log(data)

    const id = data.params.id;
    console.log("Connected client id: " + id);

    if (id) {
      // Get the WebSocket.Server instance from wsServer and handle the WebSocket protocol upgrade
      wsServer.getWss()?.handleUpgrade(req, socket, head, (ws) => {
        // Simulate authentication and bind playerId to the WebSocket instance
        ws.playerId = String(id);
        // Manually emit the 'connection' event so the connection goes through the standard handler
        wsServer.getWss()?.emit('connection', ws, req);
      })
    } else {
      // Simulate authentication failure, return 401 error and close connection
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); // Send HTTP response to reject the connection
      socket.destroy(); // Destroy the socket connection
    }
  });

  wsServer.onWebSocketEvent('connection', (socket, req) => {
    console.log('Client connection');
    console.log('Client id: ' + socket.playerId);
    //.................... other logic remains the same
  })

  // ............................ other logic remains the same

```

#### ✅ Recommended WebSocket Authentication Approach

In real-world applications, it is recommended to complete user authentication **as soon as the client initiates the connection request**, with the server validating the identity information upon receiving the request.  
Avoid deferring authentication until after the connection is established and then forcibly disconnecting unauthenticated clients. This approach can lead to unnecessary server resource consumption and increased security risks.  
If you must perform authentication **after** the connection is established, be sure to implement a timeout mechanism for unauthenticated clients or periodically inspect and clean up invalid connections to prevent resource exhaustion caused by malicious or idle clients.

It is recommended to use modules like [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) to verify tokens provided in the request.  

> **Additionally, it's recommended to perform authentication via an HTTP endpoint before initiating the WebSocket connection.**  
> This is because during the WebSocket upgrade process, authentication failure messages are handled inconsistently across platforms and client environments.  
> In many cases, the client may not receive clear error codes or reasons, making reconnection and error handling unreliable.  
> Performing authentication in advance via HTTP can avoid these issues, improving user experience and connection stability on the client side.


#### 💬 Example Summary

The above example demonstrates the typical use cases and key features of a **single WebSocket server architecture (non-distributed)**. It includes:

#### ✅ Client-side:
- Supports **message sending with callbacks** (request-response pattern)
- Built-in **reconnection**, with support for manual disabling
- **Heartbeat mechanism** to ensure connection liveness and detect disconnects
- Unified event handling interface for easy extension
- Handles **disconnect and error events** for better stability and recovery
- Supports **server-side event registration and handling**
- Supports **local event registration and handling**

#### ✅ Server-side:
- Supports mapping between **connected clients and business IDs**
- Listens to and handles **client-triggered events**
- Implements authentication flows based on different connection modes, such as fixed port, HTTP shared port, and automatic upgrade handling
- Simulates **broadcast messaging and room-based message delivery**
- Responds to **callback-based requests** from clients
- Simulates **business-level message handling and response**

With these features, the above example essentially covers all major use cases of WebSocket in a single-server context.  
**A deep understanding of the single WebSocket server communication flow lays a solid foundation for building the upcoming distributed messaging architecture.**

If your project doesn't require cross-server or distributed features right now, feel free to hit the pause button here and just return—gracefully skip the cross-server part.  
Even if you don’t need it now, it’s worth a quick look as we move on to the next chapter with cross-server examples.

---

### 2. Cross-Server Communication Module (Pure Server Communication)

After finishing the single WebSocket server module in Chapter 1, we now dive into inter-service communication — the **CrossServer Communication Module**.  
This example is completely **decoupled from WebSocket**, focusing purely on how server nodes interact with each other in a distributed architecture.

**This module covers the following core features:**

- Server-to-server event broadcasting and reception  
- Targeted and global message delivery  
- Request-response pattern across servers (Promise-supported)  
- Centralized event dispatcher based on event names  
- Robust error handling and timeout control

**Use Cases:**

Ideal for communication between services running in separate processes or across physical machines, such as:

- HTTP server ↔ image server  
- Main application server ↔ file storage server  
- API gateway ↔ AI inference server  
- Event-driven messaging between logical microservice nodes

This provides a general-purpose solution for decoupling system architecture and building a scalable microservice environment.

> 💡 This module forms the backbone of the `WebSocketCrossServerAdapter`, enabling deeper understanding of cross-service event routing and synchronization.

#### Prerequisites: Choosing a Middleware

To enable communication across multiple servers, you need a **middleware layer** responsible for managing and dispatching messages between nodes.  
Here are some commonly used middleware/message systems suitable for this purpose:

- **Redis Pub/Sub**: Lightweight and efficient, ideal for small to medium distributed systems; easy to integrate in Node.js.
- **NATS**: A high-performance messaging system supporting both pub-sub and request-reply patterns; great for microservices.
- **RabbitMQ**: A feature-rich message queue with complex routing, persistence, and acknowledgment mechanisms.
- **Kafka**: High-throughput and durable, well-suited for large-scale, data-intensive systems.
- **Custom WebSocket Server**: For simpler use cases, you can even use a standalone WebSocket server as the central message hub for cross-service communication.

#### Why Redis Pub/Sub?

- **Seamless with Node.js**: Redis has mature client libraries like `ioredis` and `redis` for Node.js. It’s well-documented and widely adopted in the Node.js ecosystem.
- **Lightweight and efficient**: Being an in-memory store, Redis provides extremely low-latency message delivery, ideal for real-time systems.
- **Simple deployment**: Easy to install and run locally during development, and flexible to deploy in production environments.
- **Decentralized message broadcasting**: Pub/Sub allows dynamic topic-based publishing and subscribing across processes or servers without needing a central coordinator.
- **Scalable architecture**: Even as your system scales horizontally, Redis supports clustering and persistence to meet future demands.

- **Official Resources**:
  - Redis Website: [https://redis.io](https://redis.io)  
  - Redis GitHub: [https://github.com/redis/redis](https://github.com/redis/redis)  
  - ioredis GitHub: [https://github.com/redis/ioredis](https://github.com/redis/ioredis)  
  - node-redis GitHub: [https://github.com/redis/node-redis](https://github.com/redis/node-redis)

#### Installing Redis 

Before using this project, you need to have Redis service installed in advance.  
Installation guides and related resources:

- Redis Official Website: [https://redis.io/docs/getting-started/installation/](https://redis.io/docs/getting-started/installation/)  
- Redis GitHub: [https://github.com/redis/redis](https://github.com/redis/redis)  
- Redis Windows Builds: [https://github.com/tporadowski/redis/releases](https://github.com/tporadowski/redis/releases)  

After installing Redis, start the Redis service:

```bash
redis-server
```
Or start with a specified config file (Windows platform):
```bash
redis-server redis.windows.conf
```
You can test if Redis started successfully by running:
```bash
redis-cli ping
```
If it returns:
```bash
PONG
```
It means the Redis service is running properly.

Starting Multiple Redis Instances 
You can start multiple Redis instances by copying and modifying the configuration files, each listening on a different port.

Example steps:

1. Copy the default config file (assuming Linux/macOS):

```bash
cp /etc/redis/redis.conf /etc/redis/redis-6380.conf
cp /etc/redis/redis.conf /etc/redis/redis-6381.conf
```
2. Modify the port in the new config file (e.g. redis-6380.conf):
```bash
port 6380
```
3. Start multiple Redis instances with the corresponding config files:
```bash
redis-server /etc/redis/redis-6380.conf
redis-server /etc/redis/redis-6381.conf
```
4. Alternatively, start instances directly with command line parameters (good for testing):
```bash
redis-server --port 6380
redis-server --port 6381
```
Windows

Similarly, copy and modify the config files for different ports and run multiple redis-server processes:
```bash
redis-server redis-6380.conf
redis-server redis-6381.conf
```
Or start multiple instances directly:
```bash
redis-server --port 6380
redis-server --port 6381
```

#### Notes 
- Each instance must use a different port.
- If you need to enable remote access, please refer to the official configuration file documentation and modify the bind setting to allow connections from the desired hosts.

After completing the preparation, let's start our cross-service communication example.

Our WebSocketCrossServerAdapter internally uses **ioredis** as the Node.js client library for interacting with Redis. Only utilizes Redis's **Publish/Subscribe** (Pub/Sub) feature and does **not** involve any data persistence or key-value storage, ensuring a lightweight, fast, and stateless design.

This framework uses ioredis as the underlying Redis client.
All Redis-related configuration parameters are passed directly to ioredis.
For detailed configuration options and usage, please refer to the official ioredis documentation for best practices and comprehensive guidance.

- ioredis GitHub :[https://github.com/redis/ioredis](https://github.com/redis/ioredis)  

#### Example start

cserver.js:
```js
// cserver.js
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

// Fill in your Redis configuration info, supports multiple instances.
// Make sure the Redis service is already running.
// Supports multiple Redis nodes. If multiple nodes are used, each publish operation will select one node
// based on the configured strategy to achieve "load balancing". For different strategies, please refer to the API documentation.
// The health status of each node is maintained internally.
// Important: At least one Redis node must be provided for cross-service communication to work properly.
const redisConfig = [
  { port: 6379, host: '127.0.0.1' },
  //{ port: 6380, host: '127.0.0.1' },
  // You can add more nodes
];


// Be sure to assign a unique name to each server instance when starting multiple servers to avoid conflicts
let serverName = 'serverA';


// Parse command-line arguments. You can pass parameters dynamically when running the Node.js process.
// For example: node cServer --name=serverA
const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--name=')) {
    serverName = arg.split('=')[1];
  }
});

console.log(`Using configured values - serverName: ${serverName}`);

const crossServer = new WebSocketCrossServerAdapter({
  redisConfig,
  serverName,
 
  // Register an event listener to monitor the health status of Redis nodes.
  // This function will be triggered whenever the health status of any Redis node changes.
  // 
  // {
  // host，(Redis node host)
  // port，(Redis node port)
  // serverName，(Current server name)
  // event，(Triggered event name, e.g., connect, error)
  // isHealthy，(Whether this Redis node is healthy)
  // error， (Error message if any)
  // healthySubscriberCount，(Number of healthy subscriber instances)
  // healthyPublisherCount，(Number of healthy publisher instances)
  // totalNodeCount，(Total number of Redis nodes, both publisher and subscriber)
  // typeRedis，(Redis instance type: publisher or subscriber)
  //};
  onRedisHealthChange: (health, info) => {
    console.log(`Node health status changed:${health}`, info);
  },

  // Triggered when there is an error subscribing to a channel
  // The `info` object contains the following information:
  // {
  // host - Host address of the Redis instance
  // port -  Port number of the Redis instance
  // serverName -  Name of the current server
  // channel -  Name of the Redis channel that failed subscription
  // event -  Event that triggered the subscription action, e.g. "subscribe" or "unsubscribe"
  // error -  Error message describing the subscription failure
  // }
  onRedisSubscriptionError: (info) => { 
    console.log('onRedisSubscriptionError:', info);
  }
});


// Register cross-server event listener
crossServer.onCrossServerEvent('say', (data, callback) => {
  // The actual sent data can be accessed via the data.message property
  console.log('Received "say" event from another server:', data);
 
  // If the sender uses callback or Promise to send the message, then callback is a valid function and can be called directly to respond
  if (callback) {
    callback({ msg: `Hi, this is server ${crossServer.getServerName()} responding to you` })
  }
})

```

sender.js:
```js
// sender.js
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

const redisConfig = [
  { port: 6379, host: '127.0.0.1' },
  //{ port: 6380, host: '127.0.0.1' },
];

let serverName = 'senderA';

const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--name=')) {
    serverName = arg.split('=')[1];
  }
});

console.log(`Using configured values - serverName: ${serverName}`);

const crossServer = new WebSocketCrossServerAdapter({
  redisConfig,
  serverName,
  onRedisHealthChange: (health, info) => {
    console.log(`Node health status changed:${health}`, info);
  },
  onRedisSubscriptionError: (info) => { 
    console.log('onRedisSubscriptionError:', info);
  }
});

// Register cross-server event listener
// If the targetServer includes itself (i.e., in a global broadcast without excluding self,
// or targetServer explicitly includes its own serverName),
// then this server will also respond to the event it sent.
// The event handling happens directly in the local context without passing through Redis channels.
// Thus, you do not need to handle local events specially; all optimizations are handled internally.
crossServer.onCrossServerEvent('say', (data, callback) => {
  console.log('Received "say" event from another server:');
  console.log(data);
  if (callback) {
     callback({ msg: `Hi, this is server ${crossServer.getServerName()} responding to you` })
  }
})

// Sending a "say" event message without expecting any callback
setTimeout(() => {
  crossServer.emitCrossServer('say', {
   content: `Hi everyone, I am ${crossServer.getServerName()}`
  },null, {
    targetServer: [],
  })
}, 3000);

// Send a "say" event message with a callback, expecting a response from the target server
setTimeout(() => {

  // The callback function will be executed each time a server responds
  crossServer.emitCrossServer('say', {
   content: `Hi everyone, I am ${crossServer.getServerName()}, please respond with your callback.`
  }, (result) => {
    console.log('Callback response result:', result);
   
    if (result.success) {
      console.log('Received server callback:', result.data);
      console.log('Number of servers yet to respond:', result.remainingResponses);
    } else {
      // Timed out before collecting all responses
      console.log('Error message:', result.error);
      console.log('Number of servers that did not respond:', result.unrespondedCount);
    }
  }, {
    targetServer: [],
    expectedResponses: 3,
    // exceptSelf: false,
    // timeout: 2000,
  })
}, 6000);

// Send a "say" event message using a Promise, expecting a response from the target server
setTimeout(async () => {

  // The Promise will be resolved after all expected responses are received; 
  // if not all responses arrive before the timeout, it will still resolve, but with result.success set to false.
  let result = await crossServer.emitCrossServerWithPromise('say', {
    content: `Hi everyone, I am ${crossServer.getServerName()}, please respond with your callback for the promise.`
  }, {
    targetServer: [],
    expectedResponses: 3,
    // exceptSelf: true,
    // timeout: 2000,
  })

  console.log('Promise response result:', result);
  if (result.success) {
    console.log('All expected nodes responded:', result.responses);
  } else {
    console.log('Nodes that have responded so far:', result.responses);
    console.log('Number of servers that did not respond: ' + result.unrespondedCount);
  }

  // You can also use the then method
  
  // crossServer.emitCrossServerWithPromise('say', {
  //   content: `Hi everyone, I am ${crossServer.getServerName()}, please respond with your callback for the promise.`
  // }, {
  //   targetServer: [],
  //   expectedResponses: 3,
  //   // exceptSelf: true,
  //   // timeout: 2000,
  // }).then((result) => { 

  // })

}, 15_000);

```
#### Usage

**Please make sure that the Redis service is running on port 6379 before starting this example.**

1. Make sure you have run npm install in the project root directory to install required dependencies. Otherwise, subsequent commands may not work properly.

```bash
npm install
```

2. Navigate to the examples/cross-server directory:

```bash
cd examples/cross-server
```

3. Quickly start multiple servers (recommended)

  [concurrently](https://www.npmjs.com/package/concurrently)is a tool that allows you to start multiple server instances with one command:

```js
npx concurrently "node cserver --name=serverA" "node cserver --name=serverB" "node cserver --name=serverC" "node cserver --name=serverD" "node cserver --name=serverE"
```

📌 **📌 Note: Although all servers share the same terminal window for output logs, each server is still an independent Node.js process, fully isolated from each other. concurrently just aggregates their console output for easier observation.**

4. Manually start servers (more intuitive)

If you prefer each server to run in its own separate terminal window for easier log viewing or debugging, start them individually:

Start a default server:

```bash
node cserver

```
Or start a server with a custom name:

```bash
node cserver --name=serverB

```
⚠️ **⚠️ Each server name must be unique. This is essential to ensure the distributed system works correctly, otherwise it may cause node identification conflicts or message routing errors.**。

5. Start the message sender server

This server is used to test cross-server communication sending:

```bash
node sender 

```
Or start with a custom name:

```bash
node sender --name=senderB

```

Once started successfully, you will see event communications and callback responses between multiple servers, verifying the distributed communication capability of the system.

You can try different parameter configurations, such as:

- Excluding the sender itself from receiving the message
- Targeting specific servers for message delivery
- Setting a timeout duration
- Specifying the expected number of server responses 

- `targetServer: []`  
  An empty array indicates **broadcast mode**, where all servers will receive the message.  
  You can use it with `exceptSelf: true` to **exclude the current server** from receiving the message.

- `targetServer: ['serverA', 'serverB']`  
  Specify the **target server names** (supports multiple) to enable **targeted message delivery**.  
  Only the specified servers will receive the event.

For more details in the API documentation:
[`emitCrossServer`](./api.en-US.md#emitcrossserverevent-message-callback-options) 与
[`emitCrossServerWithPromise`](./api.en-US.md#emitcrossserverwithpromiseevent-message-options)。

#### Cross-Server Communication Example Summary

By using the cross-server communication features of **WebSocketCrossServerAdapter**, you can easily achieve efficient communication between server nodes in multi-process or distributed environments. Whether it's targeted messaging, broadcasting, callback mechanisms, or multi-node response aggregation, all these scenarios are well supported to help build a stable and flexible distributed system.

---

### 3. WebSocket + CrossServer Distributed Communication Example (Cross-Service Scenario)

In the previous two chapters, we have achieved the following:

1. **Single WebSocket Server Mode (Non-distributed)**  
  Demonstrated how to use WebSocket in a single service instance for client communication, including event listening, message sending, and callback handling.

2. **Cross-Server Communication Module (Server-to-Server Only)**  
  Demonstrated how different service nodes communicate via Redis to achieve event broadcasting, targeted messaging, and asynchronous callback handling.

Next, we will move to a more advanced scenario: **combining WebSocket with the CrossServer module** to achieve true **WebSocket distributed communication**, featuring:

- Each service node maintains its own client connections independently  
- Client-originated events can be broadcast to other server nodes via CrossServer  
- Supports advanced features like targeted messaging, callback responses, and data aggregation  
- Enables seamless communication across physical machines, processes, or server instances  
- The message sending logic in a distributed WebSocket environment remains consistent with that of a single-server setup, requiring almost no code changes, significantly simplifying migration and development effort
This model combines the real-time communication capabilities of WebSocket with the distributed event coordination mechanism of CrossServer, thereby enabling an efficient, stable, and scalable real-time communication solution across multiple processes, instances, and even physical machines.

#### Example start

wsserver.js:
```js
// wsserver.js
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

const redisConfig = [
  { port: 6379, host: '127.0.0.1' },
  //{ port: 6380, host: '127.0.0.1' },
];

const args = process.argv.slice(2); 
let port = 9000;
let serverName = 'serverA';

args.forEach(arg => {
  if (arg.startsWith('--port=')) {
    port = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--name=')) {
    serverName = arg.split('=')[1];
  }
});

console.log(`Using configured values - serverName: ${serverName}，port: ${port}`);

if (!(port && serverName)) { 
    throw new Error("Invalid port or server name");
}

const wsCrossServer = new WebSocketCrossServerAdapter({
  redisConfig,
  serverName,
  wsOptions: {
    port
  }
});


wsCrossServer.onWebSocketEvent('connection', async (socket, req) => {

  const data = wsCrossServer.parseWsRequestParams(req);
  console.log(`[${wsCrossServer.getServerName()}] Client Connection params：`, data);
  if (data.params.id) {
    const playerId = String(data.params.id);
    socket.playerId = playerId;
    wsCrossServer.setUserSocket(playerId, socket);
  } else {
    socket.close(4011, 'Auth failure');
  }
})

wsCrossServer.onWebSocketEvent('close', async (socket, req) => { 
  console.log(`[${wsCrossServer.getServerName()}] Client ${socket.playerId} disconnected`);
  if (socket.playerId) { 
     wsCrossServer.removeUserSocket(socket.playerId);
  }
})


wsCrossServer.onWebSocketEvent('joinRoom', (socket, data, callback) => {

  if (socket.playerId && data && data.roomId) {
    console.log(`[${wsCrossServer.getServerName()}] Client ${socket.playerId} wants to join room ${data.roomId}`);
    wsCrossServer.joinRoom('chat', String(data.roomId), socket.playerId);
    callback?.({ msg: 'Successfully joined the roomId:' + data.roomId });
  } else {
    callback?.({ msg: 'Failed to join the room' });
  }
});


wsCrossServer.onWebSocketEvent('command', (socket, data, callback) => {
  console.log(`[${wsCrossServer.getServerName()}] Received 'command' event from client ${socket.playerId}:`, data);

  if (!data || typeof data.action !== 'string') {
    callback?.({ msg: 'Failed to send message' }); 
    return;
  }
  const { action, msg, toPlayerId, toPlayerIds, roomId } = data;
  switch (action) {
    case 'broadcast':
      wsCrossServer.broadcast('say', { action, msg });
      break;

    case 'toPlayer':
      if (toPlayerId) {
        wsCrossServer.toSocketId(String(toPlayerId), 'say', { action, msg });
      }
      break;

    case 'toPlayers':
      if (Array.isArray(toPlayerIds)) {
        wsCrossServer.toSocketIds(toPlayerIds, 'say', { action, msg });
      }
      break;

    case 'toRoom':
      if (roomId) {
        wsCrossServer.broadcastToRoom('chat', String(roomId), 'say', { action, msg });
      }
      break;

    default:
      callback?.({ msg: 'Unknown action type' }); 
      return;
  }

  callback?.({ msg: `Message sent successfully [action:${action}] ` });
});

```

clients.js:

```js
// clients.js
// const { WebSocketConnector } = require('websocket-cross-server-adapter');
const WebSocketConnector = require('../../src/WebSocketConnector');

const totalClients = 50;

const basePort = 9000;
const portRange = 5;

// Randomly determine the number of clients that will send join room requests
const joinRoomCount = 10; 
const joinRoomClientIds = new Set();

// Randomly select 10 client IDs
while (joinRoomClientIds.size < joinRoomCount) {
  joinRoomClientIds.add(Math.floor(Math.random() * totalClients) + 1);
}

// Predefine some room IDs
const roomIds = ['1000', '1001', '1002'];

// Simulate multiple clients connecting to different WebSocket servers
for (let i = 0; i < totalClients; i++) {
  const port = basePort + (i % portRange);
  const id = i + 1;

  const client = new WebSocketConnector({
    url: `ws://localhost:${port}`,
    customParams: {
      id: id
    }
  });

  client.on('open', () => {
    console.log(`[Client ${id},port:${port}] Connect success`)
    // If this client is in the randomly selected list, send a join room message
    if (joinRoomClientIds.has(id)) {
      client.emit('joinRoom', { roomId: roomIds[Math.floor(Math.random() * roomIds.length)] }, (err, data) => {
        if (err) {
          console.log(`[Client ${id},port:${port}] JoinRoom Callback error occurred`);
          console.log(err)
        } else {
          console.log(`[Client ${id},port:${port}] Received joinRoom callback response:`);
          console.log(data.message)
        }
      })
    }
  })

  client.on('close', (event) => {
    console.log(`[Client ${id},port:${port}] onCode event:`, event.code, event.reason);
  })

  client.on('say', (data) => {
    console.log(`[Client ${id},port:${port}] Received say event:`, data);
  });

}


```
boss.js:

```js
// boss.js
// const { WebSocketConnector } = require('websocket-cross-server-adapter');
const WebSocketConnector = require('../../src/WebSocketConnector');

let port = 9000;
let id = 555;

const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--port=')) {
    port = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--id=')) {
    id = arg.split('=')[1];
  }
});

console.log(`Using configured values - port: ${port}, id: ${id}`);

const client = new WebSocketConnector({
  url: `ws://localhost:${port}`,
  customParams: {
    id
  }
});

client.on('open', () => { 
  console.log('Connect success')
})

client.on('close', (event) => {
  console.log('onCode event:', event.code, event.reason);
 
})

client.on('say', (data) => {
  console.log(`Received say event:`, data);
});

setTimeout(async () => {
  client.emit('command', { action: 'broadcast', msg: 'Hello every one' }, (err, data) => {
    if (err) {
      console.log('Callback error occurred');
      console.log(err)
    } else {
      console.log('Received callback response:');
      console.log(data)
    }
  })
}, 6_000);

setTimeout(async () => {
  client.emit('command', { action: 'toPlayer', msg: 'Hello player 13 ', toPlayerId: '13' }, (err, data) => {
    if (err) {
      console.log('Callback error occurred');
      console.log(err)
    } else {
      console.log('Received callback response:');
      console.log(data)
    }
  })
}, 9_000);

setTimeout(async () => {
  client.emit('command', { action: 'toPlayers', msg: 'Hello group players ', toPlayerIds: ['3','10','25','37'] }, (err, data) => {
    if (err) {
      console.log('Callback error occurred');
      console.log(err)
    } else {
      console.log('Received callback response:');
      console.log(data)
    }
  })
}, 12_000);

setTimeout(async () => {
  client.emit('command', { action: 'toRoom', msg: 'Hello room players ', roomId: '1000' }, (err, data) => {
    if (err) {
      console.log('Callback error occurred');
      console.log(err)
    } else {
      console.log('Received callback response:');
      console.log(data)
    }
  })
}, 15_000);

```

#### Usage

**Please make sure that the Redis service is running on port 6379 before starting this example.**

1. Start five WebSocket servers

Navigate to the examples/ws-cross-server directory and run the following command to start five WebSocket server instances simultaneously with different names and ports using concurrently:

```bash
npx concurrently "node wsserver --name=serverA --port=9000" "node wsserver --name=serverB --port=9001" "node wsserver --name=serverC --port=9002" "node wsserver --name=serverD --port=9003" "node wsserver --name=serverE --port=9004"
```
 **Note**：concurrently will aggregate the logs of all servers into a single terminal window. If you prefer each server to have its own separate window, you can start them manually using these commands:

```bash
node wsserver --name=serverA --port=9000
node wsserver --name=serverB --port=9001
node wsserver --name=serverC --port=9002
node wsserver --name=serverD --port=9003
node wsserver --name=serverE --port=9004
```

Make sure each server has a **unique** name to avoid node name conflicts.

2. Start simulated clients

Run the following command to start 50 simulated clients. These clients will randomly connect to any of the servers above and randomly join a subset of clients to test rooms.

```bash
node clients
```

3. Start the simulated control client to send commands

Start the control client with the following command. It simulates sending various commands such as broadcast, point-to-point, group, and room messages:

```bash
node boss
```

#### Expected Results

After running the above example, you should observe the following distributed communication features in action:

- Even when clients are connected to different WebSocket server nodes, they can:
  - ✅ **Receive global broadcast messages** (e.g., `broadcast`)
  - ✅ **Correctly receive peer-to-peer messages** (e.g., `toPlayer` targeting a specific client)
  - ✅ **Receive group messages sent to multiple clients** (e.g., `toPlayers`)
  - ✅ **Successfully receive room-targeted messages** (e.g., `toRoom`)

These features demonstrate that:

> - WebSocket server nodes communicate through Redis to synchronize events and route messages.  
> - In a distributed setup, the message-sending logic remains nearly identical to a single-server setup, allowing developers to focus on business logic rather than deployment complexity.  
> - The system fully supports **true WebSocket-based distributed communication**.

---

## Example Summary

Through the examples in the three sections above, you can progressively understand the entire workflow of distributed communication — starting from **standalone WebSocket communication**, to **cross-node communication between servers**, and finally to **collaboration between WebSocket clients and the distributed backend system**. Each stage is grounded in practical scenarios, helping you build a clear and comprehensive understanding of the WebSocket-based distributed architecture.

---

## FAQ

### 1. How to implement message forwarding and callback from client → WebSocket server → logic server?
In a typical game scenario, the client sends a request (e.g., a matchmaking request) to the WebSocket server it is connected to. These requests are usually processed by a dedicated game logic server (e.g., GameServer), and the result is returned to the client.

Below are two common implementation strategies:

#### Option 1: WebSocket server handles the callback to the client

**The game server processes the logic and returns the result to the WebSocket server, which then responds to the client.**

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
#### Option 2: GameServer directly responds to the client

**Instead of routing the result back through the WebSocket server, the gameServer directly triggers a response to the target client.**

This is especially useful when you want to simplify the callback logic and let the logic server communicate with the client as if it were local.

The changes are as follows:
2. The WebSocket server receives the request and forwards it to gameServer, including client callback metadata:
```js
wsServer.onWebSocketEvent('matchRequest', (socket, data, callback) => {
  wsServer.emitCrossServer('matchRequest', {
    autoClientCallback: true,           // Enable auto-response to client
    clientSocketId: socket.socketId,    // Target client's socketId
    clientCallbackId: data.callbackId,  // Original callback identifier from client
    data
  }, null, {
    targetServer: ['gameServer'],
  });
});
```
3. The gameServer processes the event and uses the provided clientCallback to respond directly to the client:
```js
gameServer.onCrossServerEvent('matchRequest', (data, callback, clientCallback) => {
  const matchResult = { success: true, roomId: 'abc123' };

  // Use clientCallback to return the result directly to the client
  if (clientCallback) {
    clientCallback(matchResult);
  }
});

```
#### 📝 Note: 

In fact, the clientCallback essentially routes back to the client through the original WebSocket server.
However, in terms of logical design, you no longer need to worry about returning to the original WebSocket server, thereby reducing relay code and coupling.

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

---

## Contact

If you have any questions or suggestions while using this project, feel free to contact me anytime.
You can also report issues or provide feedback via the GitHub repository's Issues page.

To prevent your email from being classified as spam, please add [WebSocketCrossServerAdapter] at the beginning of the email subject or body.

Email: 349233775@qq.com

---

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
