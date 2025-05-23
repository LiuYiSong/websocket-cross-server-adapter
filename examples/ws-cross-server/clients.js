// clients.js
// const { WebSocketConnector } = require('websocket-cross-server-adapter');
const WebSocketConnector = require('../../src/WebSocketConnector');

const totalClients = 50;

const basePort = 9000;
const portRange = 5;

// 随机决定要发送加入房间消息的客户端数量
// Randomly determine the number of clients that will send join room requests
const joinRoomCount = 10; 
const joinRoomClientIds = new Set();

// 随机挑选10个客户端id
// Randomly select 10 client IDs
while (joinRoomClientIds.size < joinRoomCount) {
  joinRoomClientIds.add(Math.floor(Math.random() * totalClients) + 1);
}

// 预定义一些房间ID
// Predefine some room IDs
const roomIds = ['1000', '1001', '1002'];

// 模拟多个客户端加入不同的ws服务器
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
    // 如果这个客户端在随机加入列表里，发送加入房间消息
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
    console.log(`[Client ${id},port:${port}] on Close event:`, event.code, event.reason);
  })

  client.on('say', (data) => {
    console.log(`[Client ${id},port:${port}] Received say:`, data);
  });

}
