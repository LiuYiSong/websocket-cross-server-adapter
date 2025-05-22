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

// node wsserver --name=serverA --port=9001
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
