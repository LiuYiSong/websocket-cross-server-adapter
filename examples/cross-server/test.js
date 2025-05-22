
const WebSocketCrossServerAdapter = require('../../src/WebSocketCrossServerAdapter');

const testServer = new WebSocketCrossServerAdapter({
  serverName: 'testServer'
});

testServer.joinRoom('chat', '100', 'user1');
testServer.joinRoom('chat', '101', 'user2');
testServer.joinRoom('chat', '104', 'user2');
testServer.joinRoom('chat', '100', 'user3');
testServer.joinRoom('chat', '100', 'user4');

testServer.joinRoom('game', '200', 'user4');
testServer.joinRoom('game', '201', 'user5');
testServer.joinRoom('game', '201', 'user6');
testServer.joinRoom('game', '221', 'user6');

testServer.joinRoom('group', '301', 'user6');
testServer.joinRoom('group', '301', 'user2');
testServer.joinRoom('group', '302', 'user1');

console.log(testServer.isJoinedRoom('user9', 'chat'));

console.log(testServer.rooms)

console.log(testServer.socketRooms)

//testServer.removeRoom('chat', '101');

console.log(testServer.isJoinedRoom('user2', 'chat', '101'));

console.log(testServer.getJoinedRooms('user2'))

// console.log(testServer.getRoomCount('g', { exactMatch: false }));

console.log(testServer.getRoomCount('game', { exactMatch: true }));

console.log(testServer.getRoomIds('g', { exactMatch: false }));

// testServer.leaveRoom('game', '221', 'user6');
console.log(testServer.getSocketCountInRoom('game', '22', { exactMatch: false }))

console.log(testServer.getRoomSocketIds('game', '20', { exactMatch: false }))

console.log(testServer._generateCrossServerCallbackId());