import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// import WebSocketCrossServerAdapter from './src/WebSocketCrossServerAdapter.js';
// import WebSocketConnector from './src/WebSocketConnector.js';

const WebSocketCrossServerAdapter = require('./src/WebSocketCrossServerAdapter.js');
const WebSocketConnector = require('./src/WebSocketConnector.js');

export { WebSocketCrossServerAdapter, WebSocketConnector };
export default WebSocketCrossServerAdapter;


