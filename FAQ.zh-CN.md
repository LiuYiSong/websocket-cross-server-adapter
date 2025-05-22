## 目录

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
