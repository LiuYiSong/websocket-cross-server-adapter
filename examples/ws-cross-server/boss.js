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





