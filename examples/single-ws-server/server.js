// 如果你不是在示例文件夹下运行，请将 require 地址换成包名：
// If you're not running this in the example folder, replace the require path with the package name:
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

// 默认的配置端口
// Default value (if no command-line argument is specified)
let port = 9000;

// 解析命令行参数，可以在node命令行加上以下参数，动态配置prot，例如：node server --port=9001
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
  // 使用端口 作为 WebSocket 服务器端口
  // Use port as the WebSocket server port
  wsOptions: {
    port
  }
});

wsServer.onWebSocketEvent('connection', (socket, req) => {
  console.log('Client connection');

  // 使用 WebSocketCrossServerAdapter 的辅助方法 parseWsRequestParams 解析 req 对象，
  // 获取客户端通过 WebSocketConnector 类创建连接时配置的参数信息。
  // Use the helper method parseWsRequestParams to parse the req object,
  // which contains the parameters passed by the client when connecting via WebSocketConnector.
  const data = wsServer.parseWsRequestParams(req);

  console.log('Connection params：', data);

  // ✅ 使用客户端传来的 id 建立映射。实际业务中应在此处进行完整的身份验证（如 token 鉴权）。
  // In a real application, user authentication (e.g., token verification) should be performed here before mapping the ID.

  // 例如可使用 jsonwebtoken 模块校验 token，并根据验证结果决定是否继续。
  // For example, use the jsonwebtoken module to verify token, and proceed only if valid.

  // 然而，我们更推荐在 noServer 模式下，在 WebSocket 协议升级阶段就完成鉴权逻辑，效率更高、也更安全。
  // However, it's recommended to handle authentication during the WebSocket upgrade phase when using noServer mode,
  // which is more secure and efficient.

  // ws 官方虽然提供了 verifyClient 参数用于连接时鉴权，但该 API 已不推荐使用，并可能在未来版本中移除。
  // Although the `verifyClient` option is still available in the `ws` module for authentication,
  // it is deprecated and may be removed in future releases.

  // 👉 建议查阅 ws 官方文档中的 noServer 模式以及 `server.on('upgrade')` 相关用法，了解推荐的鉴权方式。
  // See the official ws documentation on noServer mode and `server.on('upgrade')` handling for recommended practices.

  
  if (data.params.id) {
    const playerId = String(data.params.id);
    console.log('The client’s ID is：' + playerId);
    // 把 id 存储到 socket.playerId 中。具体存法请根据自身业务决定，
    // 比如 socket.player = { playerId, name } 等等。
    // 总之需确保能从 socket 上获取到该连接的唯一身份标识。
    // Store the id in socket.playerId (or other business-specific fields, such as socket.player = { playerId, name }).
    // Just ensure that each socket can be uniquely identified.
    socket.playerId = playerId;

    // 必须建立 id（必须为字符串类型）与 socket 实例的映射，
    // 后续房间广播、单点、多点推送才能找到对应实例。
    // It's crucial to map the string-type ID to the socket instance,
    // otherwise broadcast, unicast, and multicast features won't function correctly.
    wsServer.setUserSocket(playerId, socket);

  } else {
    // 模拟鉴权失败，使用自定义关闭码（4011）关闭连接。
    // 这里的代码应根据自身业务逻辑定义。
    // 详细查看 API 客户端关于 close 事件部分解释。
    // Simulate authentication failure and close the connection with a custom close code (4011).
    // This code should be defined per your business logic.
    // See the API client documentation for details on the `close` event.
    socket.close(4011, 'Auth failure');
  }
});

wsServer.onWebSocketEvent('close', (socket, req) => {
  console.log('Client disconnected，id:' + socket.playerId);

  if (socket.playerId) {
    // 客户端断开连接时，请务必删除 ID 和 socket 实例的映射，
    // 否则 socket 实例可能无法被释放，导致内存泄漏。
    // When a client disconnects, make sure to remove the mapping between ID and socket,
    // or the socket instance may not be garbage collected, causing memory leaks.
    wsServer.removeUserSocket(socket.playerId);
  }
});

wsServer.onWebSocketEvent('say', (socket, data, callback) => {
  console.log(`Received 'say' event from client ${socket.playerId}:`, data);

  if (callback) {
    
    // 如果客户端使用 emit 的时候带有回调，或者使用 emitWithPromise 发送消息，
    // 此时 callback 会为有效函数，此处可调用 callback 回传结果给客户端。
    // If the client used emit with a callback, or used emitWithPromise,
    // the `callback` will be a valid function, and can be used to return data back to the client.
    callback({ msg: 'I am a callback for your say event' });
  }
});

wsServer.onWebSocketEvent('joinRoom', (socket, data, callback) => {
  console.log(`Received 'joinRoom' event from client ${socket.playerId}:`, data);
  if (socket.playerId) { 
    // 模拟加入testRoom，id为1000的房间
    // Simulate joining the testRoom with id 1000
    wsServer.joinRoom('testRoom', '1000', socket.playerId);
  }
  if (callback) {
    callback({ msg: 'JoinRoom successfully' });
  }
});

// 模拟定时发送广播
// Simulate sending broadcast periodically
setInterval(() => { 
  wsServer.broadcast('serverSay', '999ttt');
}, 15_000)

// 模拟定时向测试房间发送消息
// Simulate sending messages periodically to the test room
setInterval(() => { 
  wsServer.broadcastToRoom('testRoom', '1000', 'roomSay', { msg: 'This is a message sent to the test room' });
},10_000)