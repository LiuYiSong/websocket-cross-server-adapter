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
// Register cross-server event listener
crossServer.onCrossServerEvent('say', (data, callback) => {
  console.log('Received "say" event from another server:');
  console.log(data);
  if (callback) {
     callback({ msg: `Hi, this is server ${crossServer.getServerName()} responding to you` })
  }
})

// 发送say事件消息，不需要任何回调
// Sending a "say" event message without expecting any callback
setTimeout(() => {
  crossServer.emitCrossServer('say', {
   content: `Hi everyone, I am ${crossServer.getServerName()}`
  },null, {
    targetServer: [],
  })
}, 3000);

// 以callback的方式发送say事件消息，需要目标服务器回调
// Send a "say" event message with a callback, expecting a response from the target server
setTimeout(() => {
  // 每当接收到一个服务器响应都会执行一次回调函数
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

// 以Promise的方式发送say事件消息，需要目标服务器回调
// Send a "say" event message using a Promise, expecting a response from the target server
setTimeout(async () => {

  // Promise 会在所有预期响应（expectedResponses）全部完成后解决（resolved），如果超时未收到全部响应，也会解决，但此时 result.success 为 false。
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

  // 也可以使用then的方式
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
