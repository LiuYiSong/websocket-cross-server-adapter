
// const { WebSocketConnector } = require('websocket-cross-server-adapter');
const WebSocketConnector = require('../../src/WebSocketConnector');

// 默认的配置端口和客户端id
// Default value (if no command-line argument is specified)
let port = 9000;
let id = 1;

// 解析命令行参数，可以在node命令行加上以下参数，动态配置prot和id，例如：node client --id=16 --port=9001
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
  /**
   * 自定义参数（customParams）
   * 
   * 为了保证在各种平台（浏览器、Node.js、React Native 等）上的兼容性，
   * 这些自定义参数将统一组装到 WebSocket 连接的 URL 查询字符串中传递，
   * 
   * Custom Parameters (customParams)
   * 
   * To ensure compatibility across different platforms (browser, Node.js, React Native, etc.),
   * these custom parameters are uniformly appended as query parameters to the WebSocket connection URL,
   */
  customParams: {
    name: 'Sam',
    id
  },
  // 可以通过关闭服务器端来测试以下不同参数设置时候的重连效果
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
    // 手动断开连接或服务器在特定情况下强制注销 — 不应尝试重连
    // Manual disconnect or forced logout by server under certain conditions — should not attempt to reconnect
    console.log('Connection closed manually or by forced logout/auth failure. No reconnection.');
    
    // 虽然连接已关闭，但仍需禁止自动重连，并清理所有计时器和 WebSocket 实例等资源。
    // Manually close the connection, forbid automatic reconnection, and clear all timers and WebSocket instances.
    client.manualClose();
  } else {
    // 其他情况下，应手动触发重连
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
  // 在pong事件中可以测得当前网络延迟
  // You can measure current network latency in the pong event
  console.log(`Network latency: ${speed} ms`);
})


setTimeout(async () => {
  // 使用 Promise 方式发送带有回调的事件
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
  // 使用 callback 方式发送带有回调的事件
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
  // 模拟加入测试房间
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

