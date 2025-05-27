# 🚀 一款基于 Node.js、支持多服务器协同通信的 WebSocket 分布式框架

## 目录

- [为什么要做这个框架？](#为什么要做这个框架)
- [实现原理](#实现原理)
- [开始使用](#开始使用)
- [接口文档](#接口文档)
  - [中文API文档](./api.zh-CN.md)
  - [English API Documentation](./api.en-US.md)
- [使用示例](#使用示例)
  - [一. 单 WebSocket 服务器模式（非分布式）](#一-单-websocket-服务器模式非分布式)
  - [二. 跨服务通信模块（纯服务端通信）](#二-跨服务通信模块纯服务端通信)
  - [三. WebSocket + CrossServer 分布式通信示例（跨服务场景）](#三-websocket--crossserver-分布式通信示例跨服务场景)
- [常见问题](#常见问题)
- [联系](#联系方式)
- [许可证](#许可证)

## 为什么要做这个框架？

原生的 [ws](https://github.com/websockets/ws) 模块虽然提供了基本的 WebSocket 通信能力，但它非常底层，像心跳检测、断线重连、消息回调、房间管理、广播等常见需求都需要开发者自行实现。而在实际项目中，Node.js 的单线程模型和内存限制也使得单进程很难支撑高并发连接和复杂业务逻辑。当你需要横向扩展、运行多个进程或服务器时，问题会进一步放大：多个节点之间如何同步用户和房间状态？消息如何跨节点广播？如何确保通信逻辑的正确性与一致性？这些都不是 [ws](https://github.com/websockets/ws) 能直接解决的。因此我们设计了这个框架，目标是在保持开发体验简单的前提下，提供原生 [ws](https://github.com/websockets/ws) 无法覆盖的功能，包括分布式的房间与连接管理、跨服务器通信、事件回调机制等，使开发者能专注于业务本身，而不是通信细节与分布式架构的复杂性。

## 实现原理

### WebSocketCrossServerAdapter（服务端通信核心）

该适配器基于 Redis 的发布订阅机制，实现跨服务器的消息广播与事件同步，支持多节点去中心化通信，具备健康监测和自动恢复，保障高可用性。支持单服务器多进程及跨物理服务器部署，便于弹性扩展。

主要功能：  
- 跨节点事件通信，支持回调/Promise  
- 动态管理 Redis 节点，支持压缩传输  
- 分布式房间广播和客户端追踪  
- 本地优先响应，自动路由目标节点  
- 热插拔扩容，无需重启  

消息发送支持(不管客户端连接在哪个Websocket服务节点，都能精准发送)：  
- 全局广播  
- 单客户端精准发送  
- 批量 socketId 发送  
- 分布式房间广播  

支持房间命名空间管理和跨节点统计（在线用户、房间人数等）。

### WebSocketConnector（客户端连接管理器）

一个轻量级、简洁的 WebSocket 客户端类，适用于任何基于标准 WebSocket 协议的平台，例如浏览器、Node.js、Electron、React Native、移动 App、小程序、Cocos Creator 等环境。内置心跳机制、断线重连、事件回调、延迟反馈等功能，逻辑清晰、易于集成，压缩后体积仅约 5KB，适合各类实时通信场景的前端接入。

支持功能：  

- 断线重连  
- 心跳保活机制  
- 网络延迟检测（基于 ping-pong 实现）
- emit 支持回调与超时处理  
- 延迟响应回调（可用于展示 loading 等）  
- 支持参数注入（URL）  

---

## 开始使用

  ```js
  npm install websocket-cross-server-adapter
  ```
---
## 接口文档

- [中文API文档](./api.zh-CN.md)
- [English API Documentation](./api.en-US.md)

---

## 使用示例

### 一. 单 WebSocket 服务器模式（非分布式）

如果你的项目仅需传统的单 WebSocket 服务器模式，则无需使用 Redis，也无需进行任何额外的分布式配置。

你只需像使用原生 [ws](https://github.com/websockets/ws) 模块那样传入配置信息即可。框架会自动以单服务器模式运行。

传入的 [ws](https://github.com/websockets/ws) 配置应使用对象形式，并遵循 [ws 模块官方文档](https://github.com/websockets/ws) 中的配置说明。

server.js:
```js
  // server.js:
  // 如果你不是在示例文件夹下运行，请将 require 地址换成包名：
  // const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
  const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

  // 如果你用的是 ES Module，可以这样写：
  // import { WebSocketCrossServerAdapter } from 'websocket-cross-server-adapter';
  // 默认的配置端口
  let port = 9000;

  // 解析命令行参数，可以在node命令行加上以下参数，动态配置prot，例如：node server --port=9001
 
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

    // 使用 WebSocketCrossServerAdapter 的辅助方法 parseWsRequestParams 解析 req 对象，
    // 获取客户端通过 WebSocketConnector 类创建连接时配置的参数信息，比如 token、自定义参数等等。
    const data = wsServer.parseWsRequestParams(req);

    console.log('Connection params：', data);

    // ✅ 使用客户端传来的 id 建立映射。实际业务中应在此处进行完整的身份验证（如 token 鉴权）。
    // 例如可使用 jsonwebtoken 模块校验 data.token，并根据验证结果决定是否继续。
    // 然而，我们更推荐在 noServer 模式下，在 WebSocket 协议升级阶段就完成鉴权逻辑，效率更高、也更安全。
    // ws 官方虽然提供了 verifyClient 参数用于连接时鉴权，但该 API 已不推荐使用，并可能在未来版本中移除。
    // 👉 建议查阅 ws 官方文档中的 noServer 模式以及 `server.on('upgrade')` 相关用法，了解推荐的鉴权方式。

    // 此处为了演示方便，仅直接使用客户端传来的 id。
    if (data.params.id) {
      const playerId = String(data.params.id);
      console.log('The client’s ID is：' + playerId);
      // 把 id 存储到 socket.playerId 中。具体存法请根据自身业务决定，
      // 比如 socket.player = { playerId, name } 等等。
      // 总之需确保能从 socket 上获取到该连接的唯一身份标识。
      socket.playerId = playerId;

      // 必须建立 id（必须为字符串类型）与 socket 实例的映射，
      // 后续房间广播、单点、多点推送才能找到对应实例。
      wsServer.setUserSocket(playerId, socket);

    } else {
      // 模拟鉴权失败，使用自定义关闭码（4011）关闭连接。
      // 这里的代码应根据自身业务逻辑定义。
      // 详细查看 API 客户端关于 close 事件部分解释。
      socket.close(4011, 'Auth failure');
    }
  });

  wsServer.onWebSocketEvent('close', (socket, req) => {
    console.log('Client disconnected，id:' + socket.playerId);

    if (socket.playerId) {

      // 客户端断开连接时，请务必删除 ID 和 socket 实例的映射，
      // 否则 socket 实例可能无法被释放，导致内存泄漏。
      wsServer.removeUserSocket(socket.playerId);
    }
  });

  wsServer.onWebSocketEvent('say', (socket, data, callback) => {
    console.log(`Received 'say' event from client ${socket.playerId}:`, data);

    if (callback) {

      // 如果客户端使用 emit 的时候带有回调，或者使用 emitWithPromise 发送消息，
      // 此时 callback 会为有效函数，此处可调用 callback 回传结果给客户端。
      callback({ msg: 'I am a callback for your say event' });
    }
  });

  wsServer.onWebSocketEvent('joinRoom', (socket, data, callback) => {
    console.log(`Received 'joinRoom' event from client ${socket.playerId}:`, data);
    if (socket.playerId) { 

      // 模拟加入testRoom，id为1000的房间
      wsServer.joinRoom('testRoom', '1000', socket.playerId);
    }
    if (callback) {
      callback({ msg: 'JoinRoom successfully' });
    }
  });

  // 模拟定时发送广播
  setInterval(() => { 
    wsServer.broadcast('serverSay', { msg: 'I’m sending this message to everyone' });
  }, 15_000)

  // 模拟定时向测试房间发送消息
  setInterval(() => { 
    wsServer.broadcastToRoom('testRoom', '1000', 'roomSay', { msg: 'This is a message sent to the test room' });
  },10_000)

```
client.js:

```js

  // client.js:
  // const { WebSocketConnector } = require('websocket-cross-server-adapter');
  const WebSocketConnector = require('../../src/WebSocketConnector');

  // 默认的配置端口和客户端id
  let port = 9000;
  let id = 1;

  // 解析命令行参数，可以在node命令行加上以下参数，动态配置prot和id，例如：node client --id=16 --port=9001

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
    // 可以通过关闭服务器端来测试以下不同参数设置时候的重连效果
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
      // 手动断开连接或服务器在特定情况下强制注销 — 不应尝试重连
      console.log('Connection closed manually or by forced logout/auth failure. No reconnection.');
      // 虽然连接已关闭，但仍需禁止自动重连，并清理所有计时器和 WebSocket 实例等资源。
      client.manualClose();
    } else {
      // 其他情况下，应手动触发重连
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
    // 在pong事件中可以测得当前网络延迟
    console.log(`Network latency: ${speed} ms`);
  })


  setTimeout(async () => {
    // 使用 Promise 方式发送带有回调的事件
    let data = await client.emitWithPromise('say', { msg: 'I am a client with ID: ' + id + ', and I need your promise callback.' }, {
      onPending: () => {
        console.log('requesting...')
      }
    });
    console.log('Received promise response:');
    console.log(data);
  }, 2000);


  setTimeout(() => {
    // 使用 callback 方式发送带有回调的事件
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
    // 模拟加入测试房间
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

#### 使用方法

1. 安装依赖

请在项目主目录下执行以下命令，安装所需依赖：

```bash
npm install
```

2. 进入示例目录

进入 examples/single-ws-server 目录：

```bash
cd examples/single-ws-server
```

3. 启动Websocket服务器

默认端口启动：

```bash
node server
```

或者自定义端口启动：

```bash
node server --port=9001

```
4. 启动客户端

默认配置：

```bash
node client

```

或者指定客户端 ID 和端口启动：

```bash
node client --id=16 --port=9001

```
 **⚠️ 注意：每个客户端的 id 必须唯一，不能重复，否则将导致连接冲突。**

你可以通过使用不同的 id 启动多个客户端，以观察各种事件情况。
还可以通过关闭服务器来测试断线场景，观察客户端的重连事件信息，然后再重启服务器，以模拟以下流程：
断线 → 重连中 → 成功重新连接

#### 补充说明1：定向发送消息

如果你想测试**单点定向发送消息**或**多点定向发送消息**的能力，  
请参考 API 文档中关于以下函数的说明并自行测试：

- [`toSocketId()`](./api.zh-CN.md#tosocketidsocketid-event-data)
- [`toSocketIds()`](./api.zh-CN.md#tosocketidssocketids-event-data)

它们支持向特定的客户端 Socket 连接发送事件消息。


  #### 💡 示例总结

  上述示例完整展示了在**非分布式架构下使用单 WebSocket 服务器**进行通信的典型场景和关键功能。包括连接事件管理、心跳机制、网络状态检测、事件注册与处理、请求与响应的回调机制、房间广播以及断线重连等。几乎涵盖了单服务器模式下大多数常见的应用场景和需求，帮助开发者快速构建稳定且功能完善的 WebSocket 服务。如果不需要分布式功能，单服务器模式已经能够满足大部分常见的 WebSocket 应用需求。
  
---
### 二. 跨服务通信模块（纯服务端通信）

在完成了第一章节中单 WebSocket 服务器的通信逻辑后，我们将进入服务端之间的通信范式 —— **跨服务器通信模块（CrossServer）**。  
该示例不依赖 WebSocket，仅聚焦于分布式环境中服务节点之间如何稳定、高效地进行消息传递与回调处理。

**该模块涵盖以下关键能力：**

- 节点间事件广播与接收  
- 定向发送与全局广播机制  
- 跨服务器的请求-响应流程（支持 Promise）  
- 基于事件名的统一调度系统  
- 错误与超时处理机制

**适用场景：**

适用于不同进程或跨物理机器的服务之间通信，例如：

- HTTP 服务器 与 图片服务器
- 主业务服务器 与 文件存储服务器
- 网关服务 与 AI 推理服务
- 多个逻辑节点之间的事件驱动通信

这为解耦系统架构、构建微服务体系提供了通用的通信机制。

> 💡 该模块是构建 `WebSocketCrossServerAdapter` 的基础部分，理解此机制将帮助你深入掌握后续跨服通信的底层逻辑。

#### 安装 Redis（Install Redis）

在使用本项目之前，你需要提前安装好 Redis 服务。
安装教程或相关资源：

- Redis 官网：[https://redis.io/docs/getting-started/installation/](https://redis.io/docs/getting-started/installation/)
- Redis GitHub：[https://github.com/redis/redis](https://github.com/redis/redis)
- Redis Windows 安装包（Windows Build）：[https://github.com/tporadowski/redis/releases](https://github.com/tporadowski/redis/releases)

安装完成 Redis 后,启动 redis 服务：

```bash
redis-server
```

或者指定配置文件启动(windows平台)

```bash
redis-server redis.windows.conf
```

你可以通过以下方式测试是否启动成功：

```bash
redis-cli ping
```
如果返回：
```bash
PONG
```
说明 Redis 服务已成功启动并正常运行。

#### 启动多个 Redis 实例

你可以通过复制并修改 Redis 配置文件来启动多个实例，每个实例监听不同的端口。

示例步骤：

1. 复制默认配置文件（假设在 Linux/macOS）：

```bash
cp /etc/redis/redis.conf /etc/redis/redis-6380.conf
cp /etc/redis/redis.conf /etc/redis/redis-6381.conf
```
2. 修改新配置文件中的端口（如 redis-6380.conf）：
```bash
port 6380
```
3. 启动多个 Redis 实例，指定对应配置文件：
```bash
redis-server /etc/redis/redis-6380.conf
redis-server /etc/redis/redis-6381.conf
```

4. 你也可以直接用命令行参数启动不同端口（适合测试）：
```bash
redis-server --port 6380
redis-server --port 6381
```
Windows
同样，通过复制并修改配置文件中的端口，运行多个 redis-server 进程：
```bash
redis-server redis-6380.conf
redis-server redis-6381.conf
```
或者直接开启多个：
```bash
redis-server --port 6380
redis-server --port 6381
```
#### 注意事项

- 每个实例必须使用不同的端口。
- 如果需要开启远程访问，请参考官方配置文件说明，修改 `bind` 配置项以允许对应主机连接。

本框架底层使用 ioredis 作为 Redis 客户端，所有 Redis 相关配置参数均直接传递给 ioredis。
具体的配置选项和使用方法，请参考 ioredis 官方文档 以获取详细说明和最佳实践。

- ioredis GitHub 仓库：[https://github.com/redis/ioredis](https://github.com/redis/ioredis)  

#### 示例开始
cserver.js:

```js
// cserver.js
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

// 填入你的 Redis 配置信息，支持多个实例，请确保 Redis 服务已启动
// 支持多个 Redis 节点，如果使用多个节点，则每次发布会根据设置的策略选择其中的一个节点进行发布，
// 从而实现“负载均衡”。不同的策略含义请参考 API 文档。
// 内部会维护各个节点的健康状态。
// 重要提示：至少需要提供一个 Redis 节点，跨服务通信才能正常工作。
const redisConfig = [
  { port: 6379, host: '127.0.0.1' },
  //{ port: 6380, host: '127.0.0.1' },
  // 可以添加更多节点
];

// 请务必确保启动多个服务器时，每个服务器的名称都唯一，避免冲突
let serverName = 'serverA';

// 解析命令行参数，可以在node命令行加上以下参数，动态配置serverName，例如：node cserver --name=serverA
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
  // 注册监听redis节点的健康状态的事件函数，当健康状态发生变化的时候将触发
  onRedisHealthChange: (health, info) => {
    console.log(`Node health status changed:${health}`, info);
  },
  // 当频道订阅发生错误的时候触发，info对象包含：
  onRedisSubscriptionError: (info) => { 
    console.log('onRedisSubscriptionError:', info);
  }
});


// 注册跨服务器事件监听
crossServer.onCrossServerEvent('say', (data, callback) => {
  
  console.log('Received "say" event from another server:', data);
 
  // 如果发送方通过 callback 或 Promise 方式发送消息，则此时 callback 为有效函数，可以直接调用以回调响应结果
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

// 注册跨服务器事件监听
// 如果发送目标 targetServer 包含了自己（即全局广播时没有排除自己，或者 targetServer 中包含了自己的 serverName），
// 那么本服务器也会响应自己发送的该事件。
// 该事件响应会直接在本地上下文中执行，不经过 Redis 频道中转。
// 因此，开发者无需为本地事件做额外处理，所有优化均由内部机制自动完成。
crossServer.onCrossServerEvent('say', (data, callback) => {
  console.log('Received "say" event from another server:');
  console.log(data);
  if (callback) {
     callback({ msg: `Hi, this is server ${crossServer.getServerName()} responding to you` })
  }
})

// 发送say事件消息，不需要任何回调
setTimeout(() => {
  crossServer.emitCrossServer('say', {
   content: `Hi everyone, I am ${crossServer.getServerName()}`
  },null, {
    targetServer: [],
  })
}, 3000);

// 以callback的方式发送say事件消息，需要目标服务器回调
setTimeout(() => {

  // 每当接收到一个服务器响应都会执行一次回调函数
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

// 以Promise的方式发送say事件消息，需要目标服务器回调
setTimeout(async () => {

  // Promise 会在所有预期响应（expectedResponses）全部完成后解决（resolved），如果超时未收到全部响应，也会解决，但此时 result.success 为 false。
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

  // 也可以使用then的方式
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

#### 使用方法

**请务必确保 Redis 服务已启动，且监听端口为 6379，本示例运行前需满足此条件。**

1. 请确保你已经在项目主目录执行过 npm install，以安装所需依赖。否则后续命令可能无法正常运行。

```bash
npm install
```

2. 进入 examples/cross-server 目录：

```bash
cd examples/cross-server
```

3. 快速启动多个服务器（推荐）

  [concurrently](https://www.npmjs.com/package/concurrently)是一个工具，可以一条命令同时启动多个服务器实例：

```js
npx concurrently "node cserver --name=serverA" "node cserver --name=serverB" "node cserver --name=serverC" "node cserver --name=serverD" "node cserver --name=serverE"
```

📌 **注意：虽然它们共用一个终端窗口输出日志，但每个服务器仍然是独立的 Node.js 进程，彼此之间完全隔离，只是 concurrently 将它们的控制台输出集中显示，便于观察。**

4. 手动启动服务器（更直观）

如果你希望每个服务器运行在自己的独立终端窗口中，便于查看日志或调试，可以分别手动启动：
启动一个默认服务器：

```bash
node cserver

```
或者启动一个带自定义名称的服务器：

```bash
node cserver --name=serverB

```
⚠️ **每个服务器名称必须唯一，这是保证分布式系统正常运行的前提，否则可能导致节点识别冲突或消息路由错误**。

5. 启动消息发送服务器

用于测试跨服务器通信的发送端：

```bash
node sender 

```
或使用自定义名称：

```bash
node sender --name=senderB

```

成功启动后，你可以看到多个服务器之间的事件通信、回调响应等输出结果，验证系统的分布式通信能力。

你可以使用不同的参数配置来进行测试，例如：

- 排除自己不接收消息
- 指定目标服务器发送消息
- 设置超时时间
- 设置预期响应服务器个数

- `targetServer: []`  
  空数组表示广播模式，所有服务器都将接收到消息。此时可配合 `exceptSelf: true` 来排除当前服务器自身不接收消息。

- `targetServer: ['serverA', 'serverB']`  
  指定目标服务器名称（支持多个），可实现定向发送消息，仅目标服务器会接收到事件。

更多细节请参考 API 文档中
[`emitCrossServer`](./api.zh-CN.md#emitcrossserverevent-message-callback-options) 与
[`emitCrossServerWithPromise`](./api.zh-CN.md#emitcrossserverwithpromiseevent-message-options)。


#### 跨服务通信示例总结 

通过使用 **WebSocketCrossServerAdapter** 的跨服务器通信功能，你可以轻松实现多进程或分布式环境下各个服务器节点之间的高效通信。
无论是定向消息发送、广播消息、回调机制，还是多节点响应统计等多种场景需求，都能被很好地支持，助力构建稳定且灵活的分布式系统。

---

### 三. WebSocket + CrossServer 分布式通信示例（跨服务场景）

在前两个章节中，我们已经实现了以下功能：

1. **单 WebSocket 服务器模式（非分布式）**  
   展示了如何使用 WebSocket 在单一服务实例中进行客户端通信，包括事件监听、消息发送和回调响应等基本操作。

2. **跨服务器通信模块（纯服务端通信）**  
   展示了不同服务节点之间如何通过 Redis 实现事件广播、定向发送和异步回调处理。

接下来我们将进入更高级的场景：**将 WebSocket 与 CrossServer 模块结合**，实现真正意义上的**WebSocket 分布式通信**。

#### 示例开始

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

// 随机决定要发送加入房间消息的客户端数量
const joinRoomCount = 10; 
const joinRoomClientIds = new Set();

// 随机挑选10个客户端id
while (joinRoomClientIds.size < joinRoomCount) {
  joinRoomClientIds.add(Math.floor(Math.random() * totalClients) + 1);
}

// 预定义一些房间ID
const roomIds = ['1000', '1001', '1002'];

// 模拟多个客户端加入不同的ws服务器
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
    // 如果这个客户端在随机加入列表里，发送加入房间消息
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
    console.log(`[Client ${id},port:${port}] onClose event:`, event.code, event.reason);
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
#### 使用方法

**请务必确保 Redis 服务已启动，且监听端口为 6379，本示例运行前需满足此条件。**

1. 启动五个 WebSocket 服务器

进入 examples/ws-cross-server 目录，使用以下命令通过 concurrently 同时启动五个不同名称和端口的 WebSocket 服务实例：

```bash
npx concurrently "node wsserver --name=serverA --port=9000" "node wsserver --name=serverB --port=9001" "node wsserver --name=serverC --port=9002" "node wsserver --name=serverD --port=9003" "node wsserver --name=serverE --port=9004"
```
 **注意**：concurrently 会将多个服务器日志集中显示在一个终端窗口中。如果你更喜欢每个服务器拥有独立窗口，可以手动分别执行下面的命令启动：

```bash
node wsserver --name=serverA --port=9000
node wsserver --name=serverB --port=9001
node wsserver --name=serverC --port=9002
node wsserver --name=serverD --port=9003
node wsserver --name=serverE --port=9004
```
请确保每个服务器的名称**唯一**，避免节点名称冲突。

2. 启动模拟客户端

执行以下命令启动 50 个模拟客户端，这些客户端会随机连接到上述任意一个服务器，并随机把一部分客户端加入到测试房间。

```bash
node clients
```

3. 启动模拟控制端发送指令

使用下面命令启动控制端客户端，用于模拟发送广播、点对点、群发、房间消息等多种指令：

```bash
node boss
```

#### 预期效果

运行上述示例后，你将观察到以下分布式通信特性生效：

- 即使客户端连接在不同的 WebSocket 服务器节点上，也能：
  - ✅ **接收到全局广播消息**（如 `broadcast`）
  - ✅ **正确收到点对点消息**（如 `toPlayer` 指定玩家）
  - ✅ **支持群发消息到多个指定客户端**（如 `toPlayers`）
  - ✅ **成功接收房间内的定向消息**（如 `toRoom`）

这些特性表明：

> - 各 WebSocket 服务器节点之间通过 Redis 实现了事件同步与消息路由。  
> - 分布式环境下，消息发送逻辑与单服务器模式几乎保持一致，开发者无需额外关注服务器部署细节。  
> - 整个系统具备了真正意义上的 **WebSocket 分布式通信能力**。


### WebSocket 分布式示例总结

通过结合 WebSocket 与 CrossServer 模块，可以轻松实现真正的 WebSocket 分布式通信。无论客户端连接到哪个节点，消息的下发流程和单服务器模式保持一致，无需对业务代码进行任何修改。这样，一台多核机器上可运行多个进程、多个 WebSocket 服务，从而突破 Node.js 单进程的内存和性能限制，充分发挥硬件性能。同时，该架构也支持轻松部署到多台物理服务器，只需配置公共的 Redis 节点进行跨节点通信，整体设计简单易用，极大提升系统的可扩展性和稳定性。分布式，从未如此轻松....

---

## 示例总结

通过以上三个章节的示例，你可以循序渐进地从 **单机 WebSocket 通信**，到 **服务器之间的跨节点通信**，再到 **WebSocket 客户端与跨服务器系统协同通信**，完整了解整个分布式通信的工作流程与核心机制。每一阶段都紧扣实际场景，帮助你逐步建立起对 WebSocket 分布式架构的整体认知。

---

## 常见问题

- [常见问题](FAQ.zh-CN.md#常见问题)
  - [1. 如何实现客户端到服务器端再到逻辑服务器的消息转发与回调？](FAQ.zh-CN.md#1如何实现客户端到服务器端再到逻辑服务器的消息转发与回调)
  - [2. 服务器向客户端发送消息时支持回调吗？](FAQ.zh-CN.md#2-服务器向客户端发送消息时支持回调吗)
  - [3. WebSocket 连接断开后是否会自动退出房间？](FAQ.zh-CN.md#3-websocket-连接断开后是否会自动退出房间)
  - [4. 如何动态加入Redis节点？](FAQ.zh-CN.md#4-如何动态加入redis节点)
  - [5. 如何新增服务器节点？](FAQ.zh-CN.md#5-如何新增服务器节点)
  - [6. 每个服务器节点的 Redis 配置必须一致吗？](FAQ.zh-CN.md#6-每个服务器节点的-redis-配置必须一致吗)
  - [7. 如何配置 Redis 发布节点选择策略？](FAQ.zh-CN.md#7-如何配置-redis-发布节点选择策略)
  - [8. Redis 节点配置多少个合适？](FAQ.zh-CN.md#8-redis-节点配置多少个合适)
  - [9. WebSocketCrossServerAdapter 何时应该启用 Redis 数据压缩功能？](FAQ.zh-CN.md#9-websocketcrossserveradapter-何时应该启用-redis-数据压缩功能)
  - [10. WebSocket 服务器端到客户端的数据传输支持压缩吗？](FAQ.zh-CN.md#10-websocket-服务器端到客户端的数据传输支持压缩吗)
  - [11. 房间的命名空间该如何设计？](FAQ.zh-CN.md#11-房间的命名空间该如何设计)
  - [12. 在分布式 WebSocket 服务中，如何获取房间或者玩家相关的信息？](FAQ.zh-CN.md#12-在分布式-websocket-服务中如何获取房间或者玩家相关的信息)
  - [13. 在分布式 WebSocket 服务中，如何把用户分配到不同的 WebSocket 服务器？](FAQ.zh-CN.md#13-在分布式-websocket-服务中如何把用户分配到不同的-websocket-服务器)
  - [14. WebSocketConnector 客户端断线后不会自动重连吗？](FAQ.zh-CN.md#14-websocketconnector-客户端断线后不会自动重连吗)
  - [15. 前端环境如何使用 WebSocketConnector 类？](FAQ.zh-CN.md#15-前端环境如何使用-websocketconnector-类)
  - [16. WebSocketConnector 客户端只能使用 URL 方式传递参数吗？](FAQ.zh-CN.md#16-websocketconnector-客户端只能使用-url-方式传递参数吗)
  - [17. 如何安全且兼容地传递认证及其他敏感信息？](FAQ.zh-CN.md#17-如何安全且兼容地传递认证及其他敏感信息)
  - [18. 为什么 WebSocket 还需要心跳机制？是不是有 close 事件就够了？](FAQ.zh-CN.md#18-为什么-websocket-还需要心跳机制是不是有-close-事件就够了)
  - [19. Node.js 服务该如何部署？有没有推荐的方式？](FAQ.zh-CN.md#19-nodejs-服务该如何部署有没有推荐的方式)
  - [20. WebSocket 服务是否支持与已有 HTTP 服务器共用端口？](FAQ.zh-CN.md#20-websocket-服务是否支持与已有-http-服务器共用端口)
  - [21. 如何进行跨物理服务器的测试？](FAQ.zh-CN.md#21-如何进行跨物理服务器的测试)
---

## 联系方式

如果你在使用过程中有任何问题或建议，欢迎随时与我联系交流。
你也可以通过 GitHub 仓库的 Issues 反馈问题或提出建议。

为了防止邮件被误归类到垃圾邮件，请在邮件主题或正文前面加上 [WebSocketCrossServerAdapter]。
邮箱：349233775@qq.com

---

## 许可证
本项目基于 MIT 协议开源，具体内容请查看 [LICENSE](./LICENSE) 文件。
