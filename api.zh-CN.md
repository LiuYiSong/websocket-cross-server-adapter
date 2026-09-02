# 目录
[English version](./api.en-US.md) 

- [WebSocketCrossServerAdapter](#websocketcrossserveradapter)
  - [Constructor(options)](#constructoroptions)
  - [onCrossServerEvent(event, listener, tag)](#oncrossservereventevent-listener-tag)
  - [onceCrossServerEvent(event, listener, tag)](#oncecrossservereventevent-listener-tag)
  - [offCrossServerEvent(event, listenerOrTag)](#offcrossservereventevent-listenerortag)
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
  - [系统内置 WebSocket 事件说明](#系统内置-websocket-事件说明)
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

### 描述  
`WebSocketCrossServerAdapter` 的构造函数。用于初始化一个 WebSocket 跨服务器通信适配器，并可提供多种配置选项。

### 参数说明

- `options` `{Object}`：适配器的配置对象。

  - `serverName` `{string}`：（必填）当前服务器节点的 **全局唯一标识符**，用于跨服务器通信和回调 ID 生成。

    示例值包括 `"us-east-1-node3"` 或 `"game-server-42"`。

    ### 说明

    - 必须保证在所有服务器节点间唯一。
    - 建议长度不超过 **16** 个字符，避免过长增加通信负担。
    - `serverName` 会随跨服务器消息发送，过长会影响通信性能。

  - `bridgePrefix` `{string}`：（可选）跨服务器桥接频道前缀，默认值为 `'csbp:'`。

    **说明**：  
    此前缀用于标识所有跨服务消息的 Redis 频道，所有跨服务器通信都会使用带有此前缀的频道。  
    它是区分跨服务器消息和其他消息的关键标识，必须在所有服务器节点之间保持一致且唯一。  
    注意：**此值必须与 `wsPrefix` 不同**，否则会导致消息冲突和处理混乱。

  - `wsPrefix` `{string}`：（可选）WebSocket 频道前缀，默认值为 `'ws:'`。

    **说明**：  
    此前缀用于标记 WebSocket 路由频道的 Redis 频道，专门用于管理客户端连接的房间消息。  
    其作用是区分普通的跨服桥接消息（`bridgePrefix`）和基于 WebSocket 的房间通信消息。  
    同样，**此值必须与 `bridgePrefix` 不同**，确保两类消息在 Redis 频道上不会混淆。

    ⚠️ **重要说明**：  
    `bridgePrefix` 和 `wsPrefix` 这两个前缀不能相同。  
    如果两个前缀设置成相同值，会导致跨服务器消息和 WebSocket 房间消息混淆，可能造成通信错误和数据丢失。


  - `wsOptions` `{Object}`：（可选）WebSocket 服务的配置选项。如果不传该参数，表示**不会启动 WebSocket 服务**。

    **说明**：此对象包含 WebSocket 服务的所有配置项。所有与 WebSocket 相关的配置请放入此对象中。更多细节请参考 [ws 官方文档](https://github.com/websockets/ws?tab=readme-ov-file)。

    **常见配置项**：

    - `noServer` `{boolean}`：是否使用 `noServer` 模式，默认值为 `false`。
    - `server` `{Object}`：外部提供的 HTTP/HTTPS 服务实例。
    - `port` `{number}`：WebSocket 服务监听端口。

  - `serverPingInterval` `{number}`：（可选）**服务器向所有已连接客户端发送 WebSocket 协议层级 `ping` 帧的时间间隔**，默认值为 `20000`。

    **说明**：  
    此参数控制服务器每隔多少毫秒发送一次底层 WebSocket `ping` 帧给客户端。  
    这并非应用层心跳，而是 WebSocket 协议本身提供的机制，用于检测断开的 TCP 连接。  
    客户端接收到 `ping` 帧后会自动回应一个 `pong` 帧；若连接已中断，服务器无法收到 `pong`，便可据此关闭该连接。

    ⚠️ **注意**：请勿与应用层实现的心跳机制混淆（例如字符串 `"ping"`）。  
    应用层心跳通常由客户端主动发起，用于检测逻辑层的连接状态。

  - `enterBackgroundCloseTime` `{number}`：（可选）客户端进入后台后强制关闭 WebSocket 连接的超时时间，单位为毫秒，默认值为 `10000`（10 秒）。

    **说明**：  
    此参数用于控制客户端进入后台模式后，服务器等待多久再主动断开连接。  
    在 iOS 和 Android 平台上，后台状态的处理方式不同，客户端可通过事件监听在进入后台时将时间戳通知服务器。  
    若客户端保持后台状态超过该时间，服务器可主动断开连接。  
    如果不需要此功能，客户端无需发送进入后台的通知即可。

  - `heartbeatStr` `{string}`：（可选）心跳字符串，默认值为 `''`（空字符串）。

    **说明**：  
    此值为服务器用于识别客户端心跳包的字符串。  
    必须与客户端发送的心跳包内容一致（如通过 `WebSocketConnector` 类发送）。  
    当服务器收到该字符串的消息时，会使用相同内容进行回应，作为心跳响应。

  - `rateLimit` `{number}`：（可选）单个 WebSocket 连接每秒允许接收的最大消息数量，默认值为 `0`（关闭限流）。

    **说明**：
    此参数可用于防止客户端大量发送消息造成 WebSocket 服务消息洪泛。
    当设置为大于 `0` 的数值时，每个 WebSocket 连接每秒最多处理指定数量的消息，超过限制的消息将被直接忽略。

    设置为 `0` 表示关闭消息限流，保持默认的不限制行为。

    **示例**：
    ```js
    const adapter = new WebSocketCrossServerAdapter({
        rateLimit: 100
    });
    ```

  - `redisForcePing` `{boolean}`：（可选）是否强制启用 Redis 健康检查，默认值为 `true`。

  - `redisPingInterval` `{number}`：（可选）Redis 健康检查的发送间隔，默认值为 `5000`。

  - `redisPingTimeout` `{number}`：（可选）Redis 健康检查超时时间，默认值为 `2000`。

  - `selectionStrategy` `{string}`：（可选）Redis 节点选择策略，默认值为 `'random'`，可选值有 `'random'`、`'round-robin'`、`'fastest'`。

  - `enableRedisDataCompression` `{boolean}`：（可选）是否启用 Redis 数据压缩，默认值为 `true`。

  - `onRedisHealthChange` `{function}`：（可选）Redis 健康状态变更时的回调函数。

  - `onRedisSubscriptionError` `{function}`：（可选）Redis 订阅失败时的回调函数。

  - `presetRoomNamespaces` `{Array<string>}`：（可选）预定义的 WebSocket 房间命名空间。

    **说明**：  
    开发者可预设一组命名空间，如 `"chat"`、`"game"`、`"group"` 等。  
    这些命名空间在 Redis 初始化时将 **自动订阅对应的 Redis 频道**。  
    你也可以不预设，而是在客户端通过 `joinRoom` 动态加入房间时再订阅对应频道。  
    命名空间的设计应结合业务逻辑及房间分类策略进行。
  
  - `autoUnsubscribe` `{boolean}`：（可选）当某个房间命名空间内没有任何客户端时，是否自动取消订阅该 Redis 频道，默认值为 `true`。
  
    此设置仅针对非预设（非 `presetRoomNamespaces` 中列出的）房间命名空间生效。  
    预设房间不会受此影响，始终保持订阅状态。

  - `customChannels` `{Array<string>|string}`：（可选）自定义 Redis 频道。

    **说明**：  
    一组开发者自定义的 Redis 频道名称。  
    这些频道在 Redis 初始化时将 **自动订阅**。  
    你可以注册 **自定义频道处理器** 来处理这些频道上的消息，  
    从而实现除 WebSocket 房间通信之外的 **自定义跨服通信逻辑**。

  - `redisConfig` `{Array<Object>}`：（可选）Redis 节点的配置。

    **说明**：  
    用于连接一个或多个 Redis 节点的配置数组。  
    每个对象应包含 [ioredis](https://github.com/redis/ioredis) 所需的连接参数，  
    如 `host`、`port`、`password`、`db`、`tls` 等。  
    本配置用于建立发布者与订阅者连接，支持跨服务器通信、健康检查与消息路由。

---
## onCrossServerEvent(event, listener, tag)

### 描述  
注册一个 **跨服务器事件监听器**，用于处理从其他服务器节点发送过来的事件。  

该函数支持注册多个监听器，每次其他节点广播对应事件时，本节点所有对应监听器都会被依次调用。  

> 💡 注意：只有在 `enableCrossServer` 启用的前提下，该函数才会生效。  

### 参数

- `event` `{string}`：要监听的事件名（跨服务器事件名称）。
- `listener` `{Function}`：事件处理函数，接收到跨服务器广播的事件时将被调用。
- `tag` `{string|number}` [可选]：用于标识该监听器的自定义标签，方便未来移除。

### 返回值

- `void`

---

## onceCrossServerEvent(event, listener, tag)

### 描述  
注册一个 **只触发一次的跨服务器事件监听器**，用于处理从其他服务器发送过来的事件。  
该监听器在第一次触发后将会自动移除。

> 💡 注意：该函数仅在 `enableCrossServer` 启用时生效。

### 参数

- `event` `{string}`：要监听的事件名称（跨服务器事件）。
- `listener` `{Function}`：事件处理函数。
- `tag` `{string|number}` [可选]：用于标识该监听器的自定义标签，方便未来移除。

### 返回值

- `void`

---

## offCrossServerEvent(event, listenerOrTag)

### 功能说明

移除指定的跨服务器事件监听器。  
- 若传入的是函数，则移除该函数对应的监听器。  
- 若传入的是字符串或数字，则移除匹配该标签的监听器。  
- 若不传 `listenerOrTag`，则移除该事件下的所有监听器。

### 参数说明

- `event` `{string}`：要移除监听器的事件名称。
- `listenerOrTag` `{Function|string|number}` [可选]：要移除的监听函数或标签。

### 返回值

- `void`

---

## publishRedisMessage(channel, message)

### 描述

向指定的 Redis 频道发布消息，主要用于内部跨服务器广播和 WebSocket 路由。  
当开发者需要向自定义 Redis 频道发送消息时才调用，通常不需要直接调用此方法。


### 参数

- `channel` `{string}`：要发布消息的 Redis 频道名称，必须是非空字符串。
- `message` `{Object}`：要发送的消息对象，会被转为字符串或经过压缩编码发送。

### 返回值

- `{boolean}`：发布操作是否成功。

### 详细说明

该方法用于向指定的 Redis 频道发布消息，支持内部房间广播和自定义频道通讯。  
如果未启用跨服务器功能，则发布失败返回 `false`。  
消息对象根据配置会被转换为字符串（使用 JSON.stringify）或使用 notepack 压缩编码。  
若没有可用的健康 Redis 实例，或转换失败，则发布失败。  
成功发布返回 `true`，失败返回 `false`。

---

## emitCrossServer(event, message, callback, options)

### 描述

用于向目标服务器发送事件消息，支持广播和定向发送。  
该方法支持带回调函数的请求-响应机制，广播模式下会为每个目标服务器的响应分别触发回调。  
回调函数在每收到一个目标服务器响应时调用，回调参数中包含当前剩余未响应服务器的数量。  
当达到预期响应数或超时后，回调仍会被触发，通知调用者响应结束或超时。  
消息会优先在本地服务器处理（如果适用），然后通过 Redis 频道转发给其他服务器。  
如果跨服务器功能未启用或参数无效，则直接返回不执行发送。

### 参数

- `event` `{string}`：事件名称，不能为空字符串。
- `message` `{Object}`：发送的消息内容。
- `callback` `{Function}`（可选）：用于接收目标服务器响应的回调函数，会被多次调用。
- `options` `{Object}`（可选）：配置对象。
  - `targetServer` `{string|string[]}`（默认 `[]`）：目标服务器列表，空数组或空字符串表示广播到所有服务器。
  - `timeout` `{number}`（默认 `5000` 毫秒）：回调超时时间，超时后触发一次回调通知。
  - `expectedResponses` `{number}`（默认广播时为 1，定向时为目标服务器数量）：期望接收的响应数量。
  - `exceptSelf` `{boolean}`（默认值为 `false`）：是否在广播时排除当前服务器处理消息。  
  该参数仅在执行全局广播时生效，即 `targetServer` 为一个空数组 (`[]`) 的情况下。  
  如果 `targetServer` 指定了一个或多个服务器，`exceptSelf` 会被忽略，当前服务器如果在目标中则会处理该消息。

### 关于 `expectedResponses`

在广播模式（即 `targetServer` 为 `[]`）下，系统无法自动得知当前集群中实际在线的服务器节点数量。  
原本的做法是提前静态注册所有服务器名称来解决这个问题，但实践中发现这种方式缺乏灵活性，且在动态增删节点时会带来较大的维护成本。

为了解决这一问题，服务器列表的管理权交给了开发者。  
当需要广播消息时，开发者需要手动指定 `expectedResponses` 的值，表示预期有多少个服务器会对该消息做出响应。  
这种设计让系统更加**灵活可扩展**，可以支持服务集群的动态扩容与缩减，而无需进行集中式配置或同步。

> 在点对点模式（即 `targetServer` 为指定服务器列表）下，`expectedResponses` 会自动设置为目标服务器数量。

### 返回值

- `void`：无返回值。

### 详细说明

该方法为跨服务器事件发送的核心接口，支持向指定服务器或全部服务器广播消息。  
回调函数会在每个目标服务器响应时触发一次，并传入参数包含：

- `success` `{boolean}`：本次响应是否成功。
- `data` `{Object}`：目标服务器返回的数据（成功时）。
- `remainingResponses` `{number}`：当前剩余未响应的服务器数量。
- `error` `{string}`（仅失败时）：错误信息。
- `callbackId` `{string}`：用于标识该回调的唯一 ID。
- `unrespondedCount` `{number}`（仅超时时）：未响应的服务器数量。

当所有预期响应都收到或超时触发时，回调将被调用通知调用方。  
广播消息时，除非设置 `exceptSelf: true`，当前服务器也会处理该消息。  
定向发送时，期望响应数默认等于目标服务器数量，广播默认期望响应数为 1（可覆盖）。  
消息会先在本地处理（如果适用），再通过 Redis 频道发布给其他服务器。  
如果跨服务器功能未开启，或消息内容无效，将直接返回不做处理。

### 示例

```js
adapter.emitCrossServer(
  'updateGameState',  // 事件名称
  { state: 'levelUp', level: 5 },  // 消息体
  (response) => {  // 回调，可能被多次调用
    if (response.success) {
      console.log(`收到服务器响应，剩余未响应数量: ${response.remainingResponses}`);
      console.log('响应数据:', response.data);

      // 重要提示：
      // response.data.callbackId 包含本次请求的唯一回调 ID。
      // 结合业务逻辑，你可以判断是否已经收到了足够的服务器响应，
      // 满足条件时调用 this.deleteCrossServerCallback(callbackId) 主动销毁回调，
      // 后续的服务器响应将不会触发回调。
      // 不处理的话，系统会在超时后自动清理回调。
      // response.data.senderServer 表示该响应是由哪个服务器返回的。可用于在多服务器广播场景下，识别每条响应的来源服务器。
    } else {
      console.error('广播回调失败或超时:', response.error);
      console.error('未响应服务器数量:', response.unrespondedCount);
    }
  },
  { timeout: 3000, expectedResponses: 3 }  // 超时 3 秒，期望 3 个服务器响应
  // 默认不设置 targetServer 或设置为 [] 表示广播模式，
  // 此时 expectedResponses 表示预期需要响应的服务器节点数量（必须手动设置）。否则会默认为 1。
  // 如果设置了 targetServer=['serverA','serverB']，表示点对点发送，
  // 那么 expectedResponses 可省略，系统会默认取目标服务器数量作为预期响应数。
);
```
### 补充说明：获取响应方服务器名称

每次回调响应中都包含字段 `response.data.senderServer`，  
用于标识该响应是**由哪个服务器**返回的。

开发者可以借此：

- 跟踪已响应的服务器列表
- 配合业务逻辑处理不同服务器的响应
- 动态判断是否提前结束回调（例如通过 `deleteCrossServerCallback(callbackId)` 手动销毁）

> ⚠️ 注意：提前销毁回调后，其余未响应服务器的返回结果将被忽略。


---

## emitCrossServerWithPromise(event, message, options)

### 描述

广播跨服务器事件，返回一个 Promise，该 Promise 会在所有预期响应收到或超时后被解决。

此方法支持向一个或多个服务器发送消息（或广播到所有服务器），并等待目标服务器的响应，使用 Promise 方式实现异步处理。

### 参数

- `event` `{string}`  
  要发送的事件名称。

- `message` `{Object}`  
  携带的消息负载。

- `options` `{Object}`（可选）  
  额外配置项。

  - `targetServer` `{string|string[]}`（默认 `[]`）  
    目标服务器名称或名称数组。为空或不传表示广播给所有服务器。

  - `timeout` `{number}`（默认 `5000`）  
    等待响应的超时时间（毫秒），超时后 Promise 以失败解决。

  - `expectedResponses` `{number}`（默认 `1`）  
    预期响应的服务器数量。  
    广播时必须显式指定，否则默认 1；指定目标服务器时，内部自动设置为目标服务器数量。

  - `exceptSelf` `{boolean}`（默认 `false`）  
    广播时是否排除当前服务器处理。

### 返回值

`Promise<Object>` — 返回结果对象：

- 成功时(所有预期响应收到):

  ```js
  {
    success: true,
    responses: { [serverName]: responseData, ... }
  }
  ```
- 超时失败时：

  ```js
  {
    success: false,
    message: 'Cross-server callback timed out.',
    responses: { [serverName]: responseData, ... },
    unrespondedCount: number
  }
  ```
### 说明

该函数与 `emitCrossServer` 不同，它会等待所有预期的响应数量全部完成后，才会返回 Promise。

而 `emitCrossServer` 是每当一个服务器返回数据时就调用回调函数，不会等待全部响应。

### 示例代码

  ```js
  // 广播模式，等待3个服务器响应，超时时间3秒
  adapter.emitCrossServerWithPromise(
    'syncPlayerData',                   // 事件名称
    { playerId: 123, score: 4567 },    // 发送的数据
    { timeout: 3000, expectedResponses: 3 } // 选项：3秒超时，预期3个响应
  ).then(result => {
    if (result.success) {
      console.log('所有服务器响应完成:', result.responses);
    } else {
      console.warn('部分服务器未响应，超时或失败', result.unrespondedCount);
      console.log('已收到的响应:', result.responses);
    }
  });
  ```

### 示例代码(await方式)

  ```js
  async function syncData() {
    const result = await adapter.emitCrossServerWithPromise(
      'syncPlayerData',                   // 事件名称
      { playerId: 123, score: 4567 },    // 发送的数据
      { timeout: 3000, expectedResponses: 3 } // 选项：3秒超时，预期3个响应
    );

    if (result.success) {
      console.log('所有服务器响应完成:', result.responses);
    } else {
      console.log('部分服务器未响应，超时或失败', result.unrespondedCount);
      console.log('已收到的响应:', result.responses);
    }
  }

  syncData();

  ```

---

## deleteCrossServerCallback(callbackId)

### 描述

手动删除一个跨服务器回调函数，根据回调 ID 删除。

### 参数

- `callbackId` `{string}`: 要删除的回调函数 ID。

### 返回值

- `{boolean}`: 如果回调存在并被成功删除，返回 true；否则返回 false。

### 使用场景说明  
当使用 `emitCrossServer` 进行全局广播并注册回调函数时，开发者可以根据回调的结果和预期的响应情况，主动调用该函数提前删除对应的回调。如果不进行手动删除，且在设定的超时时间内未收集完成预期的服务器响应，系统会自动清除该回调。

因此，开发者应结合自身业务逻辑，在合适的时机调用此方法删除回调。删除后，后续服务器对该回调的响应将不再被接收和处理。

---

## manualSubscribe(channel)

### 描述

手动订阅指定的 Redis 频道。

### 参数

- `channel` `{string}`: 需要订阅的 Redis 频道名称。

### 返回值

- `void`

---

## manualUnsubscribe(channel)

### 描述

手动取消订阅指定的 Redis 频道。

### 参数

- `channel` `{string}`: 需要取消订阅的 Redis 频道名称。

### 返回值

- `void`

---

## setCustomChannelHandler(handler)

### 描述

设置自定义频道消息处理函数。

### 参数

- `handler` `{Function}`: 自定义的消息处理函数。

### 返回值

- `void`

---

## removeCustomChannelHandler()

### 描述

移除自定义频道消息处理函数。

### 参数

无参数。

### 返回值

- `void`

---

## addRedisInstance(config)

### 描述

添加一个 Redis 实例，并根据配置选择性启动健康检查机制。

该方法可以动态地向系统中加入新的 Redis 节点（发布者和订阅者），并设置相关事件监听和消息处理。如果存在多个 Redis 实例，且满足以下任一条件：

1. `redisForcePing` 被启用，或者  
2. `selectionStrategy` 设置为 `'fastest'`

则会启动一个计时器，定时对所有 Redis 节点进行 ping 操作，以监测它们的健康状态。消息的具体发布则由配置的选择策略决定。

### 参数

- `config` `{object}`: Redis 客户端连接配置对象。

### 返回值

- `void`

---

## getHealthyRedisInstancesCount(type)

### 描述

获取指定类型的健康 Redis 实例数量。

该方法根据传入的类型（'publisher' 或 'subscriber'）过滤 Redis 实例，检查其健康状态（`isHealthy` 为真），并返回健康实例的数量。

### 参数

- `type` `{string}`: 要统计的 Redis 实例类型。必须为 `'publisher'` 或 `'subscriber'`。

### 返回值

- `{number}`: 指定类型健康 Redis 实例的数量。

---

## getRedisInstancesCount()

### 描述

返回当前管理的 Redis 实例总数量。

### 参数

无

### 返回值

- `{number}`: Redis 实例的总数。

---

## onWebSocketEvent(event, listener, tag)

### 描述
注册一个针对特定 WebSocket 事件的监听器。  
你可以注册对应的系统事件函数，对系统事件进行处理。

### 系统内置 WebSocket 事件说明
- `connection`：当客户端连接时触发，回调参数：(socket, req)
- `close`：当客户端断开时触发，回调参数：(socket, req, code, reason)
- `error`：当客户端发生错误时触发，回调参数：(socket, req, error)
- `pong`：当客户端响应服务器发送的 ping 帧时触发，回调参数：(socket, req)
- `message`：当收到客户端消息时触发，回调参数：(socket, message)
- `client-ping`：当收到客户端主动发送的 ping 消息时触发，回调参数：(socket)
- `server-error`：当 WebSocket 服务器发生错误时触发，回调参数：(err)
- `listening`：当 WebSocket 服务器开始监听时触发
- `ws-server-close`：当 WebSocket 服务器关闭时触发

### 参数
- `event` {string|number} — 要监听的事件名称。  
- `listener` {Function} — 当事件被触发时调用的回调函数。  
- `tag` {string|number} [可选] — 用于标识监听器的自定义标签，方便后续移除。

### 返回值
- void

---

## onceWebSocketEvent(event, listener, tag)

### 描述
注册一个仅会被触发一次的特定 WebSocket 事件监听器。

### 参数
- `event` {string|number} — 要监听的事件名称。  
- `listener` {Function} — 当事件被触发时调用的回调函数。  
- `tag` {string|number} [可选] — 用于标识监听器的自定义标签，方便后续移除。

### 返回值
- void

---

## offWebSocketEvent(event, listenerOrTag)

### 描述
移除特定 WebSocket 事件的监听器。  
- 如果 `listenerOrTag` 是函数，则移除对应的函数监听器。  
- 如果是字符串或数字，则移除对应标签的监听器。  
- 如果未传，则移除该事件下所有监听器。

### 参数
- `event` {string|number} — 要移除监听器的事件名称。  
- `listenerOrTag` {Function|string|number} [可选] — 要移除的监听函数或标签，若不传则移除该事件下所有监听器。

### 返回值
- void

---

## broadcastToRoom(roomNamespace, roomId, event, data, options)

### 描述
向指定房间内的所有 WebSocket 客户端广播消息。  
- 当 `options.localOnly` 为 true 时，仅向本地客户端广播。  
- 你可以使用 `options.excludeSocketIds` 排除指定客户端。  
- 当 `options.localOnly` 为 false 时，通过 Redis 跨服务器广播。  
- 当 `options.roomDstroy` 为 true 时，广播结束后立即销毁房间。

### 参数
- `roomNamespace` {string} - 房间命名空间（例如 'chat', 'gameRoom'）。
- `roomId` {string} - 命名空间下具体的房间 ID。
- `event` {string} - 要广播的事件名称。
- `data` {Object} - 要发送给房间的消息数据。
- `options` {Object} [可选] - 额外的可选参数。
  - `excludeSocketIds` {string[]} [可选，默认=[]] - 排除接收消息的 socketId 列表。
  - `localOnly` {boolean} [可选，默认=false] - 是否仅向本地客户端广播。
  - `roomDstroy` {boolean} [可选，默认=false] - 是否在本地广播后销毁房间。

### 返回值
- `void`

---

## toSocketId(socketId, event, data)

### 描述
向指定玩家（通过 WebSocket `socketId` 标识）发送消息。  
- 当 WebSocket 服务关闭时，消息不会被发送。  
- 如果玩家在本地连接，消息将直接发送。  
- 否则，消息通过 Redis 发布实现跨服务器传递。  

### 参数
- `socketId` {string} - 玩家 WebSocket 的 socketId，必须是非空字符串。
- `event` {string} - 要发送的事件名称。
- `data` {Object} - 要发送的消息数据。

### 返回值
- `void`

---

## toSocketIds(socketIds, event, data)

### 描述
向多个玩家（通过 WebSocket `socketIds` 标识）发送消息。  
- 当 WebSocket 服务关闭时，操作跳过。  
- 消息直接发送给本地连接的玩家。  
- 对于未连接到本地服务器的玩家，通过 Redis 发布实现跨服务器传递。

### 参数
- `socketIds` {Array<string>} - 玩家 WebSocket socketId 的数组。
- `event` {string} - 要发送的事件名称。
- `data` {Object} - 要发送的消息数据。

### 返回值
- `void`

---

## broadcast(event, data, localOnly)

### 描述
向所有已连接的 WebSocket 客户端广播消息。  
- 如果 `localOnly` 为 `true`，仅广播到本地客户端。  
- 如果 `localOnly` 为 `false` 或未提供，消息同时发布到 Redis，实现跨服务器广播。  
- 当 WebSocket 服务关闭时，操作跳过。

### 参数
- `event` {string} - 要广播的事件名称。
- `data` {Object} - 要广播的消息数据。
- `localOnly` {boolean} [可选] - 是否只广播到本地，默认值为 `false`。

### 返回值
- `void`

---

## joinRoom(roomNamespace, roomId, socketId)

### 描述  
将指定的 socketId 添加到特定房间，管理本地成员关系，并通过 Redis 订阅房间命令空间。

- 参数 `roomNamespace` 用于定义房间的粒度和类别，开发者可以自由控制命名规则，例如使用类似 `app:chat:game:hot` 的层级命名来表示不同层级或类型的房间。  
- **注意：** 为了确保本地服务器中该房间的客户端能够接收消息，服务器 **必须订阅** 对应的 `roomNamespace` Redis 频道。  
- 建议开发者在适配器构造函数的 `presetRoomNamespaces` 中预先订阅这些频道，或依赖本方法内置的自动订阅逻辑。  
- 订阅操作内部会检查，避免重复订阅。

### 参数  
- `roomNamespace` {string} - 房间命名空间，控制房间类别和粒度，如 `app:chat`、`game:hot` 等，命名结构由开发者自由定义。**必须订阅此频道，本地客户端才能接收消息。**  
- `roomId` {string} - 房间在命名空间下的唯一标识符。  
- `socketId` {string} - 需要加入房间的玩家 socketId。

### 返回值  
- `void`

---

## leaveRoom(roomNamespace, roomId, socketId)

### 描述  
将指定的 socketId 从特定房间移除，并更新本地成员数据结构。

- `roomNamespace` 是房间的命名空间。  
- 当命名空间下的某个房间为空时，该房间将被删除。  
- 当该命名空间下不再有任何房间时，命名空间也会被删除。  
- 服务器会根据适配器构造函数中的 `autoUnsubscribe` 配置，决定是否自动取消订阅对应的 Redis 频道，从而减少不必要的消息接收。  
- 同时更新本地 socketId 到房间的映射关系，保持内部状态一致。

### 参数  
- `roomNamespace` {string} - 要移除 socketId 的房间命名空间。  
- `roomId` {string} - 要退出的房间唯一标识符。  
- `socketId` {string} - 退出房间的玩家 socketId。

### 返回值  
- `void`


---

## removeRoom(roomNamespace, roomId)

### 描述
彻底删除指定房间，并清理所有与该房间相关的 socketId 映射。

该方法会：  
- 从指定房间移除所有连接的 socketId。  
- 清理每个 socketId 在对应 roomNamespace 下的房间映射。  
- 删除全局房间映射中的该房间记录。  
- 如果移除后该 roomNamespace 为空，也会将其删除。

**注意：**  
- 当你想彻底删除房间及其相关引用时使用本方法。

### 参数
- `roomNamespace {string}`：房间命名空间（类型/类别）。  
- `roomId {string}`：要删除的房间唯一标识。

### 返回值
- `void`

---

## getSocketCountInRoom(roomNamespace, roomId, options)

### 描述
获取指定房间或房间类型（命名空间）中的用户数量。

- 如果提供了 `roomId`，则统计该房间内的用户数量。  
- 如果未提供 `roomId`，则统计该命名空间下所有房间的用户总数。  
- 支持精确匹配和模糊匹配（根据 roomId 前缀）。

### 参数
- `roomNamespace {string}`：房间命名空间（如 'chat'、'gameRoom'）。  
- `roomId {string} [可选]`：指定的房间 ID。  
- `options {Object} [可选]`：匹配选项。  
  - `exactMatch {boolean} [默认 true]`：是否进行精确匹配（true）或模糊匹配（false，前缀匹配）。

### 返回值
- `number`：匹配房间内的用户数量。

---

## getRoomSocketIds(roomNamespace, roomId, options)

### 描述
获取指定房间类型（命名空间）下所有匹配房间的 socketId 集合。

- 如果提供了 `roomId`，则返回精确或模糊匹配房间内的所有 socketId。  
- 如果未提供 `roomId`，则返回该命名空间下所有房间的所有 socketId。

### 参数
- `roomNamespace {string}`：要查询的房间类型名称。  
- `roomId {string|null} [可选]`：过滤用的房间 ID。  
- `options {Object} [可选]`：配置选项。  
  - `exactMatch {boolean} [默认 true]`：是否使用精确匹配或模糊匹配。

### 返回值
- `Set<string>`：匹配房间内的所有 socketId 集合。

---

## getJoinedRooms(socketId, roomNamespace)

### 描述
获取指定 socketId 加入的房间列表，可按房间命名空间前缀过滤。

- 返回一个 Map，键为房间命名空间，值为该命名空间下的房间ID集合。  
- 如果提供 `roomNamespace`，则只返回命名空间以该前缀开头的房间。

### 参数
- `socketId {string}`：要查询的 socketId。  
- `roomNamespace {string|null} [可选]`：房间命名空间前缀，默认 null 表示不过滤。

### 返回值
- `Map<string, Set<string>>`：socketId 加入的房间命名空间与对应房间ID集合的映射。

---

## isJoinedRoom(socketId, roomNamespace, roomId)

### 描述
判断指定 socketId 是否加入了某个房间或某种房间类型。

- 如果提供了 `roomId`，则判断是否加入了该具体房间。  
- 如果未提供 `roomId`，则判断是否加入了该命名空间下任意房间。

### 参数
- `socketId {string}`：要检测的 socketId。  
- `roomNamespace {string}`：房间命名空间。  
- `roomId {string} [可选]`：具体的房间 ID（可选）。

### 返回值
- `boolean`：如果加入了对应的房间或命名空间返回 `true`，否则返回 `false`。

---

## getRoomCount(roomNamespace, options)

### 描述
获取指定命名空间下的房间数量。

- 如果 `options.exactMatch` 为 `true`，则只统计与 `roomNamespace` 完全匹配的房间数量。  
- 如果为 `false`，则统计所有以 `roomNamespace` 开头的命名空间下的房间数量。

### 参数
- `roomNamespace {string}`：房间命名空间前缀。  
- `options {object}`：匹配选项。  
  - `exactMatch {boolean}`：是否进行精确匹配，默认 `true`。

### 返回值
- `{number}`：匹配到的房间数量。

---

## getRoomIds(roomNamespace, options)

### 描述
获取指定命名空间下的房间 ID 列表。

- 如果 `options.exactMatch` 为 `true`，则只返回与 `roomNamespace` 完全匹配的房间 ID。  
- 如果为 `false`，则返回所有以 `roomNamespace` 开头的命名空间下的房间 ID。

### 参数
- `roomNamespace {string}`：房间命名空间前缀。  
- `options {object}`：匹配选项。  
  - `exactMatch {boolean}`：是否进行精确匹配，默认 `true`。

### 返回值
- `{string[]}`：符合条件的房间 ID 数组。

---

## setUserSocket(socketId, socket)

### 描述
添加用户 socket 映射关系。

**重要说明：**  
客户端消息发送主要依赖于 `socketId` 到 `socket` 的映射关系。  
请务必在 WebSocket 连接建立或协议升级完成后，完成用户鉴权，然后调用此方法设置用户 `socketId` 与 `socket` 实例的映射。  
相应地，当客户端断开连接时，应及时调用移除映射的方法，清理对应的 `socketId` 到 `socket` 的映射实例，避免资源泄漏和状态混乱。  

`socketId` 必须是字符串类型，并且在所有服务器节点中唯一，比如用户的唯一 ID。  
由于适配器内部使用 `Set()` 存储 socketId 映射，即使数值相同的数字类型 socketId 也会被视作不同键，导致重复和错误。  
因此，如果使用数字类型 ID，必须先转换成字符串再传入，以保证映射的唯一性和正确性。
**本类中所有的 socketId 都遵循此约定。**

### 参数
- `socketId {string}`：用户的 socket ID（不能为空字符串）。
- `socket {Object}`：WebSocket 连接对象。

### 返回值
- `void`

---

## removeUserSocket(socketId)

### 描述
移除用户 socket 映射，同时清理相关的房间映射关系。
该方法应在客户端断开连接时调用，以正确清除 socketId 到 socket 的映射及相关资源。
### 参数
- `socketId {string}`：用户的 socket ID（不能为空字符串）。

### 返回值
- `void`

---

## getSocketInstance(socketId)

### 描述
获取指定 socket ID 对应的 WebSocket 实例。

### 参数
- `socketId {string}`：用户的 socket ID（不能为空字符串）。

### 返回值
- `WebSocket|null`：找到返回对应 WebSocket 实例，否则返回 null。

---

## getSocketClientCount()

### 描述
获取当前服务器节点连接的客户端总数。

### 返回值
- `number`：当前客户端连接数。

---

## getServerName()

### 描述  
获取当前服务器名称。

### 参数  
无

### 返回值  
- `string`: 当前服务器名称。

---

## getWss()

### 描述  
获取 WebSocket 服务器实例。

### 参数  
无

### 返回值  
- `WebSocket.Server | null`: 返回 WebSocket 服务器实例（如果已初始化），否则返回 null。

---

### parseWsRequestParams(req, options)

### 描述  
解析 WebSocket 请求中的 URL 参数。

- 解析请求 URL 中的查询参数。  
- 支持选项控制解析行为，如参数键是否转小写，是否提取路径等。  
- **注意：** 本解析依赖客户端使用 `WebSocketConnector` 类，且按约定传入参数，否则解析结果可能不完整或不准确。

### 参数  
- `req {object}`: WebSocket 请求对象。  
- `options {object} [可选]`: 解析选项。  
  - `autoLowerCaseKeys {boolean} [默认=false]`: 是否自动将参数键转换为小写。  
  - `parsePath {boolean} [默认=true]`: 是否解析并返回请求路径。  
  - `autoRemoveLeadingSlash {boolean} [默认=true]`: 是否自动去除路径开头的斜杠。

### 返回值  
- `{object}` 解析结果对象，包含：  
  - `params {object}`: 解析后的 URL 查询参数。  
  - `path {string|null}`: 解析后的 URL 路径，去除开头斜杠（如果启用）。示例：url 如 `ws://localhost:8080/chat`，可以提取路径部分 `chat` 的值。

---

# WebSocketConnector

## constructor(options)

### 描述  
初始化 WebSocket 客户端实例，允许用户传入自定义配置项。

### 参数  
- options {Object}: 配置项对象  
  - url {string}: WebSocket 连接地址，必须以 `ws://` 或 `wss://` 开头，例如 `ws://127.0.0.1:8081`  
  - pingInterval {number}: ping 心跳的发送间隔时间，单位为毫秒，默认值为 `10000`  
  - pongTimeout {number}: 发送 ping 后等待 pong 的超时时间，默认值为 `2000` 毫秒，超时视为断连   
  - fastReconnectThreshold {number}: 快速重连最大尝试次数，默认 `3` 次  
  - fastReconnectInterval {number}: 快速重连的间隔时间，默认 `3000` 毫秒  
  - reconnectMaxInterval {number}: 最大重连间隔时间，默认 `120_000` 毫秒，即 120 秒
  - pingMsg {string}: ping 消息体内容，默认为空字符串  
  - callbackTimeout {number}: 回调或 Promise 响应的最大等待时间，默认 `5000` 毫秒  
  - repeatLimit {number|null}: 最大重连次数，默认无限制（`null` 表示无限）  
  - pendingTimeout {number}: 触发 pending 回调的等待时间，默认 `100` 毫秒，应小于 callbackTimeout   
  - customParams {Object}: 自定义额外参数对象，包含要传递的键值对

### 示例
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

### 描述  
注册一个事件监听器，当指定事件被触发时执行对应回调函数。

### 参数  
- event {string}: 要监听的事件名称  
- listener {function}: 事件触发时要执行的回调函数  
- tag {string|number} [可选]: 自定义标签，用于后续移除监听器时标识

## 返回值
- `void`

---

## once(event, listener, tag)

### 描述  
注册一个一次性事件监听器，该监听器只会在事件首次触发时执行一次，之后会被自动移除。

### 参数  
- event {string}: 要监听的事件名称  
- listener {function}: 事件首次触发时要执行的回调函数  
- tag {string|number} [可选]: 自定义标签，用于后续移除监听器时标识

## 返回值
- `void`

---

## off(event, listenerOrTag)

### 描述  
移除已注册的事件监听器，使其不再响应指定事件。

- 如果 `listenerOrTag` 是函数，则移除对应的回调函数监听器。  
- 如果 `listenerOrTag` 是字符串或数字，则移除带有对应标签的监听器。  
- 如果不传 `listenerOrTag`，则删除该事件下所有监听器。

### 参数  
- event {string}: 要移除监听器的事件名称  
- listenerOrTag {function|string|number} [可选]: 要移除的监听函数或标签

## 返回值
- `void`

---

## emit(event, data, callback, options)

### 描述  
向 WebSocket 服务器发送事件和数据，支持响应回调与“等待中”处理机制。

在发送前会检查 WebSocket 是否已连接。  
如果提供了回调函数，则会生成唯一的回调 ID 并附加到发送数据中，同时注册该回调函数。  
还可以配置可选的 pending 处理逻辑，用于响应延迟时触发等待提示。

### 参数  
- event {string}: 要发送的事件名称。  
- data {Object}: 要随事件发送的数据对象。  
- callback {function} (可选): 用于接收服务器响应的回调函数。  
- options {Object} (可选): 回调行为的附加配置项。  
  - options.callbackTimeout {number} (可选): 回调函数的超时时间（毫秒）。  
  - options.onPending {function} (可选): 当响应超出 pendingTimeout 时触发的函数。  
  - options.pendingTimeout {number} (可选): 触发 `onPending` 的等待时长（毫秒）。

## 返回值
- `void`

### 示例

  ```js
  // 向服务器发送 'say' 事件，携带消息内容，
  // 同时传入一个回调函数用于处理结果或错误，
  // 以及一个可选的 onPending 回调，用于响应延迟时的提示。

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

  // err 对象结构示例：
  // {
  //   error: 'WebSocket is not open',      // 错误描述字符串
  //   errorCode: 'WS_NOT_OPEN'              // 错误代码，用于程序判断
  // }
  // 或者：
  // {
  //   error: `Is callback timeout: ${callbackId}`,  // 回调超时错误描述
  //   errorCode: 'CALLBACK_TIMEOUT'                   // 超时错误代码
  // }
  ```
---

## emitWithPromise(event, data, options)

### 描述  
向 WebSocket 服务器发送事件数据，并返回一个 `Promise`，用于处理响应或错误信息。

如果连接正常，会生成唯一的 `callbackId` 并注册回调后发送事件。  
支持响应超时控制及“等待中”处理逻辑。  
若连接不可用，`Promise` 会立即返回错误结果。

### 参数  
- event {string}: 要发送的事件名称。  
- data {Object}: 事件携带的数据对象。  
- options {Object} (可选): 附加配置项。  
  - options.onPending {function} (可选): 如果响应延迟，超时前触发的等待处理函数。  
  - options.pendingTimeout {number} (可选): 等待多久触发 `onPending`（单位：毫秒）。  
  - options.callbackTimeout {number} (可选): 响应的超时时间（单位：毫秒）。

### 返回值  
- `Promise<Object>`: 返回一个 Promise，解析为响应数据或错误信息。

### 示例

  ```js
  // 向服务器发送 'say' 事件，附带消息数据，
  // 并使用 Promise 方式接收结果，支持响应延迟提示回调 onPending。

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

 
  // 使用 async/await 向服务器发送 'say' 事件，带消息数据和延迟提示回调，
  // 错误不会抛出异常，而是通过 result.success 为 false 表示。

  const result = await client.emitWithPromise('say', { msg: 'Hi server' }, {
    onPending: () => {
      // 请求响应较慢时的处理逻辑，例如提示“请求中...”
      console.log('requesting...');
    }
  });

  if (result.success) {
    // 成功响应处理
    console.log('Received response:', result.data);
  } else {
    // 失败响应处理（非异常，业务失败），例如超时或其他错误
    console.error('Received error:', result.error, result.errorCode);
  }

  // errorCode：错误代码，用于标识错误类型，错误代码包括但不限于以下几种：
  // - 'WS_NOT_OPEN'      表示 WebSocket 连接未打开。
  // - 'CALLBACK_TIMEOUT' 表示回调超时，未收到响应。
  // error：对应的错误描述字符串，用于调试和日志记录。

  ```

---

## reconnect(repeatReset)

### 描述  
手动启动 WebSocket 重连流程。

### 参数  
- repeatReset {boolean} (optional): 是否在重连前重置当前重连次数，默认为false

## 返回值
- `void`

---


## reconnecting()

### 描述  
判断当前 WebSocket 是否处于自动重连中。

该方法通过检查内部重连计数器 `repeat`，若其值大于 0，则表示正在尝试自动重连。

### 参数  
无参数

### 返回值  
- `boolean`: 若 WebSocket 正在重连，则返回 `true`；否则返回 `false`。

---

## setPingInterval(newInterval, immediate)

### 描述  
动态设置 WebSocket 连接的心跳 ping 间隔。  
可根据应用场景实时调整心跳频率，例如在用户停留的浏览页面中降低频率，在交互频繁的页面中提高频率。

如果 `immediate` 为 `true` 且连接处于活动状态，将立即清除当前的定时器并使用新的间隔重启心跳机制。

### 参数  
- `newInterval` {number}: 新的 ping 间隔时间（毫秒），必须为正数。
- `immediate` {boolean}（可选）：是否立即生效，默认为 `false`。为 `true` 时会立刻重置心跳计时器。

### 返回值  
- `void`

---

## getPingInterval()

### 描述  
获取当前 WebSocket 连接的心跳 ping 间隔时间（单位：毫秒）。  
此方法用于查看当前配置的心跳周期，可用于调试或动态判断是否需要调整。

### 参数  
无

### 返回值  
- `number`: 当前配置的 ping 间隔时间（毫秒）

---

## manualClose()

### 描述  
手动关闭 WebSocket 连接，并禁用自动重连机制。

该方法会禁用自动重连，清除心跳定时器，并释放 WebSocket 事件引用，有助于加快垃圾回收。

### 参数  
无参数

## 返回值
- `void`

---

# Events

---
## open
- 连接成功的时候触发  
- 回调参数(event)  
---
## close
  - 当 WebSocket 连接关闭时触发。
  - 回调参数(event) （包含断开连接的 code 和 reason 详情）

    ### 重要说明 ⚠️
    客户端在收到 close 事件后**不会自动重连**。  
    这是因为很多场景下，比如服务器强制踢下线客户端，自动重连是不合适的。  
    如需重连，请根据你的业务逻辑，主动调用 `reconnect()`。

    ### WebSocket 关闭码使用规范

    请**不要使用 WebSocket 协议本身保留的关闭码**。  
    详细请参见 [MDN WebSocket CloseEvent 状态码](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code)。

    ### 自定义关闭码（≥ 4000）

    4000 及以上的代码保留给应用层自定义使用。

    我们的 `WebSocketConnector` 类已经定义了以下内部保留码：

    | 代码   | 含义                        |
    |--------|-----------------------------|
    | 4001   | 客户端手动关闭              |
    | 4002   | Pong 超时（心跳丢失）       |

    你可以从 4010 开始使用其他自定义关闭码，例如：

    | 代码   | 含义                        |
    |--------|-----------------------------|
    | 4010   | 强制登出                    |
    | 4011   | 认证失败                    |
    | 4012   | 异地登录被踢                |

    ### 总结

    - **不要使用 WebSocket 标准关闭码（< 4000）。**  
    - **请尊重客户端 SDK 保留的 4001 和 4002 代码。**  
    - 使用 ≥ 4010 的代码作为你的自定义关闭码以避免冲突。

    ### 示例
    ```js
    client.on('close', (event) => {
      console.log(`客户端关闭连接`, event.code, event.reason);

      // 以下情况不应重连：
      // 4001: 客户端手动关闭
      // 4010, 4011, 4012: 强制登出、认证失败、异地登录被踢
      if (
        event.code === 4001 ||
        event.code === 4010 ||
        event.code === 4011 ||
        event.code === 4012
      ) {
        console.log('连接被手动关闭或因强制登出/认证失败等原因关闭，不进行重连。');
        // 可在此处理清理或界面提示
      } else {
        // 其他情况（如 pong 超时 4002）尝试重连
        console.log('尝试重新连接...');
        client.reconnect();
      }
    });

    // 示例：服务器端关闭客户端连接时可以这样传入 code 和 reason
    // socket.close(4010, '强制登出');
    // 客户端将在 close 事件中获得该关闭码和原因，进行相应处理。
    ```
---
## error
  - 连接出错的时候触发  
  - 回调参数(event)  
  - 默认将会触发自动重连（除非显式调用 `manualClose` 关闭连接）
---
## message
- 接收到消息的时候触发  
- 回调参数(data)  
---
## ping
- 发起 ping 的时候触发  
- 无回调参数  
---
## pong
- 接收到服务器 pong 消息的时候触发  
- 回调参数(speed)，返回上一次 ping 距离现在的时间值（毫秒），用于测量网速 

  ### 示例
    ```js
    // 监听 pong 事件，获取服务器响应的延迟时间（单位：毫秒）
    // 这个延迟可以用来显示玩家的连接状态或网速信号强弱，非常实用。
    client.on('pong', (speed) => { 
      console.log(`Network latency: ${speed} ms`);
    })
    ```
---
## repeat-limit
- 达到最大重连次数的时候触发  
- 回调参数(repeatLimit)，最大重连次数  
---
## reconnect
- 准备重连的时候触发  
- 回调参数({repeat，timeout})，repeat 是当前的重连次数，timeout 是多久后真正发起重连（毫秒）  
---
## pong-timeout
- 发起 ping 之后在设定时间内没有收到服务器 pong 消息时触发  
- 无回调参数  
