# 🚀 一款基于 Node.js、支持多服务器协同通信的 WebSocket 分布式框架

## 目录

- [背景](#背景)
- [为什么要做这个框架？](#为什么要做这个框架)
- [项目目标](#项目目标)
- [实现原理（核心架构）](#实现原理核心架构)
- [WebSocketCrossServerAdapter（服务端通信核心）](#websocketcrossserveradapter服务端通信核心)
- [WebSocketConnector（客户端连接管理器）](#websocketconnector客户端连接管理器)
- [不只是 WebSocket —— 更是微服务通信的统一桥梁](#不只是-websocket--更是微服务通信的统一桥梁)
- [场景适用](#场景适用)
- [开始使用](#开始使用)
- [接口文档](#接口文档)
  - [中文API文档](./api.zh-CN.md)
  - [English API Documentation](./api.en-US.md)
- [使用示例](#使用示例)
  - [一. 单 WebSocket 服务器模式（非分布式）](#一-单-websocket-服务器模式非分布式)
  - [二. 跨服务通信模块（纯服务端通信）](#二-跨服务通信模块纯服务端通信)
  - [三. WebSocket + CrossServer 分布式通信示例（跨服务场景）](#三-websocket--crossserver-分布式通信示例跨服务场景)
- [常见问题](#常见问题)
  - [1. 如何实现客户端到服务器端再到逻辑服务器的消息转发与回调？](#1如何实现客户端到服务器端再到逻辑服务器的消息转发与回调)
  - [2. 服务器向客户端发送消息时支持回调吗？](#2-服务器向客户端发送消息时支持回调吗)
  - [3. WebSocket 连接断开后是否会自动退出房间？](#3-websocket-连接断开后是否会自动退出房间)
  - [4. 如何动态加入Redis节点？](#4-如何动态加入redis节点)
  - [5. 如何新增服务器节点？](#5-如何新增服务器节点)
  - [6. 每个服务器节点的 Redis 配置必须一致吗？](#6-每个服务器节点的-redis-配置必须一致吗)
  - [7. 如何配置 Redis 发布节点选择策略？](#7-如何配置-redis-发布节点选择策略)
  - [8. Redis 节点配置多少个合适？](#8-redis-节点配置多少个合适)
  - [9. WebSocketCrossServerAdapter 何时应该启用 Redis 数据压缩功能？](#9-websocketcrossserveradapter-何时应该启用-redis-数据压缩功能)
  - [10. WebSocket 服务器端到客户端的数据传输支持压缩吗？](#10-websocket-服务器端到客户端的数据传输支持压缩吗)
  - [11. 房间的命名空间该如何设计？](#11-房间的命名空间该如何设计)
  - [12. 在分布式 WebSocket 服务中，如何获取房间或者玩家相关的信息？](#12-在分布式-websocket-服务中如何获取房间或者玩家相关的信息)
  - [13. 在分布式 WebSocket 服务中，如何把用户分配到不同的 WebSocket 服务器？](#13-在分布式-websocket-服务中如何把用户分配到不同的-websocket-服务器)
  - [14. WebSocketConnector 客户端断线后不会自动重连吗？](#14-websocketconnector-客户端断线后不会自动重连吗)
  - [15. 前端环境如何使用 WebSocketConnector 类？](#15-前端环境如何使用-websocketconnector-类)
  - [16. WebSocketConnector 客户端只能使用 URL 方式传递参数吗？](#16-websocketconnector-客户端只能使用-url-方式传递参数吗)
  - [17. 如何安全且兼容地传递认证及其他敏感信息？](#17-如何安全且兼容地传递认证及其他敏感信息)
- [联系](#联系方式)
- [许可证](#许可证)

## 背景

在开发一款休闲类实时游戏的过程中，我选择了基于原生 WebSocket 协议进行通信。客户端与服务器分别使用了平台原生接口与 Node.js 的 [ws](https://github.com/websockets/ws) 模块。这种方式带来了通信层面的灵活性，但也意味着许多基础能力需要自行实现，例如：心跳机制、断线重连、消息回调、房间管理等。

随着项目复杂度提升，Node.js 的部分局限性逐渐显现。单线程模型虽然擅长处理高并发 I/O，但在计算密集型任务下无法充分利用多核 CPU，且在高负载场景中容易受到垃圾回收（GC）暂停事件循环的影响，从而降低响应速度与整体吞吐量。

---

## 为什么要做这个框架？

很多人在用 Node.js 的 WebSocket，却很少有人认真考虑：

- “如果连接量变多了怎么办？”  
- “如果服务需要横向扩展怎么办？”  
- “如果房间、事件、用户状态要在多个节点之间同步怎么办？”

项目初期，系统的架构和并发压力都相对可控。一个单进程的 Node.js WebSocket 服务即可轻松支撑几万级别的连接，运行稳定、响应快速，能够满足早期阶段“功能是否可用”“用户能否连上”“体验是否流畅”等关键需求。

然而，随着业务发展、用户增长，新的挑战逐步浮现：

- 多实例部署后，用户连接被分散在不同节点，状态同步变得复杂；  
- 房间逻辑依赖本地内存，难以迁移与共享，动态扩缩容受限；  
- 广播仅能作用于本地节点，跨节点事件协调缺乏统一机制；  
- 想要对接分布式中间件（如 Redis）进行通信桥接，但缺乏灵活、统一的接口；  
- 自行封装时缺乏结构与规范，维护成本和耦合度随之上升。

值得注意的是，尽管 Node.js 支持多进程和集群部署，社区中却几乎找不到一个可直接应用、基于原生 `ws` 的分布式通信框架。现有方案多为：

- 深度绑定在某些框架的 adapter 体系中，灵活性和可控性受限；  
- 或是零散的示例、概念性代码或实验项目，缺乏结构化设计，难以在生产环境落地。

这些问题并非架构设计错误，而是系统从单体走向分布式过程中必然遇到的阶段性挑战。这正是我着手构建跨服务器通信框架的出发点。

---

## 项目目标

这个框架的核心目标是：  
- 解决原生 WebSocket 功能过于基础的问题：内建心跳、断线重连、事件回调、房间广播等功能，开箱即用。  
- 突破 Node.js 在多进程与分布式部署上的瓶颈：基于 Redis 构建的分布式事件系统，支持多节点间消息同步与广播。   
- 支持跨服务通信场景：不仅限于客户端通信，也适用于微服务间事件传递、系统间消息联动。  
- 让分布式不再是“高级选项”：无论你是单机开发还是准备大规模部署，只需一个开关，即可切换为分布式运行，无需重构业务逻辑。

---

## 实现原理（核心架构）

该框架利用 Redis 的事件发布与订阅机制 作为通信中间件，实现跨服务器节点的消息广播与事件同步：  
- 所有服务器节点全量订阅所有 Redis 节点，实现节点间去中心化通信，各 Redis 节点相互独立，无主从依赖；  
- 内建健康状态监测与自动自愈机制，支持故障节点隔离，确保服务高可用；  
- 消息发布可基于多种策略（如随机、轮询、延迟优先）选择当前健康节点；  
- 单个 Redis 节点故障不会影响整个系统运行，具备分布式容错能力；  
- 支持单服务器多进程部署，也支持跨物理服务器部署，实现弹性横向扩展。

---

## 项目包含两个模块 WebSocketCrossServerAdapter 和 WebSocketConnector

本框架基于标准的 WebSocket 协议编写，具备以下特点：
- 仅两个核心类文件，代码量精简，结构清晰，便于快速理解。
- 无额外繁重依赖，确保轻量高效。
- 代码组织合理，避免文件跳转，思路连贯流畅。
- 注释详细完整，帮助开发者快速把握逻辑。
- 专注于实现 WebSocket 分布式通信的核心功能，避免复杂冗余。
- 结构简单，便于扩展和自定义。
- 严格遵循 WebSocket 标准，保证良好的兼容性和跨平台支持。

---

## WebSocketCrossServerAdapter（服务端通信核心）

一个为分布式架构而设计的通信适配器，支持服务端事件广播、跨服务器消息传递、房间管理等功能。具备高扩展性和模块化设计，适用于游戏服务、实时系统、微服务间通信等多种场景。  

主要能力包括：  
- 跨节点事件通信，支持回调/Promise  
- Redis 分布式支持：支持动态添加节点、全通道订阅、压缩传输等  
- 分布式房间广播、客户端追踪、全局用户统计  
- 事件优先本地响应，自动路由目标节点  
- 热插拔扩容，无需重启  

支持以下多粒度消息发送能力（不依赖连接在哪个节点）：  
- 全局广播（所有节点、所有客户端）  
- 单客户端发送（跨节点精确定位）  
- socketId 批量发送  
- 分布式房间广播  

支持房间命名空间（roomNamespace）分类管理，满足多业务场景隔离需求。  
提供跨节点统计功能：在线用户数、房间成员数等。  

所有 WebSocket 事件处理器都可以在任意服务器节点上注册。对于需要跨节点处理并回调客户端的事件，开发者可以根据业务需求手动将事件转发到目标节点，由目标节点处理后直接回调客户端，无需中间中转或重复包装。

---

## WebSocketConnector（客户端连接管理器）

一个轻量级、简洁的 WebSocket 客户端类，适用于任何基于标准 WebSocket 协议的平台，例如浏览器、Node.js、Electron、React Native、移动 App、小程序、Cocos Creator 等环境。内置心跳机制、断线重连、事件回调、延迟反馈等功能，逻辑清晰、易于集成，压缩后体积仅约 5KB，适合各类实时通信场景的前端接入。

支持功能：  

- 断线重连  
- 心跳保活机制  
- 网络延迟检测（基于 ping-pong 实现）
- emit 支持回调与超时处理  
- 延迟响应回调（可用于展示 loading 等）  
- 支持参数注入（URL）  

---

## 不只是 WebSocket —— 更是微服务通信的统一桥梁

本框架不仅适用于前后端 WebSocket 通信，还可以作为服务端内部的通信总线，支持不同类型的功能服务（如 HTTP 服务、文件服务、图像处理服务、AI 服务等）之间的事件分发与响应：  
- 🌐 支持全局广播、单点/多点定向通信  
- 🔁 支持事件级回调机制，实现请求-响应式通信模式  
- 📊 支持事件结果收集与响应统计，便于多服务并发任务协调  
- 🔒 可用于构建具备“事件驱动 + 服务隔离 + 状态反馈”的高内聚通信架构  

这种架构下，你不仅能连客户端，还能连任何一个 Node.js 服务模块，让所有服务都具备“事件收发能力”。

---

## 场景适用

- 实时多人游戏服务器  
- 多房间/多人聊天室系统  
- 教育互动、直播平台
- 微服务通信桥梁（以事件驱动方式进行跨服务通信）  
- 所有想要使用 WebSocket 建立稳定、分布式通信的项目

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
    console.log('onCode event:', event.code, event.reason);
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

#### 补充说明2：WebSocket 启动方式（noServer / 指定已有 Server）

除了默认监听端口启动外，WebSocket 服务器还支持以下两种方式启动：

#### ✅ 1. 使用已有 HTTP(S) Server 启动 WebSocket（共享端口）

当使用已有的 HTTP 或 HTTPS 服务器启动 WebSocket 服务时，WebSocket 将会与 HTTP(S) 共用同一个端口。  
这是通过 HTTP 协议的“协议升级”（Protocol Upgrade）机制实现的。

- WebSocket 客户端最初会发送一个普通的 HTTP 请求，请求头中包含 `Upgrade: websocket` 字段；
- HTTP(S) 服务器接收到该请求后，会将连接“升级”为 WebSocket 协议；
- 此时由 `ws.Server` 实例接管连接处理逻辑；
- 最终，HTTP 请求和 WebSocket 连接共享同一个 TCP 端口（例如 8080 或 443）。

这种方式特别适用于你希望 **Web 应用（如网页、API）和 WebSocket 服务共用同一个端口** 的场景，可以避免占用多个端口，方便部署与管理。

详情请查看官方文档：[ws GitHub - External HTTPS Server](https://github.com/websockets/ws?tab=readme-ov-file#external-https-server)

你可以传入已有的 HTTP Server 实例启动 WebSocket 服务：

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

// ............................其他逻辑相同

```

#### ✅ 2. 使用 noServer 模式（手动处理 upgrade 请求）
你可以通过 noServer 模式手动处理 HTTP 升级请求。这种方式适用于你希望完全控制 HTTP 服务和升级流程的场景，例如在一个服务器上同时处理 HTTP 请求和 WebSocket 连接。
适用于：
与现有 HTTP(S) 服务共用端口
需要自定义认证、权限验证等逻辑
更精细地控制连接行为

📚 详情请查看官方文档：  
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
    // 1. 检查 Upgrade 头必须是 websocket
    if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const data = wsServer.parseWsRequestParams(req);
    console.log('传递参数是：')
    console.log(data)

    const id = data.params.id;
    console.log("连接的客户端id:" + id);

    if (id) {
      // 获取 wsServer 中的 WebSocket.Server 实例，并处理 WebSocket 协议升级请求
      wsServer.getWss()?.handleUpgrade(req, socket, head, (ws) => {
        // 模拟完成鉴权，绑定 playerId 到该 WebSocket 实例上
        ws.playerId = String(id);
        // 手动触发 'connection' 事件，使该连接走统一的连接处理逻辑
        wsServer.getWss()?.emit('connection', ws, req);
      })
    } else {
      // 模拟鉴权失败，返回 401 错误并关闭连接
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); // 发送拒绝连接的 HTTP 响应
      socket.destroy(); // 销毁连接
    }
  });


  wsServer.onWebSocketEvent('connection', (socket, req) => {
    console.log('Client connection');
    console.log('客户端id：' + socket.playerId);
    //....................其他逻辑相同
  })

  // ............................其他逻辑相同
```

  #### ✅ WebSocket 鉴权推荐方式

  在真实业务场景中，建议在客户端发起连接请求时即完成用户身份认证，服务器在接收到连接请求时验证身份信息。
  不要等连接建立成功后再进行鉴权然后断开，这样会导致服务器资源被不必要地占用，增加安全风险。如果必须在连接成功后进行鉴权，请务必实现认证超时关闭机制，或者定期检查并清理无效连接，防止服务器资源被恶意或无效连接耗尽。

  推荐使用如 [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) 等模块，对请求中携带的 token 进行验证。 
  
  > **同时，建议在正式发起 WebSocket 连接之前，先通过 HTTP 接口进行身份验证。**  
  > 这是因为在 WebSocket 协议升级过程中，服务器返回的鉴权失败信息在不同平台和客户端的表现不一致，  
  > 很多情况下客户端无法准确接收到具体的错误状态和原因，导致重连或错误处理复杂且不可靠。  
  > 通过预先的 HTTP 鉴权，可以避免这些问题，提高客户端的用户体验和连接稳定性。


  #### 💡 示例总结

  上述示例完整展示了在 **非分布式架构下，使用单 WebSocket 服务器** 进行通信的典型场景与关键能力，包括但不限于：

  #### ✅ 客户端：
  - 支持 **带回调的消息发送**（模拟请求-响应结构）
  - 内置 **重连机制**，可手动关闭连接防止重连
  - 实现 **心跳机制**，确保连接活性与断线感知
  - 提供统一事件处理接口，易于扩展和管理
  - 处理 **断线与错误事件**，保证稳定性与恢复能力
  - 支持 **服务器事件的注册与处理**
  - 支持 **本地事件的注册与处理**

  #### ✅ 服务端：
  - 建立 **客户端连接与业务 ID 的映射关系**
  - 监听并处理 **客户端事件**，实现服务端逻辑响应
  - 根据不同的连接模式（如固定端口、HTTP 共用端口和自动升级协议处理）实现鉴权流程
  - 支持 **广播消息与房间定向消息** 的模拟逻辑
  - 响应客户端发起的 **回调型事件请求**
  - 模拟业务层逻辑的 **消息处理与响应**

  通过上述功能，基本覆盖了 WebSocket 在单服务器环境下的主要使用场景。  
  **深入理解单 WebSocket 服务器的通信流程，将为构建后续的分布式通信机制打下坚实基础。**

  如果你当前项目不需要跨服务或分布式功能，完全可以在这里按下暂停键，直接 return，优雅地跳过跨服务器的部分。  
  即使没有需求，了解一下也无妨，我们将进入下一个跨服务器的示例章节。

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

#### 准备工作：中间件选择

要实现跨服务器之间的通信，必须依赖一个中间件来承担消息的 **统筹与分发职责**。  
以下是一些常见的可用于该目的的中间件或消息系统：

- **Redis Pub/Sub**：轻量、高效，适合小型或中型分布式系统；Node.js 社区广泛使用，易于上手。
- **NATS**：高性能消息系统，支持请求-响应模式和异步发布订阅，适合微服务架构。
- **RabbitMQ**：功能丰富的消息队列系统，支持复杂的路由、消息持久化和确认机制。
- **Kafka**：高吞吐量、持久化支持强，适合海量数据流处理场景，广泛用于大规模分布式系统。
- **自建 WebSocket 服务器**：在简单场景中，甚至可以使用一个独立的 WebSocket 服务作为中转服务器，承担通信中枢的职责。

#### 为什么选择 Redis Pub/Sub？

- **与 Node.js 高度契合**：Redis 在 Node.js 中有成熟的客户端（如 `ioredis`、`redis` 模块），社区支持强，文档完善，上手快。
- **轻量高效**：Redis 是基于内存的存储系统，Pub/Sub 模式本身不涉及持久化，通信延迟极低，适合实时性要求高的场景。
- **部署简单**：不依赖复杂配置，可在开发阶段使用本地 Redis，线上部署也很灵活。
- **去中心化消息广播**：Pub/Sub 模式无需提前声明主题，可动态发布与订阅，实现跨进程、跨服务器的数据同步。
- **扩展性良好**：即使未来系统扩展为多节点部署，也可以通过 Redis 的集群与持久化机制进行支持。

- **官方资源链接**：
  - Redis 官网：[https://redis.io](https://redis.io)  
  - Redis GitHub 仓库：[https://github.com/redis/redis](https://github.com/redis/redis)  
  - ioredis GitHub 仓库：[https://github.com/redis/ioredis](https://github.com/redis/ioredis)  
  - node-redis GitHub 仓库：[https://github.com/redis/node-redis](https://github.com/redis/node-redis)

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

完成准备工作后，我们开始跨服务通信示例。

我们 WebSocketCrossServerAdapter 内部使用的是 ioredis，作为 Node.js 与 Redis 交互的模块，仅使用 Redis 的发布（Publish）与订阅（Subscribe）功能，不涉及任何键值数据的存储操作，确保轻量、快速、无状态。

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
  // info对象包含信息：
  // {
  // host， Redis 节点主机地址
  // port， Redis 节点端口号
  // serverName，当前服务器的名称 
  // event， 触发的事件名，如 connect、error 等
  // isHealthy， 当前 Redis 节点是否健康 
  // error， 如果发生错误，则为错误信息 
  // healthySubscriberCount， 当前健康的订阅者数量 
  // healthyPublisherCount， 当前健康的发布者数量 
  // totalNodeCount， Redis 实例总数（发布 + 订阅）
  // typeRedis， 实例类型：发布者或订阅者 
  //};
  onRedisHealthChange: (health, info) => {
    console.log(`Node health status changed:${health}`, info);
  },
  // 当频道订阅发生错误的时候触发，info对象包含：
  // {
  // host - Redis 实例的主机地址
  // port - Redis 实例的端口号
  // serverName - 当前服务器名称
  // channel - 订阅失败的频道名称
  // event - 触发事件名，如 "subscribe" 或 "unsubscribe" 
  // error - 错误信息，订阅失败的具体错误消息
  // }
  onRedisSubscriptionError: (info) => { 
    console.log('onRedisSubscriptionError:', info);
  }
});


// 注册跨服务器事件监听
crossServer.onCrossServerEvent('say', (data, callback) => {
  // 真实的发送数据可以通过data.message属性获取
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

接下来我们将进入更高级的场景：**将 WebSocket 与 CrossServer 模块结合**，实现真正意义上的**WebSocket 分布式通信**，并具备以下能力：

- 不同服务节点分别维护自己的客户端连接
- 客户端发起的事件可以通过 CrossServer 广播到其他服务器节点
- 支持消息定向、响应回调、数据聚合等高级能力
- 跨物理机、跨进程、跨实例，均可无缝通信
- WebSocket 在分布式环境下的消息发送逻辑与单服务器环境保持一致，几乎无需做任何代码更改，极大简化迁移和开发成本

这种模式将 WebSocket 的实时通信能力，与 CrossServer 的分布式事件协调机制结合在一起，从而实现了在多进程、多实例甚至跨物理机环境下的高效、稳定、可扩展的实时通信方案。

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

---

## 示例总结

通过以上三个章节的示例，你可以循序渐进地从 **单机 WebSocket 通信**，到 **服务器之间的跨节点通信**，再到 **WebSocket 客户端与跨服务器系统协同通信**，完整了解整个分布式通信的工作流程与核心机制。每一阶段都紧扣实际场景，帮助你逐步建立起对 WebSocket 分布式架构的整体认知。

---

## 常见问题

### 1.如何实现客户端到服务器端再到逻辑服务器的消息转发与回调？

在典型游戏场景中，客户端向所在的WebSocket服务器节点发送请求，例如匹配请求。这些请求通常需要由游戏逻辑服务器（如 GameServer）处理，并将结果返回客户端。

以下介绍两种常见的实现方式：

#### 方案一：由 WebSocket 服务器负责回调客户端

**游戏服务器处理完逻辑后，将结果返回给 WebSocket 服务器，再由 WebSocket 服务器回调客户端。**

1. 客户端发起请求，如：

```js
client.emit('matchRequest', { mode: 'ranked' }, (err, data) => {
  if (data) {
      // 处理客户端获得匹配结果的逻辑流程
  }
})
```

2. 玩家所在的 WebSocket 服务器接收请求，把事件转发到gameServer游戏服务器
```js
wsServer.onWebSocketEvent('matchRequest', (socket, data, callback) => {
  wsServer.emitCrossServer('matchRequest', {
    data
  }, (res) => { 
    if (callback) callback(res);
  }, {
    targetServer: ['gameServer'],
  })
});

```
3. 游戏服务器注册matchRequest事件，执行逻辑处理后，返回结果给WebSocket服务器

```js
gameServer.onCrossServerEvent('matchRequest', (data, callback, clientCallback) => {
  // 游戏服务器执行匹配逻辑之后，把匹配信息返回给Websocket服务器
  let matchResult = {};
  if (callback) { 
    callback(matchResult);
  }
})

```

#### 方案二：由 GameServer 直接回调客户端

**若不希望游戏服务器回调 WebSocket 服务器，而是直接回调客户端，也可通过透传 socketId 与 callbackId 实现自动客户端回调。**

改动如下：

2. WebSocket 服务器转发时附带客户端回调信息
```js
wsServer.onWebSocketEvent('matchRequest', (socket, data, callback) => {

  wsServer.emitCrossServer('matchRequest', {
    autoClientCallback: true,// 启用自动客户端回调
    clientSocketId: socket.socketId,// 指定客户端 socketId
    clientCallbackId:data.callbackId,// 指定客户端回调 ID
    data
  }, null, {
    targetServer: ['gameServer'],
  })
});

```
3. GameServer 直接使用 clientCallback 返回结果给客户端
```js
gameServer.onCrossServerEvent('matchRequest', (data, callback, clientCallback) => {
  let matchResult = {};
  // 注意，此时是使用clientCallback直接回调给客户端。
  // 当autoClientCallback为真，并且带有clientSocketId和clientCallbackId的时候，clientCallback为有效函数，可以直接返回结果给客户端
  if (clientCallback) { 
    clientCallback(matchResult);
  }
})
```
#### 📝 说明：

实际上，clientCallback 本质仍是通过原WebSocket服务器路由回客户端。
但在逻辑设计上，你可以不再关心回到原WebSocket服务器，从而减少中转代码和耦合。

### 2. 服务器向客户端发送消息时支持回调吗？

不支持，原因包括：

- 客户端环境和网络较不稳定，服务器端依赖客户端回调响应来处理业务逻辑存在较大风险，不可靠。  
- 服务器与客户端是一对多关系，若为每次请求都注册回调函数，会带来较大开销，影响性能和扩展性。  
- 因此，目前暂未设计该功能，若有需要，建议开发者自行实现。

实现原理与客户端回调机制类似：  
服务器生成唯一的回调事件 ID，客户端接收到需要回调的事件后处理，并将结果连同回调 ID 一并返回服务器，服务器根据回调 ID 调用对应的回调函数。  
需要注意一对多的情况处理。

### 3. WebSocket 连接断开后是否会自动退出房间？

WebSocket 连接断开后，**需要手动调用 `wsServer.removeUserSocket(socket.playerId)` 来清除该玩家的相关绑定信息**。

这是因为框架为了保持灵活性，**不会强制开发者采用固定方式绑定玩家 ID 与 socket 实例**，通常需要在连接鉴权成功后，由开发者手动绑定。因此，当客户端断开连接时，也需要开发者手动进行清理。

调用 `removeUserSocket(playerId)` 后，框架将会：

- 移除玩家与 socket 的绑定关系  
- 自动将该玩家移出其加入的所有房间  
- 删除与该玩家相关的所有内部映射数据  

这样可以确保客户端断线后，房间状态与服务器内部数据保持一致。

### 4. 如何动态加入Redis节点？

在运行过程中，如需动态添加 Redis 节点，可通过注册跨服务器事件实现。例如：

```js
wsServer.onCrossServerEvent('addRedis', (data, callback) => {
  let redisConfig = data.redisConfig;
  if (redisConfig) { 
    wsServer.addRedisInstance(config)
    if (callback) { 
      callback({ success: true });
    }
  }
})

之后，可通过任意一个服务器节点广播该事件以动态添加 Redis 节点：

adminServer.emitCrossServer('addRedis', { redisConfig }, () => { 
   // 可在此统计添加成功的节点数
}, {
    targetServer: [],
  })

```
你还可以在构造函数中设置 onRedisHealthChange 回调，实时监听各 Redis 节点的健康状态，查看当前所有节点的连接情况。

#### ⚠️ 注意事项：

由于框架采用去中心化设计，每个服务器节点都会订阅所有 Redis 节点的频道，并在发布消息时从健康节点中按策略选择一个进行发送。
因此在动态添加节点时，请注意以下潜在风险：
- 频道订阅较多或 Redis 连接初始化较慢时，新增节点可能尚未完成订阅。
- 此时若其他服务器节点已将其视为可用并选择它作为发布目标，则可能导致消息发布失败或丢失。

#### ➡️ 建议：

在生产环境中应慎重使用动态添加 Redis 的能力。
推荐在初始化时配置好所有 Redis 节点，或者在维护窗口中进行配置更新，以确保系统稳定性。

### 5. 如何新增服务器节点？

若你希望在运行时添加新的 WebSocket 服务器节点，仅需保证该节点的 Redis 配置与现有节点保持一致，即可无缝接入。
新增节点后可通过如 Nginx 的负载均衡方式将部分客户端请求引导至该节点，例如根据 IP、地域或权重做流量分配。
由于本架构中每个服务器节点都具备独立的分布式能力，新节点加入后可立即参与消息处理，无需额外同步或中心协调。

### 6. 每个服务器节点的 Redis 配置必须一致吗？

是的，必须保持一致。
本框架采用节点等价设计，即每个服务器节点都会订阅所有 Redis 节点的频道。这样可确保任意 Redis 节点发布的消息都能被所有服务器接收到。
当某个 Redis 节点宕机时，系统会将其标记为不健康（healthy = false），在选择发布目标时自动规避，保证整体功能不受影响。

#### ⚠️ 注意：  

如果某个服务器节点缺少对某个 Redis 节点的配置，将无法接收通过该 Redis 节点发布的消息。因此，**必须确保所有服务器节点拥有全量且一致的 Redis 配置信息**。

### 7. 如何配置 Redis 发布节点选择策略？

仅当集群中有多个 Redis 节点时，才会启用节点选择策略。其目的是根据某些规则确定将消息发布到哪个 Redis 节点，以实现负载均衡和高可用性。如果只有一个 Redis 节点，则默认选择该节点，无需进行额外配置。

框架当前支持三种 Redis 节点选择策略：

| 策略类型       | 描述                             |
|----------------|----------------------------------|
| `random`       | 随机选择一个进行发布   |
| `round-robin`  | 顺序轮流选择节点，平均分担负载     |
| `fastest`      | 选择延迟最小（ping 最快）的节点    |

---

#### 各策略适用场景分析

##### `random` - 简单健壮  
- **适合**：一般中小型部署，节点性能较均衡时  
- **优点**：实现简单，不易形成热点  
- **缺点**：短时间内可能造成负载偏移

##### `round-robin` - 均衡可靠  
- **适合**：需要稳定分布流量的服务  
- **优点**：天然负载均衡，各节点压力均匀  
- **缺点**：不考虑节点当前状态或延迟

##### `fastest` - 延迟优先（慎用）  
- **适合**：物理分布广、网络延迟明显的集群  
- **优点**：理论上可减少响应延迟  
- **缺点**：
  - 延迟只是参考值，不能代表真实负载  
  - 本地最快 ≠ 全局最优，可能造成远程节点漏收消息


#### 推荐策略选择

| 场景                   | 推荐策略      | 说明 |
|------------------------|---------------|------|
| 本地单机或小规模部署   | `round-robin` | 延迟差小，轮转更稳 |
| 多 Redis 节点无跨机     | `random` / `round-robin` | 看重随机性还是均衡性 |
| 跨物理服务器部署       | ✅ `round-robin` | 避免本地优先导致的消息传播盲区 |
| 需要极致延迟控制       | `fastest` | 需根据reids节点分布情况综合考虑 |


框架内部会 **自动维护所有 Redis 节点的健康状态**，你无需手动检测或管理：

- 每个节点会定期进行 ping 检测、连接状态判断等机制，更新节点状态；
- 如果某个 Redis 节点出现连接失败、超时等异常，将被标记为 `不健康`；
- 所有 **发布消息的操作只会从健康节点中选择目标节点**，不再向失效节点发送消息。


#### 🧠 设计原则总结

- **去中心化**：所有服务器都订阅全部 Redis 节点，彼此对等，单点故障不会导致信息孤岛；
- **容错性强**：节点异常不影响全局，只要还有健康 Redis，消息就能被接收；
- **健康优先**：任何发布策略（如 random / round-robin / fastest）都只作用于健康节点集合内。


### 8. Redis 节点配置多少个合适？

在本框架中，Redis 仅用于 Pub/Sub 消息广播，不涉及数据落盘、复杂事务、慢查询等场景，因此其吞吐瓶颈主要取决于以下几个因素：

 - 消息体积
 - 订阅者数量
 - 网络延迟

#### 实战建议：
如无特别高的广播频率或节点数，单个 Redis 足够支撑多数项目；
也可以根据服务器硬件配置灵活增加 Redis 实例，以充分保障系统稳定性。
由于仅使用 Redis 的发布和订阅功能，无存储操作，因此增加一个 Redis 节点的成本极低，
每新增一个节点，便多一份保障，提升系统的容错能力和扩展性。

如果涉及跨物理服务器部署，建议根据自身项目的节点数量、广播频率和网络拓扑，弹性增加 Redis 实例数量，以分摊消息转发压力、缓解网络瓶颈。

框架设计下，所有 Redis 节点为平级无主从关系，
负载均衡在消息发布时由框架统一调度，
根据实际部署需求灵活增减 Redis 节点，无需改动任何逻辑代码，新节点加入即刻生效，轻松实现平滑扩展。

### 9. WebSocketCrossServerAdapter何时应该启用 Redis 数据压缩功能？

建议仅在涉及跨物理服务器通信时启用 Redis 数据压缩功能。
在同一台物理服务器或局域网内部，本地数据传输的性能瓶颈较小，
频繁压缩和解压数据包可能带来额外的 CPU 开销，导致性能损耗超过因传输数据量减少带来的收益。

是否开启压缩功能还取决于传输的数据包大小等因素，
如果数据包较大，建议开启压缩，
框架内部的压缩模块通常能减少大约 30% 的数据体积。

因此，只有在跨物理服务器或跨网络的 Redis 分布式部署场景下，
开启数据压缩功能才能有效降低网络带宽压力，提升整体通信效率。

⚠️ **极为重要的提醒：**  
**Redis 压缩功能必须在所有服务器节点上保持配置一致。**  
一旦启用压缩，所有服务器都必须统一开启，否则将导致部分节点收到的数据无法正确解码，从而引发数据解析错误，甚至通信异常。

### 10. WebSocket 服务器端到客户端的数据传输支持压缩吗？

我们的 WebSocketCrossServerAdapter 本身并不主动进行数据压缩。

虽然底层的 `ws` 库支持 `permessage-deflate` 压缩扩展，可通过配置项启用，但启用压缩需要服务器和客户端都支持并协商一致的压缩协议。
此外，`permessage-deflate` 在性能和内存使用上可能带来较大开销，特别是在高并发场景下，可能导致内存碎片和性能下降。
浏览器端对该压缩协议的支持也不完全一致，启用压缩可能存在兼容性风险。
如需了解详细内容和配置方法，请参考 [ws 官方文档关于 permessage-deflate](https://github.com/websockets/ws#websocket-compression)。

因此，我们建议谨慎使用该功能，并根据项目需求自行实现适配的压缩方案。

### 11. 房间的命名空间该如何设计？

#### 设计要点
- `roomNamespace` 用于定义房间的粒度与分类，开发者可自定义命名规则。  
  推荐使用层级分隔符（如 `app:chat:game:hot`）来表示不同的业务模块或房间类型。

- 命名空间的粒度需控制得当：  
  - 粒度过粗会导致订阅范围过大，广播消息浪费资源；  
  - 粒度过细则会导致频道数量激增，订阅管理复杂度上升。

- 对于命名**无固定规律或无法预知**的房间命名空间（如每局游戏生成的唯一房间），其 Redis 频道会不断创建。  
  若构造函数中配置了 `autoUnsubscribe: false`，**这类频道在房间清空后不会主动触发取消订阅**，将导致频道数量持续增长，进而造成资源浪费。

- 强烈建议将常用、可预知的频道配置到构造函数的 `presetRoomNamespaces` 中。  
  这些频道会在初始化时自动订阅，并在整个生命周期内保持订阅状态。  
  即使房间为空，也**不会因为 `autoUnsubscribe` 配置而被自动取消订阅**。

- 若某些常用频道未列入 `presetRoomNamespaces`，且启用了 `autoUnsubscribe`，则可能频繁触发频道的订阅与取消，带来性能抖动风险。

#### 推荐配置建议

- **预设常用频道，减少不必要的订阅开销：**  
  将常用或命名结构可预知的频道配置到 `presetRoomNamespaces` 中，可以避免在每次加入房间时重复执行订阅操作。  
  同时，这些频道也不会因 `autoUnsubscribe` 而被自动取消订阅，避免反复订阅带来的性能抖动。

- **保持 `autoUnsubscribe` 默认开启，提高系统可维护性：**  
  对于非 `presetRoomNamespaces` 的临时频道，开启 `autoUnsubscribe` 可以在房间无人时自动取消订阅，  
  避免 Redis 频道数量无限增长，减轻服务器订阅压力，同时减少不必要的跨服消息传递。

### 12. 在分布式 WebSocket 服务中，如何获取房间或者玩家相关的信息？

#### 本地统计

如果只需要统计本地服务器上的房间信息，可以直接调用本地 API，例如：

- 获取某个房间的在线人数：[`getSocketCountInRoom(roomNamespace, roomId, options)`](./api.zh-CN.md#getsocketcountinroomroomnamespace-roomid-options)
- 获取某个房间所有在线玩家的 `socketId` 列表：[`getRoomSocketIds(roomNamespace, roomId, options)`](./api.zh-CN.md#getroomsocketidsroomnamespace-roomid-options)
- 获取某个玩家加入的所有房间集合：[`getJoinedRooms(socketId)`](./api.zh-CN.md#getjoinedroomssocketid-roomnamespace)



这些接口均返回本地服务器上的数据，响应速度快，开销低。

#### 跨服务器聚合统计

若需要统计所有服务器节点上的房间信息，需要通过跨服务器事件进行数据聚合：

1. 在各服务器节点注册跨服事件处理器，例如：

```js
wsServer.onCrossServerEvent('getSocketCountInRoom', (data, callback) => {
  const count = wsServer.getSocketCountInRoom(data.roomNamespace, data.roomId);
  if (callback) {
    callback({ count });
  }
});
```
2. 在需要统计的服务器节点发起跨服务器广播请求：
```js
const result = await crossServer.emitCrossServerWithPromise(
  'getSocketCountInRoom',
  { roomNamespace: 'chat', roomId: 'room123' },
  {
    targetServer: [],         // 空数组表示广播所有节点
    expectedResponses: 3      // 假设有 3 个服务器节点
  }
);

注意： 需要提前知道集群中服务器节点的数量，以设置 expectedResponses。

if (result.success) {
  console.log('所有预期节点均已响应:', result.responses);
} else {
  console.log('已响应的节点:', result.responses);
  console.log('未响应的节点数:', result.unrespondedCount);
}
```

所有涉及跨服务聚合统计的需求均可采用基于事件的跨服通信方式实现，具体通过 [`onCrossServerEvent`](./api.zh-CN.md#oncrossservereventevent-listener) 注册处理函数，结合 [`emitCrossServer`](./api.zh-CN.md#emitcrossserverevent-message-callback-options)  和 [`emitCrossServerWithPromise`](./api.zh-CN.md#emitcrossserverwithpromiseevent-message-options) 发起跨服调用，灵活聚合各节点数据，满足绝大多数分布式场景需求。

另一种方案是搭建全局中心化的数据中枢（如数据库或 Redis 集群），各节点动态更新数据到该中心，便于集中查询。但此方式依赖中心化设计，与本框架去中心化理念不符。开发者可根据自身业务需求灵活选择最合适方案。

基于本框架的跨服事件机制，你可以自由发挥设计，实现复杂的跨节点通信与数据聚合，满足多样化业务场景。

### 13. 在分布式 WebSocket 服务中，如何把用户分配到不同的 WebSocket 服务器？

在分布式架构中，用户连接通常通过负载均衡器自动分发到多个 WebSocket 节点，或者由应用层根据自定义分配逻辑将用户分配到指定节点。

#### 方法一：基于负载均衡器的自动分发与 Sticky Session（可选优化）

在多数部署场景中，负载均衡器（例如 Nginx、HAProxy、AWS ELB 等）负责将客户端连接自动分发到后端多个 WebSocket 节点。默认策略通常是随机分配或轮询调度，实现无状态的请求转发。

部分负载均衡器支持配置“粘性会话（Sticky Session）”，即让同一用户在短时间内优先连接到之前访问过的节点，以减少状态迁移带来的开销。常见策略包括：

- 基于 Cookie 标识绑定  
- 基于 IP Hash 计算  
- 基于 Header / URL 参数的自定义字段映射  

优点：可减少频繁节点切换带来的状态同步复杂度  
注意：是否使用粘性会话取决于业务需求，非必选项。

#### 方法二：应用层的自定义分配逻辑

业务层可根据用户 ID、Token 或其他特征实现一致性哈希、分片等策略，由登录服务或网关引导客户端连接到指定 WebSocket 节点。

优点：逻辑完全可控，适合复杂调度或定制化分片场景。

#### 原理简述

由登录服务、认证服务在用户登录或初始化时决定用户应连接的目标 WebSocket 节点。核心流程如下：

1. 客户端访问登录服务
2. 登录服务根据用户信息执行自定义分配策略（如一致性哈希、分区映射等）
3. 返回给客户端一个目标 WebSocket 节点的地址
4. 客户端用此地址建立连接

#### 常见实现方式

1. 一致性哈希分配

```js
const nodes = ['ws1.example.com', 'ws2.example.com', 'ws3.example.com'];
function getTargetNode(userId) {
  const hash = crc32(userId); // 可使用 CRC32、md5 或 murmurhash 等
  return nodes[hash % nodes.length];
}
```

2. 房间或频道分配

```js
function getTargetNodeByRoom(roomId) {
  return nodes[roomId % nodes.length];
}
```

3. 用户标签或属性

```js
if (user.isVIP) return 'vip-ws.example.com';
if (user.region === 'CN') return 'cn-ws.example.com';
return 'default-ws.example.com';
```

#### 客户端连接伪代码

```js
// 登录阶段获取推荐连接节点
const res = await fetch('/api/get-websocket-node', { method: 'POST', body: { userId: 'u123' } });
const wsUrl = res.data.websocketUrl;

// 连接 WebSocket
const socket = new WebSocketConnector({ url: wsUrl });

```

#### 优点

- 控制力强，可按需调整节点分布；
- 配合业务逻辑（如房间/频道）更容易优化性能；
- 对状态保持要求低，不依赖负载均衡器的“粘性会话”支持；
- 易于水平扩展和迁移策略。

#### ⚠️ 注意事项

- 需要维护一套可感知所有 WebSocket 节点状态的服务；
- 若目标节点不可用，需有自动降级或 fallback 机制；
- 初期部署建议配合日志记录、调度验证，确保不会将流量倾斜过度或路由失效。

#### 框架层支持灵活调度，无需依赖粘性连接

我们的框架不依赖粘性连接，用户连接到任意节点都能正常工作。只要正确处理以下核心逻辑，即可实现灵活分布：

- **上线检测（连接鉴权）**  
  为了确保全局范围内单个用户连接映射的唯一性，开发者需通过跨服事件查询其他节点的用户状态，若发现该用户已在线，则自行决定踢出旧连接或拒绝当前连接，防止同一用户在多个节点重复登录。

- **掉线处理（连接断开）**  
  用户断开后清除其在本节点的状态，并通知相关逻辑模块其已离线。

- **状态广播（节点间同步）**  
  某用户上线或下线时，广播通知其他节点。例如用于房间内成员状态更新。

#### 关于业务状态的“归属”与“去中心化”设计原则

如果某个用户关联了特定的业务对象实例（如游戏房间对象），建议优先在断线重连时引导其回到原来的服务器节点，以避免因跨服访问该对象带来的同步复杂度与延迟。

我们的推崇的理念是：

- **去中心化设计**  
  每个 WebSocket 节点管理自己本地创建的业务对象，不依赖中心式的数据存储（如 Redis）进行状态集中管理。

- **跨服发现机制**  
  通过框架内置的跨服务器事件机制进行询问，例如“这个家伙在你们那吗？”、“某房间实例在哪个节点？”。避免依赖中心数据库查找，降低故障影响面，提升系统弹性。

这样的架构具备更强的横向扩展能力，也更契合分布式架构的发展方向。当然，具体设计方案需结合实际业务需求来确定。

### 14. WebSocketConnector 客户端断线后不会自动重连吗？

是的，`WebSocketConnector` 默认**不会在 `close` 事件中自动重连**。

这是因为断线的原因可能有很多种，例如：

- 鉴权失败导致服务器主动断开连接；
- 服务器出于业务需求强制踢出客户端；
- 网络环境异常等。

对于前两种情况，如果客户端持续自动重连，可能会造成无意义的连接请求，甚至带来安全隐患或资源浪费。

因此，我们**将是否重连的控制权交由开发者自行处理**，可根据具体的断线原因决定是否以及何时发起重连。

此外需要注意的是：

> **`error` 事件触发时将默认自动重连**（除非显式调用 `manualClose` 阻止重连），  
> 而 **`close` 事件则不会自动重连**，需要开发者根据 `code` 和 `reason` 判断是否手动重连。

具体使用方式请参考示例中的**第一章节：单 WebSocket 服务器**，示例代码与注释中提供了详细说明。


### 15. 前端环境如何使用 WebSocketConnector 类？

如果你想在浏览器中通过 <script> 标签使用 WebSocketConnector 类，可以下载并引入项目提供的客户端类：

🔗 **GitHub 文件链接**：  
- [websocketConnector.js](https://github.com/LiuYiSong/websocket-cross-server-adapter/blob/main/src/WebSocketConnector.js)

使用方法

在你的 HTML 文件中通过 <script> 标签引入该文件：

```html
<script src="websocketConnector.js"></script>
```
引入后，WebSocketConnector 会自动暴露在 window 全局对象下，可直接使用：
```js
const connector = new WebSocketConnector({
    url: `ws://localhost:8080`,
  });
```

- **现代框架（React / Vue / React Native）**：支持通过 npm 包模块化导入，示例：

首先安装依赖：

```bash
npm install websocket-cross-server-adapter

```

然后在代码中引入使用：

```js
import { WebSocketConnector } from 'websocket-cross-server-adapter';

const connector = new WebSocketConnector({
    url: `ws://localhost:8080`,
  });

```

其他**基于标准 WebSocket 的前端平台**，同样可以直接使用该类进行实时通信。

### 16. WebSocketConnector 客户端只能使用 URL 方式传递参数吗？

是的。虽然在 Node.js 环境中，使用 ws 模块的客户端支持通过自定义请求头（headers）传递参数，比如用于身份认证或客户端标识，但浏览器环境的原生 WebSocket 构造函数不支持设置自定义请求头，只能通过 URL 拼接参数进行传递。

WebSocketConnector 主要面向浏览器前端使用，此外还支持像 Cocos Creator、React Native、小程序等多种环境。这些环境中，WebSocket 的实现通常也不支持自定义请求头，或者 Cookie 等认证方式有限，因此也只能通过 URL 传递参数。

为了保证所有环境下行为一致、兼容性最佳，并简化开发和维护，我们统一采用通过 URL 传递参数的方式，即便在 Node.js 环境中也保持该做法。

### 17. 如何安全且兼容地传递认证及其他敏感信息？

在 WebSocket 连接中传递认证和敏感信息时，常见且推荐的做法有以下几种：

1. **URL 参数传递**

浏览器原生 WebSocket 不支持自定义请求头，客户端只能通过在连接 URL 中拼接认证 token 参数来传递身份信息。例如：  
`wss://example.com/ws?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
服务器接收到连接请求后，从 URL 中解析 token 并完成身份验证。该方式实现简单且兼容性好，但 token 可能会暴露在浏览器历史记录、代理服务器和日志中，存在一定的安全风险。  
**不推荐使用长期有效的 token 通过 URL 传递，建议仅用于短期或一次性 token。**

2. **连接建立后发送认证消息**

为了避免在 URL 中暴露敏感信息，客户端可以在 WebSocket 连接建立后，主动发送一条带有认证 token 的消息进行身份验证。  
服务器收到后验证 token 合法性，通过认证后允许连接继续进行业务交互。该方式避免了 token 在 URL 中泄露，兼容多种客户端环境（浏览器、小程序、React Native 等），但要求服务器实现认证消息处理及超时断开机制。

为防止恶意客户端连接后不发送认证消息，导致服务器资源被耗尽，服务器应在连接建立时启动认证超时定时器，如果客户端在设定时间内未完成认证，则主动断开连接。此外，也可以定期巡查所有连接，清理长时间未认证或闲置的连接，确保服务器资源得到合理释放和利用。

3. **会话ID（Session ID）或短期 token 方式**

用户通过 HTTP 登录接口获取短期有效的 sessionId 或一次性 token，随后在建立 WebSocket 连接时，将该 sessionId 或 token 作为 URL 参数传递。服务器根据该参数识别用户身份并完成认证。


除此之外，还有一些特殊场景或辅助方案，比如：

- **Cookie 方式**：浏览器可自动携带，但在 React Native、小程序等环境支持差，且有跨域和安全隐患。

- **Sec-WebSocket-Protocol 协议头传递**：理论上可用，但浏览器兼容性和服务端支持有限，容易出现坑。


总体来说，无论采用哪种认证信息传递方式，都强烈建议使用加密的 `wss://` 协议，确保数据传输安全，防止中间人攻击和敏感信息泄露。

---

## 联系方式

如果你在使用过程中有任何问题或建议，欢迎随时与我联系交流。
你也可以通过 GitHub 仓库的 Issues 反馈问题或提出建议。

为了防止邮件被误归类到垃圾邮件，请在邮件主题或正文前面加上 [WebSocketCrossServerAdapter]。
邮箱：349233775@qq.com

---

## 许可证
本项目基于 MIT 协议开源，具体内容请查看 [LICENSE](./LICENSE) 文件。
