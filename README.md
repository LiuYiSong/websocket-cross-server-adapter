# 🚀 A Node.js-Based WebSocket Distributed Framework for Multi-Server Communication

[中文版 README](./README.zh-CN.md)

## Table of Contents

- [Why Build This Framework?](#why-build-this-framework)
- [How It Works (Core Architecture)](#how-it-works-core-architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
   - [English API Documentation](./api.en-US.md)
   - [中文API文档](./api.zh-CN.md)
- [Usage Example](#usage-example)
  - [1. Single WebSocket Server Mode (Non-Distributed)](#usage-example)
  - [2. Cross-Server Communication Module (Pure Server Communication)](#2-cross-server-communication-module-pure-server-communication)
  - [3. WebSocket + CrossServer Distributed Communication Example (Cross-Service Scenario)](#3-websocket--crossserver-distributed-communication-example-cross-service-scenario)
- [FAQ](#faq)
- [Contact](#Contact)
- [License](#License)

## Why Build This Framework?

The native [ws](https://github.com/websockets/ws) module provides basic WebSocket communication capabilities but is very low-level. The WebSocket standard protocol on the client side only implements fundamental communication mechanisms and lacks advanced features such as heartbeat maintenance, automatic reconnection, message callbacks, and more, which developers need to implement at the application layer. In real-world projects, Node.js's single-threaded model and memory limitations make it difficult for a single process to handle high concurrency connections and complex business logic. When horizontal scaling and running multiple processes or servers become necessary, the challenges intensify: how to synchronize user and room states across multiple nodes? How to broadcast messages across nodes? How to ensure the correctness and consistency of communication logic? These are issues that ws alone cannot solve directly. Therefore, we designed this framework to keep the development experience simple while providing features that native ws cannot cover — including distributed room and connection management, cross-server communication, event callback mechanisms, and more — allowing developers to focus on their business logic rather than the complexities of communication details and distributed architecture.

## How It Works (Core Architecture)

### WebSocketCrossServerAdapter (Server Communication Core)

This adapter leverages Redis's pub/sub mechanism to achieve cross-server message broadcasting and event synchronization. It supports decentralized communication between multiple nodes, with built-in health monitoring and automatic recovery to ensure high availability. It supports both single-server multi-process deployment and cross-physical server deployment, enabling elastic scaling.

Key Features:  
- Cross-node event communication with support for callbacks/Promises  
- Dynamic management of Redis nodes, with support for compressed transmission  
- Distributed room broadcasting and client tracking  
- Local-first response with automatic target node routing  
- Hot-pluggable scaling without needing a restart  

Supported Message Sending Methods:  
- Global broadcast  
- Precise single-client sending  
- Batch sending by socketId  
- Distributed room broadcasting  

No matter which WebSocket server node the client is connected to, messages can be delivered precisely.

Supports room namespace management and cross-node statistics (e.g., online users, room members). 

### WebSocketConnector (Client Connection Manager)

A lightweight and simple WebSocket client class, suitable for any platform based on the standard WebSocket protocol, such as browsers, Node.js, Electron, React Native, mobile apps, mini-programs, Cocos Creator, etc. It includes heartbeat mechanism, reconnection, event callbacks, and delayed feedback, with clear logic and easy integration. The compressed size is only around 5KB, making it ideal for various real-time communication scenarios in front-end applications.

Supported Features:  
- Reconnection on disconnect  
- Heartbeat keep-alive mechanism  
- Network latency detection (based on ping-pong)  
- `emit` with callback and timeout handling  
- Delayed response callbacks (useful for loading screens, etc.)  
- URL parameter injection support  

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
    console.log('onClose event:', event.code, event.reason);
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


To test **single-target** or **multi-target** message sending,  
please refer to the API documentation for the following functions and test accordingly:

- [`toSocketId()`](./api.en-US.md#tosocketidsocketid-event-data)
- [`toSocketIds()`](./api.en-US.md#tosocketidssocketids-event-data)

These functions allow you to send event messages to specific socket clients.


#### 💬 Example Summary

The above example fully demonstrates the typical scenarios and key features of communication using a **single WebSocket server** under a non-distributed architecture. It includes connection event management, heartbeat mechanism, network status detection, event registration and handling, request-response callback mechanism, room broadcasting, and automatic reconnection. This covers most common application scenarios and requirements in single-server mode, helping developers quickly build a stable and feature-complete WebSocket service. If distributed functionality is not required, the single-server mode can already meet the majority of common WebSocket application needs.

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

Or manually start servers (more intuitive)

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

4. Start the message sender server

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

Next, we will move to a more advanced scenario: **combining WebSocket with the CrossServer module** to achieve true **WebSocket distributed communication**.

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
          console.log(data)
        }
      })
    }
  })

  client.on('close', (event) => {
    console.log(`[Client ${id},port:${port}] on Close event:`, event.code, event.reason);
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
  console.log('onClose event:', event.code, event.reason);
 
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

### WebSocket Distributed Example Summary

By combining the WebSocket and CrossServer modules, true WebSocket distributed communication can be easily achieved. Regardless of which node the client connects to, the message delivery process remains consistent with the single-server mode, requiring no changes to the business code. This allows multiple processes and WebSocket servers to run on a multi-core machine, overcoming Node.js single-process memory and performance limitations, and fully utilizing hardware capabilities. Additionally, this architecture supports easy deployment across multiple physical servers, requiring only the configuration of a common Redis node for cross-node communication. The overall design is simple and user-friendly, greatly enhancing system scalability and stability. Distributed WebSocket communication has never been this effortless...

---

## Example Summary

Through the examples in the three sections above, you can progressively understand the entire workflow of distributed communication — starting from **standalone WebSocket communication**, to **cross-node communication between servers**, and finally to **collaboration between WebSocket clients and the distributed backend system**. Each stage is grounded in practical scenarios, helping you build a clear and comprehensive understanding of the WebSocket-based distributed architecture.

---

## FAQ

- [FAQ](FAQ.en-US.md#faq)
  - [1. How to implement message forwarding and callback from client → WebSocket server → logic server?](FAQ.en-US.md#1-how-to-implement-message-forwarding-and-callback-from-client--websocket-server--logic-server)
  - [2. Does the server support callbacks when sending messages to clients?](FAQ.en-US.md#2-does-the-server-support-callbacks-when-sending-messages-to-clients)
  - [3. Will a user automatically leave rooms after the WebSocket connection is closed?](FAQ.en-US.md#3-will-a-user-automatically-leave-rooms-after-the-websocket-connection-is-closed)
  - [4. How to Dynamically Add Redis Nodes?](FAQ.en-US.md#4-how-to-dynamically-add-redis-nodes)
  - [5. How to Add a New WebSocket Server Node?](FAQ.en-US.md#5-how-to-add-a-new-websocket-server-node)
  - [6. Should every server node have the same Redis configuration?](FAQ.en-US.md#6-should-every-server-node-have-the-same-redis-configuration)
  - [7. How to Configure Redis Publish Strategy?](FAQ.en-US.md#7-how-to-configure-redis-publish-strategy)
  - [8. How Many Redis Nodes Are Appropriate?](FAQ.en-US.md#8-how-many-redis-nodes-are-appropriate)
  - [9. When Should the Redis Data Compression Feature Be Enabled in WebSocketCrossServerAdapter?](FAQ.en-US.md#9-when-should-the-redis-data-compression-feature-be-enabled-in-websocketcrossserveradapter)
  - [10. Does the WebSocket server-to-client data transmission support compression?](FAQ.en-US.md#10-does-the-websocket-server-to-client-data-transmission-support-compression)
  - [11. How Should Room Namespaces Be Designed?](FAQ.en-US.md#11-how-should-room-namespaces-be-designed)
  - [12. How to retrieve information about rooms or players in a distributed WebSocket service?](FAQ.en-US.md#12-how-to-retrieve-information-about-rooms-or-players-in-a-distributed-websocket-service)
  - [13. How to distribute users to different WebSocket servers in a distributed WebSocket service?](FAQ.en-US.md#13-how-to-distribute-users-to-different-websocket-servers-in-a-distributed-websocket-service)
  - [14. Does WebSocketConnector automatically reconnect after disconnection?](FAQ.en-US.md#14-does-websocketconnector-automatically-reconnect-after-disconnection)
  - [15. How to Use the WebSocketConnector Class in Frontend Environments?](FAQ.en-US.md#15-how-to-use-the-websocketconnector-class-in-frontend-environments)
  - [16. Can the WebSocketConnector client only pass parameters via the URL?](FAQ.en-US.md#16-can-the-websocketconnector-client-only-pass-parameters-via-the-url)
  - [17. How to securely and compatibly transmit authentication and other sensitive information?](FAQ.en-US.md#17-how-to-securely-and-compatibly-transmit-authentication-and-other-sensitive-information)
  - [18. Why does WebSocket still need a heartbeat mechanism? Isn’t the close event enough?](FAQ.en-US.md#18-why-does-websocket-still-need-a-heartbeat-mechanism-isnt-the-close-event-enough)
  - [19. How to Deploy a Node.js Service? Any Recommended Methods?](FAQ.en-US.md#19-how-to-deploy-a-nodejs-service-any-recommended-methods)
  - [20. Does the WebSocket service support sharing a port with an existing HTTP server?](FAQ.en-US.md#20-does-the-websocket-service-support-sharing-a-port-with-an-existing-http-server)
  - [21. How to test across physical servers?](FAQ.en-US.md#21-how-to-test-across-physical-servers)
---

## Contact

If you have any questions or suggestions while using this project, feel free to contact me anytime.
You can also report issues or provide feedback via the GitHub repository's Issues page.

To prevent your email from being classified as spam, please add [WebSocketCrossServerAdapter] at the beginning of the email subject or body.

Email: 349233775@qq.com

---

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
