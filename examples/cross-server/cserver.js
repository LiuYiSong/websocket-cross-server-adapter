// cserver.js
// const { WebSocketCrossServerAdapter } = require('websocket-cross-server-adapter');
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

// 填入你的 Redis 配置信息，支持多个实例，请确保 Redis 服务已启动
// 支持多个 Redis 节点，如果使用多个节点，则每次发布会根据设置的策略选择其中的一个节点进行发布，
// 从而实现“负载均衡”。不同的策略含义请参考 API 文档。
// 内部会维护各个节点的健康状态。
// 重要提示：至少需要提供一个 Redis 节点，跨服务通信才能正常工作。
// Fill in your Redis configuration info, supports multiple instances.
// Make sure the Redis service is already running.
// Supports multiple Redis nodes. If multiple nodes are used, each publish operation will select one node
// based on the configured strategy to achieve "load balancing". For different strategies, please refer to the API documentation.
// The health status of each node is maintained internally.
// Important: At least one Redis node must be provided for cross-service communication to work properly.
const redisConfig = [
  { port: 6379, host: '127.0.0.1' },
  //{ port: 6380, host: '127.0.0.1' },
  // 可以添加更多节点
  // You can add more nodes
];

// 请务必确保启动多个服务器时，每个服务器的名称都唯一，避免冲突
// Be sure to assign a unique name to each server instance when starting multiple servers to avoid conflicts
let serverName = 'serverA';

// 解析命令行参数，可以在node命令行加上以下参数，动态配置serverName，例如：node cserver --name=serverA
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
  // 注册监听redis节点的健康状态的事件函数，当健康状态发生变化的时候将触发
  // info对象包含信息：
  // Register an event listener to monitor the health status of Redis nodes.
  // This function will be triggered whenever the health status of any Redis node changes.
  // The `info` object contains the following information:
  // {
  // host， Redis 节点主机地址 (Redis node host)
  // port， Redis 节点端口号 (Redis node port)
  // serverName，当前服务器的名称 (Current server name)
  // event， 触发的事件名，如 connect、error 等 (Triggered event name, e.g., connect, error)
  // isHealthy， 当前 Redis 节点是否健康 (Whether this Redis node is healthy)
  // error， 如果发生错误，则为错误信息 (Error message if any)
  // healthySubscriberCount， 当前健康的订阅者数量 (Number of healthy subscriber instances)
  // healthyPublisherCount， 当前健康的发布者数量 (Number of healthy publisher instances)
  // totalNodeCount， Redis 实例总数（发布 + 订阅）(Total number of Redis nodes, both publisher and subscriber)
  // typeRedis， 实例类型：发布者或订阅者 (Redis instance type: publisher or subscriber)
  //};
  onRedisHealthChange: (health, info) => {
    console.log(`Node health status changed:${health}`, info);
  },
  // 当频道订阅发生错误的时候触发，info对象包含：
  // {
  // host - Redis 实例的主机地址 / Host address of the Redis instance
  // port - Redis 实例的端口号 / Port number of the Redis instance
  // serverName - 当前服务器名称 / Name of the current server
  // channel - 订阅失败的频道名称 / Name of the Redis channel that failed subscription
  // event - 触发事件名，如 "subscribe" 或 "unsubscribe" / Event that triggered the subscription action, e.g. "subscribe" or "unsubscribe"
  // error - 错误信息，订阅失败的具体错误消息 / Error message describing the subscription failure
  // }
  onRedisSubscriptionError: (info) => { 
    console.log('onRedisSubscriptionError:', info);
  }
});


// 注册跨服务器事件监听
// Register cross-server event listener
crossServer.onCrossServerEvent('say', (data, callback) => {
  // 真实的发送数据可以通过data.message属性获取
  // The actual sent data can be accessed via the data.message property
  console.log('Received "say" event from another server:', data);
 
  // 如果发送方通过 callback 或 Promise 方式发送消息，则此时 callback 为有效函数，可以直接调用以回调响应结果
  // If the sender uses callback or Promise to send the message, then callback is a valid function and can be called directly to respond
  if (callback) {
    callback({ msg: `Hi, this is server ${crossServer.getServerName()} responding to you` })
  }
})


