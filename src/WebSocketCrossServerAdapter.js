/**
 * Copyright (c) 2025 LiuYiSong
 * Email: 349233775@qq.com
 * https://github.com/LiuYiSong/websocket-cross-server-adapter
 * All rights reserved.
 * 
 * WebSocketCrossServerAdapter Class
 * 
 * A communication adapter designed for distributed systems, supporting WebSocket services and cross-server event broadcasting, message delivery, and room management.
 * Suitable for game servers, real-time applications, microservice communication, etc., helping to build a high-performance, loosely coupled, and scalable distributed architecture.
 * 
 */

'use strict';
const debug = require("debug")("WSCSA");  
const notepack = require('notepack.io');
const Redis = require('ioredis');
const WebSocket = require('ws');

class WebSocketCrossServerAdapter {
    /**
     * WebSocketCrossServerAdapter constructor
     * 
     * @param {Object} options - Configuration options
     * @param {string} [options.serverName] - A **globally unique identifier** for the current server node.
     *        This value is **required** for correct cross-server communication.
     *        It must be consistent and unique across all running servers, such as `"us-east-1-node3"` or `"game-server-42"`.
     *        Do **NOT** use `process.pid` or other machine-local identifiers, as they may collide in a distributed setup.
     * @param {string} [options.bridgePrefix='csbp:'] - Cross-server bridge prefix
     * @param {string} [options.wsPrefix='ws:'] - WebSocket channel prefix
     * @param {Object} [options.wsOptions] - Full WebSocket.Server configuration.
     *        This object will be passed directly into the `ws` library's constructor.
     *        See: https://github.com/websockets/ws?tab=readme-ov-file#server-options
     * @param {number} [options.serverPingInterval=20000] - WebSocket ping interval
     * @param {number} [options.enterBackgroundCloseTime=10000] - Close delay after background
     * @param {string} [options.heartbeatStr=''] - Heartbeat string
     * @param {boolean} [options.redisForcePing=true] - Whether to force-enable Redis ping health monitoring
     * @param {number} [options.redisPingInterval=5000] - Redis ping interval
     * @param {number} [options.redisPingTimeout=2000] - Redis ping timeout
     * @param {string} [options.selectionStrategy='fastest'] - Redis node selection strategy {random, round-robin, fastest}
     * @param {boolean} [options.enableRedisDataCompression=true] - Whether to enable Redis data compression
     * @param {function} [options.onRedisHealthChange] - Callback function triggered when Redis health status changes.
     * @param {function} [options.onRedisSubscriptionError] - Callback function triggered when Redis subscription fails.
     * @param {Array<string>} [options.presetRoomNamespaces=[]] - Predefined WebSocket room namespace
     * @param {boolean} [options.autoUnsubscribe=true] - Whether to automatically unsubscribe from a room namespace's Redis channel when no clients remain in that namespace.  
     *                                                    This only applies to non-predefined (non-preset) room namespaces.  
     *                                                    Predefined rooms listed in `presetRoomNamespaces` are not affected and remain subscribed.
     * @param {Array<string>|string} [options.customChannels] - Custom channels
     * @param {Array<Object>} [options.redisConfig=[]] - Redis node configuration
     */
    constructor(options = {}) {
        // Initialize base configuration
        
        // Server identifier for cross-server communication.
        // Must be globally unique across all nodes (e.g., "us-east-1-node3"), do NOT use process.pid.
        this.serverName = options.serverName; // Current server name
        this.bridgePrefix = options.bridgePrefix || 'csbp:'; // Cross-server bridge prefix
        this.wsPrefix = options.wsPrefix || 'ws:'; // WebSocket channel prefix
        
        // The two prefixes must not be the same to avoid channel conflicts
        if (this.bridgePrefix === this.wsPrefix) {
            throw new Error(`bridgePrefix and wsPrefix must be different to avoid channel conflicts. Received: "${this.bridgePrefix}"`);
        }
        // Check if wsOptions is provided and is of type object
        if (options.wsOptions && typeof options.wsOptions === 'object') {
            this.wsOptions = options.wsOptions; // Set wsOptions if valid
        } else {
            this.wsOptions = null; // Set to null if not provided or invalid
        }
        // Set enableWebSocket based on wsOptions
        this.enableWebSocket = this.wsOptions !== null; // If wsOptions exists, enable WebSocket; otherwise, disable it
        this.serverPingInterval = options.serverPingInterval || 20000; // WebSocket ping interval
        this.enterBackgroundCloseTime = options.enterBackgroundCloseTime || 10000; // Close delay after background
        this.heartbeatStr = options.heartbeatStr || ''; // Heartbeat string

        // Redis related settings
        this.redisForcePing = options.redisForcePing !== undefined ? options.redisForcePing : true; // Whether to force-enable Redis ping health monitoring
        this.redisPingInterval = options.redisPingInterval || 5000; // Redis ping interval
        this.redisPingTimeout = options.redisPingTimeout || 2000; // Redis ping timeout
        this.selectionStrategy = options.selectionStrategy || 'random'; // Redis node selection strategy {random, round-robin, fastest}
        this.enableRedisDataCompression = options.enableRedisDataCompression !== undefined ? options.enableRedisDataCompression : true; // Whether to enable Redis data compression
        this.onRedisHealthChange = options.onRedisHealthChange; // Callback triggered when the health status of a Redis node changes (e.g. up/down)
        this.onRedisSubscriptionError = options.onRedisSubscriptionError;// Callback triggered when subscription or unsubscription to a Redis channel fails

        // Prepare Redis channels
        this.serverBridgeChannel = this.bridgePrefix + 'server_bridge'; // Server bridge channel
        this.redisChannels = new Set(); // Initialize channel list
        this.redisChannels.add(this.serverBridgeChannel);

        if (this.enableWebSocket) {
    
            // Add preset WebSocket room channels from configuration to the channel set.
            const wsChannels = this._prefixWsChannels(options.presetRoomNamespaces || []);
            wsChannels.forEach(ch => this.redisChannels.add(ch))
            // Add WebSocket private and broadcast channels
            this.privateChannel = this.wsPrefix + 'private_socket';
            this.broadcastChannel = this.wsPrefix + 'broadcast';
            this.redisChannels.add(this.privateChannel);
            this.redisChannels.add(this.broadcastChannel);

        }

        if (options.customChannels) {
            // Add custom channels
            const customChannels = Array.isArray(options.customChannels) ? options.customChannels : [options.customChannels];
            customChannels.forEach(channel => this.redisChannels.add(channel)); // Add custom channels to Set
        }

        this.autoUnsubscribe = options.autoUnsubscribe === undefined ? true : options.autoUnsubscribe;

        // Initialize data structures
        this.redisConfig = options.redisConfig || []; // Redis node configuration
        this.redisInstances = []; // Redis instances

        // Structure: Map<roomNamespace, Map<roomId, Set<socketId>>>
        // Used to manage all rooms under each room type and their socket members
        this.rooms = new Map();

        // Structure: Map<socketId, Map<roomNamespace, Set<roomId>>>
        // Used to track all rooms a socket has joined
        this.socketRooms = new Map();

        this.socketMap = new Map(); // Socket ID to socket mapping

        this.customChannelHandler = null; 

        this.crossServerCallback = {}; // Cross-server callbacks
        this.crossServerEventListeners = {}; // Cross-server event listeners
        this.webSocketEventListeners = {}; // WebSocket event listeners

        this.roundRobinIndex = 0; // Round-robin index for Redis node selection

        // Determine whether to enable cross-server communication based on redisConfig
        // If redisConfig exists and contains at least one node, enable cross-service features
        // Otherwise, operate as a standalone service without Redis communication
        this.enableCrossServer = this.redisConfig && this.redisConfig.length;

        // WebSocket service instance
        this.wss = null;

        // Initialize Redis service (must come first)
        if (this.enableCrossServer) {
            // When cross-server communication is enabled, a string-type serverName must be provided
            if (!this.serverName || typeof this.serverName !== 'string') {
                throw new Error("serverName must be specified for cross-server communication to work reliably.");
            }
            this._setupRedisServer();
        }

        // Initialize WebSocket service (if enabled)
        if (this.enableWebSocket) {
            this._setupWsServer();
        }

    }

    /**
     * Initialize event listeners for a Redis instance
     *
     * This method listens to connection-related events of a Redis instance
     * and updates its health status flag `isHealthy` accordingly.
     *
     * @param {Redis} redisInstance - Redis client instance
     * @returns {void} - This function does not return any value.
     */
    _setupRedisEventListeners(redisInstance) {
        // List of Redis events to listen for
        const events = ['ready', 'error', 'connect', 'close', 'reconnecting'];

        events.forEach(event => {
            redisInstance.on(event, (err) => {
                let isHealthy;
                if (event === 'error') {
                    isHealthy = false; // Mark as unhealthy on error
                    debug(`Redis error at ${redisInstance.options?.host || 'Unknown Host'}:${redisInstance.options?.port || 'Unknown Port'} - ${err.message}`);
                } else {
                    // Mark as healthy unless the event is 'close' or 'reconnecting'
                    isHealthy = !(event === 'close' || event === 'reconnecting');
                }

                // Only invoke the callback if health status changes
                if (redisInstance.isHealthy !== isHealthy) {
                    redisInstance.isHealthy = isHealthy; 
                    this._createAndTriggerHealthStatusChange(redisInstance, isHealthy, event, err);
                }

            });
        });
    }

    /**
     * Create the Redis health status information and trigger the health change callback.
     *
     * This function prepares the Redis instance health status information and calls the 
     * provided health change callback if it's available.
     *
     * @param {Redis} redisInstance - The Redis instance whose health status is being updated.
     * @param {boolean} isHealthy - The new health status for the Redis instance.
     * @param {string} event - The event that triggered the health status change.
     * @param {Object} err - The error object, if any, related to the Redis event.
     */
    _createAndTriggerHealthStatusChange(redisInstance, isHealthy, event, err) {
        // Prepare the health status information
        let redisInfo = {
            host: redisInstance.options?.host || 'Unknown Host',
            port: redisInstance.options?.port || 'Unknown Port',
            serverName: this.serverName,
            event,
            isHealthy,
            error: err ? err.message : null,
            healthySubscriberCount: this.getHealthyRedisInstancesCount('subscriber'),
            healthyPublisherCount: this.getHealthyRedisInstancesCount('publisher'),
            totalNodeCount: this.getRedisInstancesCount(),
            type: redisInstance._customType, // Add the type of the Redis instance (publisher or subscriber)
        };

        // Invoke the health change callback if provided
        if (this.onRedisHealthChange && typeof this.onRedisHealthChange === 'function') {
            this.onRedisHealthChange(isHealthy, redisInfo);
        }
    }

    /**
     * Handles Redis subscription errors and triggers the health status change callback.
     * This function is responsible for organizing error information and notifying about the status change.
     *
     * @param {Redis} redisInstance - The Redis instance that failed to subscribe.
     * @param {string} channel - The channel to which the subscription failed.
     * @param {Error} error - The error that caused the subscription failure.
     * @param {string} event - The event that triggered the subscription action (e.g., "subscribe" or "unsubscribe").
     *               This parameter helps to distinguish between subscription and unsubscription 
     */
    _handleRedisSubscriptionError(redisInstance, channel, error, event) {
        // Create the error information object
        let errorInfo = {
            host: redisInstance.options?.host || 'Unknown Host',
            port: redisInstance.options?.port || 'Unknown Port',
            serverName: this.serverName,
            channel,
            event,
            error: error.message,  
        };

        // Trigger the health status change callback if provided
        if (this.onRedisSubscriptionError && typeof this.onRedisSubscriptionError === 'function') {
            // Notify about the health change with detailed info
            this.onRedisSubscriptionError(errorInfo); 
        }

        // Log the error for further investigation
        // console.error(`Failed to ${event}  to Redis channel: ${channel} on ${redisInstance.options?.host || 'Unknown Host'}. Error: ${error.message}`);
    }

    /**
     * Initialize a Redis instance including publisher and subscriber
     *
     * This method creates Redis publisher and subscriber clients, sets up event listeners,
     * subscribes to channels, and handles incoming messages.
     *
     * @param {Object} config - Redis connection configuration
     * @returns {void} - This function does not return any value.
     */
    _initRedisInstance(config) {
        if (!config) {
            throw new Error("Redis configuration is required but missing.");
        }

        const publisher = new Redis(config); 

        // Create a new independent Redis client instance based on the configuration of the publisher
        // using the duplicate() method. The new subscriber shares the same settings but maintains
        // a separate connection to avoid mutual interference.
        const subscriber = publisher.duplicate(); 

        publisher.isHealthy = subscriber.isHealthy = false; 
        publisher.latencyTime = 0; 

        publisher._customType = 'publisher';
        subscriber._customType = 'subscriber';
        
        this._setupRedisEventListeners(publisher);
        this._setupRedisEventListeners(subscriber);

        // Subscribe to all Redis channels to receive messages from different services or WebSocket rooms
        this.redisChannels.forEach(channel => {
            subscriber.subscribe(channel, (err) => {
                if (err) {
                    //console.error(`Failed to subscribe to ${channel} channel: ${err.message}`);
                    this._handleRedisSubscriptionError(subscriber, channel, err, 'subscribe');
                }
            });
        });

        // ========================== Redis Message Subscription Logic ==========================
        //
        // Depending on whether message compression is enabled, choose different event types:
        //
        // - If compression is enabled, and a `notepack` instance is provided:
        //   Use notepack.encode() to publish binary messages, and listen to `messageBuffer` to decode.
        //
        // - If compression is not enabled:
        //   Expect JSON strings, listen to `message`, and parse using JSON.parse().
        //
        // ⚠️ Warning:
        // `ioredis` provides two events:
        //   - `message`: receives channel and message as strings
        //   - `messageBuffer`: receives both as Buffer (for binary data)
        // The event must match the publish format, or it may result in corrupted data or errors.
        // =======================================================================================
        if (this.enableRedisDataCompression) {
            subscriber.on('messageBuffer', (channel, message) => {
                try {
                    message = notepack.decode(message);
                    this._handleRedisIncomingMessage(channel.toString(), message);
                } catch (err) {
                    console.error(`Decompression failed for message on channel ${channel}. Error details:`, err);
                }
            });
        } else {
            subscriber.on('message', (channel, message) => {
                try {
                    message = JSON.parse(message);
                    this._handleRedisIncomingMessage(channel, message);
                } catch (err) {
                    console.error(`Parsing failed for message on channel ${channel}. Error details:`, err);
                }
            });
        }

        this.redisInstances.push({ publisher, subscriber });
    }

    /**
     * This function sets up the Redis server for both publisher and subscriber.
     * It establishes Redis connections, subscribes to channels, and handles incoming messages.
     *
     * @returns {void} - This function does not return any value.
     */
    _setupRedisServer() {
        // Loop through each Redis configuration and initialize the publisher and subscriber
        for (let config of this.redisConfig) {
            this._initRedisInstance(config);
        }

        // If there are multiple Redis instances, and the force ping monitoring (redisForcePing) is enabled, 
        // or the selection strategy is "fastest", then start the ping monitoring timer.
        // Periodically sends ping requests to each Redis node to measure response times, 
        // dynamically selecting the fastest node among the available ones for requests.
        if (
            this.redisInstances.length > 1 &&
            (this.redisForcePing || this.selectionStrategy === 'fastest')
        ) {
            this._startRedisPingTimer();
        }
    }

    /**
     * Starts a timer that periodically pings Redis publisher instances to check their health.
     * Pings are sent at a set interval and each ping has a timeout. If the ping response time exceeds
     * the specified timeout, the Redis instance is marked as unhealthy.
     * @returns {void} - This function does not return any value.
     */
    _startRedisPingTimer() {
        if (!this.redisPingInterval || !this.redisPingTimeout) {
            debug('Redis ping interval or timeout not configured correctly.');
            return;
        }

        // If the ping timer is already running, return
        if (this.redisPingTimer) return;

        // Set an interval to periodically check the health status of Redis nodes
        this.redisPingTimer = setInterval(() => {
            // Loop through each Redis instance
            this.redisInstances.forEach(({ publisher }) => {
                const start = Date.now(); 

                // Ping Redis node and check for timeout
                publisher.ping().then(() => {
                    const latency = Date.now() - start; 
                    publisher.latencyTime = latency; 

                    // If latency exceeds the predefined timeout value, mark the Redis node as unhealthy
                    const newHealthStatus = latency > this.redisPingTimeout ? false : true;

                    // Only update health status if it has changed
                    if (publisher.isHealthy !== newHealthStatus) {
                        publisher.isHealthy = newHealthStatus;
                        if (!publisher.isHealthy) {
                            console.error(`Redis node ping exceeded timeout: ${latency}ms`);
                        }
                        // Optionally trigger a callback for health status change
                        this._createAndTriggerHealthStatusChange(publisher, publisher.isHealthy, 'ping', null, 'publisher');
                    }
                }).catch(() => {
                    // If the ping fails, mark the Redis node as unhealthy
                    if (publisher.isHealthy !== false) {
                        publisher.isHealthy = false;
                        console.error('Ping failed for Redis node');
                        // Optionally trigger a callback for health status change
                        this._createAndTriggerHealthStatusChange(publisher, publisher.isHealthy, 'ping', null, 'publisher');
                    }
                });
            });
        }, this.redisPingInterval); 
    }

    /**
     * Sets up a WebSocket server to handle client connections and events.
     * @returns {void} - This function does not return any value.
     */
    _setupWsServer() {
        try {
            //  Unified event handler for all WebSocket events
            const handleSocketEvent = (eventName, socket, ...args) => {
                // Built-in WebSocket event handling (e.g., heartbeat management)
                switch (eventName) {
                    case 'connection':
                        socket.isAlive = true;
                        socket.__enterBackgroundTime = 0; 
                        break;
                    case 'pong':
                        socket.isAlive = true; 
                        break;
                }
    
                // Trigger user-registered event listeners
                const listeners = this.webSocketEventListeners[eventName];
                if (listeners) {
                    listeners.forEach(({ fn, once }) => {
                        try {
                            fn(socket, ...args);
                        } catch (err) {
                            console.error(`[${eventName}] Listener execution failed:`, err);
                        }
                        if (once) this.offWebSocketEvent(eventName, fn);
                    });
                }
            };
    
            // Based on wsOptions configuration, create a WebSocket server
            this.wss = new WebSocket.Server(this.wsOptions);

            // Handle new client connections
            this.wss.on('connection', (socket, req) => {

                // Register core event listeners
                const coreEvents = ['close', 'error', 'pong'];
                coreEvents.forEach(event => {
                    socket.on(event, (...args) => handleSocketEvent(event, socket, req, ...args));
                });
    
                // Listen for messages from the client
                socket.on('message', (message) => {
                    if (message === null || message === undefined) return; // Prevent handling null/undefined
                    
                    /**
                     * Supplement:
                     * Native WebSocket messages may be Buffers (binary).
                     * Use toString() to ensure consistent string processing.
                     */
                    message = message.toString(); 
    
                    if (message === this.heartbeatStr) {
                        // If it is a heartbeat message, respond
                        handleSocketEvent('client-ping', socket);
                        socket.send(this.heartbeatStr); 
                    } else {
                        // Handle business-related messages
                        this._handleWebSocketMessage(socket, message);
                    }
    
                    // Manually trigger custom 'message' event
                    handleSocketEvent('message', socket, message);
                });
    
                // Manually trigger 'connection' event
                handleSocketEvent('connection', socket, req);
            });
    
            // Server-level events
            this.wss.on('error', (err) => handleSocketEvent('server-error', err));
            this.wss.on('listening', () => handleSocketEvent('listening'));
    
            // Handle server close
            this.wss.on('close', () => {
                if (this.wsTimer) {
                    clearInterval(this.wsTimer);
                }
                handleSocketEvent('ws-server-close'); 
            });
    
            // Periodically ping clients to check connection status
            this.wsTimer = setInterval(() => {
                this.wss.clients.forEach((ws) => {
                    // Handle automatic disconnection when client goes to background
                    if (ws.__enterBackgroundTime) {
                        const pass = Date.now() - ws.__enterBackgroundTime;
                        if (pass > this.enterBackgroundCloseTime) {
                            return ws.terminate(); 
                        }
                    }
    
                    // Check if the client is alive
                    if (ws.isAlive === false) {
                        return ws.terminate(); 
                    }
    
                    // Send ping to client and wait for pong response
                    ws.isAlive = false; 
                    ws.ping();
                });
            }, this.serverPingInterval);
    
        } catch (e) {
            // WebSocket server startup failed
            throw new Error("Failed to start WebSocket server: " + e.message);
        }
    }
    
    /**
     * Handles incoming messages from Redis channels.
     * @param {string} channel - The channel the message was received from.
     * @param {Object} message - The message object received.
     * @returns {void} - This function does not return any value.
     */
    _handleRedisIncomingMessage(channel, message) {
        // Ensure all required fields are present before proceeding
        if (!channel || !message) {
            debug(`[RedisMessageHandler] Missing required fields. channel or message or message.data`);
            return;
        };

        // If the sending server and target server names are the same, it's a local message already processed,
        // so we skip further handling and exit early.
        if (message.senderServer === this.serverName || message.data?.senderServer === this.serverName) {
            debug(`Skipping message from self. senderServer: ${message.senderServer || message.data?.senderServer}, currentServer: ${this.serverName}`);
            return;
        }

        if (channel === this.serverBridgeChannel) {
            this._handleServerBridgeMessage(message);
        } else if (this._isWebSocketChannel(channel)) {
            this._handleWsRouteMessage(channel, message); 
        } else {
            if (this.customChannelHandler) this.customChannelHandler(channel, message);
        }
    }

    /**
     * Handles incoming server bridge messages by executing event listeners and callback handling.
     *
     * @param {Object} message - The parsed message content, including target server, callback ID, and other data.
     * @param {string} message.senderServer - The server name that sent the message.
     * @param {string} message.targetServer - The target server name.
     * @param {string} message.callbackId - The callback ID used to identify and handle asynchronous callbacks.
     * @param {boolean} message.isCallback - Whether it is a callback message.
     * @param {string} message.event - The event name that determines how the message will be handled.
     * @returns {void} - This function does not return any value.
     */
    _handleServerBridgeMessage(message) {
        if (!message.data || typeof message.data !== 'object') {
            throw new Error('Invalid message: "data" must exist and be of type object');
        }

        const { senderServer, targetServer, callbackId, isCallback, event } = message.data;
    
        // Handle callback messages
        if (isCallback) {

            // Skip if senderServer is invalid
            if (!senderServer) return;

            const cb = this.crossServerCallback[callbackId];

            // Skip if callback doesn't exist
            if (!cb) return;

            // If callback is a Promise, resolve it with the message data
            if (cb.resolveFunction) cb.resolveFunction(message.data);

            // If callback is a function, execute it and pass the message data
            if (cb.callbackFunction) {
                // Only decrement expectedResponses if a callbackFunction is invoked (because cb.resolveFunction already handles this)
                // Decrease the expected response count after receiving one valid response      
                cb.expectedResponses--;
                cb.callbackFunction({
                    success: true,
                    data: message.data,
                    remainingResponses: cb.expectedResponses // Indicate how many responses are still pending
                });
            }

            // Once all expected responses have been received, clear the timeout and remove the callback entry
            if (cb.expectedResponses <= 0) {
                if (cb.timeoutId) clearTimeout(cb.timeoutId);
                delete this.crossServerCallback[callbackId];
            }

            return;
        }

        // Process event listener logic for non-callback messages
        // Skip if targetServer is not an array or the current server is not in the targetServer list
        if (!Array.isArray(targetServer) || !(targetServer.length == 0 || targetServer.includes(this.serverName))) return;

        // Invoke the registered cross-server event listeners
        this._invokeCrossServerListeners(event, message.data, callbackId, senderServer);

    }

    /**
     * Handles incoming Redis channel messages by routing them to the appropriate WebSocket connections.
     * 
     * @param {string} channel - The Redis channel the message was received from.
     * @param {Object} message - The parsed message content.
     * @param {Object} message.data - The actual data of the message, containing the information to be sent.
     * @param {Array} message.socketIds - List of WebSocket connection IDs (for private channels).
     * @param {string} message.socketId - A single WebSocket connection ID (for private channels).
     * @param {string} message.roomNamespace - The room name (for messages to specific rooms).
     * @param {string} message.roomId - The room ID (for messages to specific rooms). 
     * @returns {void} - This function does not return any value.
     */
    _handleWsRouteMessage(channel, message) {
        if (!message.data || typeof message.data !== 'string') {
            throw new Error('Invalid message: "data" must exist and be of type string');
        }

        // Route messages based on the channel
        if (channel === this.privateChannel) {
            // Handle private channel messages
            if (message.socketIds) {
                // If message contains multiple socketIds, send to multiple WebSockets
                message.socketIds.forEach(socketId => {
                    if (typeof socketId === 'string' && socketId) {
                        const ws = this.socketMap.get(socketId);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(message.data);
                        }
                    }
                });
            } else if (message.socketId) {
                // If message contains a single socketId, send to one WebSocket
                if (typeof message.socketId === 'string' && message.socketId) {
                    const ws = this.socketMap.get(message.socketId);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(message.data);
                    }
                }
            }

        } else if (channel === this.broadcastChannel) {
            // Handle broadcast channel messages
            this.wss.clients.forEach((ws) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(message.data);
                }
            });
        } else {
            // Send to specific roomNamespace
            if (message.roomNamespace) {
                const sockets = this.getRoomSocketIds(message.roomNamespace, message.roomId);
                sockets.forEach(socketId => {                   
                    // Skip excluded socketIds
                    if (message.excludeSocketIds && message.excludeSocketIds.includes(socketId)) return;
                    const ws = this.socketMap.get(socketId);
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(message.data);
                    }
                });
            }
        }

    }

    /**
     * Processes the incoming WebSocket message, parses it, and triggers relevant event listeners.
     * 
     * @param {WebSocket} socket - The WebSocket client instance that received the message.
     * @param {string} message - The message received from the client.
     * @returns {void} - This function does not return any value.
     */
    _handleWebSocketMessage(socket, message) {
        // Check if socket is valid
        if (!socket) {
            debug('Invalid socket instance.');
            return;
        }

        // Check if message is a valid string
        if (typeof message !== 'string') {
            debug('Invalid message type. Message must be a string.');
            return;
        }

        
        // Attempt to parse the message, handle any parsing error
        try {
            message = JSON.parse(message);
        } catch (err) {
            console.error('Failed to parse socket message to JSON:', err);
            return;
        }

        // Check if the message has an event property
        if (!message || !message.event) {
            debug(`[_handleWebSocketMessage] Invalid message or message.event}`);
            return;
        };

        // Find relevant listeners for the event
        const listeners = this.webSocketEventListeners[message.event];
        if (!listeners) return;

        // Handle callback-based listeners
        const sendCallback = message.callbackId
            ? (data) => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        message: data,
                        callbackId: message.callbackId
                    }));
                }
            }
            : null;


        // Process each listener
        listeners.forEach(({ fn, once }) => {
            try {
                // Call the listener function and pass the sendCallback
                fn(socket, message, sendCallback);
            } catch (err) {
                // Handle listener execution failure
                console.error(`[${message.event}] Listener execution failed:`, err);
            }

            // If the listener is "once", remove it after execution
            if (once) {
                this.offWebSocketEvent(message.event, fn);
            }
        });

    }

    /**
     * Invoke registered cross-server event listeners
     *
     * @param {string} event - Event name
     * @param {object} data - Data passed with the event
     * @param {string} [callbackId] - Optional callback ID for cross-server response
     * @param {string} [targetServer] - Origin server name for replying callback
     * @returns {void}
     */
    _invokeCrossServerListeners(event, data, callbackId, targetServer) {
        // If event name is invalid or there are no listeners registered, log the debug message and return early
        if (!event || !this.crossServerEventListeners[event]) {
            debug(`_invokeCrossServerListeners: Invalid event name or no listeners registered for event: ${event}`);
            return;
        }

        // Server-to-server callback (reply to the original requesting server)
        const serverCallback = callbackId ? (callBackData) => {
            this.emitCrossServer('', {
                targetServer: [targetServer],
                callbackId,
                isCallback: true,
                message: callBackData
            });
        } : null;

        // Determine whether to automatically respond to the client
        const isClientCallback = data.message?.autoClientCallback &&
            data.message?.clientSocketId &&
            (data.message?.clientCallbackId || data.message?.data?.callbackId);

        // Check if this is a forwarded WebSocket event with player and client callbackId
        const clientCallback = isClientCallback ? (clientData) => {
            // 'cs_c_cb' event indicates a cross-server client callback
            this.toSocketId(data.message.clientSocketId, 'cs_c_cb', {
                message: clientData,
                callbackId: data.message?.clientCallbackId || data.message?.data?.callbackId,
                serverName: this.serverName,
            });
        } : null;

        // Iterate through all registered listeners and execute them
        this.crossServerEventListeners[event].forEach(({ fn, once }) => {
            try {
                // Execute the listener function with event data and optional callbacks
                fn(data, serverCallback, clientCallback);
            } catch (err) {
                console.error(`Local listener error for ${event}:`, err);
            }

            // If the listener is once-only, remove it after execution
            if (once) this.offCrossServerEvent(event, fn);
        });
    }

    /**
     * Retrieves the best healthy Redis instance based on the configured selection strategy.
     * - 'random'  : Randomly selects one healthy Redis instance.
     * - 'fastest' : Selects the Redis instance with the lowest latency.
     * - 'round-robin' : Selects Redis instances in a round-robin fashion.
     * 
     * @returns {Object} - The best healthy Redis instance based on the selection strategy.
     */
    _getHealthyRedisInstance() {
        // Filter for healthy Redis instances
        const healthyInstances = this.redisInstances.filter(instance => instance.publisher.isHealthy);

        //console.log('Number of healthy nodes: ' + healthyInstances.length);

        // If no healthy Redis instances are available, return error
        if (healthyInstances.length === 0) {
            debug("No healthy Redis instances available.");
            return null; 
        }

        // If only one healthy Redis instance, return it directly
        if (healthyInstances.length === 1) {
            return healthyInstances[0]; 
        }

        // The selected instance 
        let selectedInstance;

        // Select Redis instance based on selection strategy
        switch (this.selectionStrategy) {
            case 'random':
                // Randomly select a healthy Redis instance
                const randomInstanceIndex = Math.floor(Math.random() * healthyInstances.length);
                selectedInstance = healthyInstances[randomInstanceIndex];
                break;

            case 'fastest':
                // Select the Redis instance with the smallest latency
                selectedInstance = healthyInstances.reduce((prev, current) =>
                    prev.publisher.latencyTime < current.publisher.latencyTime ? prev : current
                );
                break;

            case 'round-robin':
                // Simple round-robin selection strategy
                // Explanation:
                // 1. Each time, an instance is selected from healthyInstances based on roundRobinIndex.
                // 2. roundRobinIndex starts at 0 and increments (++) after each selection.
                // 3. Modulo operation (% healthyInstances.length) ensures the index wraps around within valid bounds.
                // 4. This achieves a fair round-robin distribution of requests among the servers.
                this.roundRobinIndex = (this.roundRobinIndex || 0) % healthyInstances.length;
                selectedInstance = healthyInstances[this.roundRobinIndex++];
                break;

            default:
                // Default to the first healthy instance if no strategy matched
                selectedInstance = healthyInstances[0];
                break;
        }

        debug(`Strategy is ${this.selectionStrategy}, latency: ${selectedInstance.publisher.latencyTime}ms, port:${selectedInstance.publisher.options.port}, host:${selectedInstance.publisher.options.host}`);

        return selectedInstance;
    }

    /**
     * Add a regular event listener to handle events sent from other servers
     * 
     * @param {string} event - Event name
     * @param {Function} listener - Event handler function
     * @returns {void}
     */
    onCrossServerEvent(event, listener) {
        if (!this.enableCrossServer) return;
        if (!this.crossServerEventListeners[event]) this.crossServerEventListeners[event] = [];
        this.crossServerEventListeners[event].push({ fn: listener, once: false });
    }

    /**
     * Add a one-time event listener to handle events sent from other servers, triggered only once
     * 
     * @param {string} event - Event name
     * @param {Function} listener - Event handler function
     * @returns {void}
     */
    onceCrossServerEvent(event, listener) {
        if (!this.enableCrossServer) return;
        if (!this.crossServerEventListeners[event]) this.crossServerEventListeners[event] = [];
        this.crossServerEventListeners[event].push({ fn: listener, once: true });
    }

    /**
     * Removes a listener for a cross-server event.
     * 
     * @param {string} event - The event name to identify the event to remove the listener from.
     * @param {Function} listener - The listener function to be removed.
     */
    offCrossServerEvent(event, listener) {
        const listeners = this.crossServerEventListeners[event];
        if (listeners) {
            this.crossServerEventListeners[event] = listeners.filter(item => item.fn !== listener);
        }
    }

    /**
     * Publishes a message to a specified Redis channel, for internal room broadcasts or custom channel communications.
     * 
     * @param {string} channel - The Redis channel to publish to.
     * @param {Object} message - The message object to send
     * @returns {boolean} Whether the publish operation was successful
     */
    publishRedisMessage(channel, message) {

        if (!channel || typeof channel !== 'string') {
            throw new TypeError('channel must be a non-empty string');
        }

        // If cross-server functionality is not enabled, return false
        if (!this.enableCrossServer) {
            debug("Cross-server functionality is not enabled.");
            return false;
        }
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            debug('publishRedisMessage: Invalid argument: message must be a non-empty object');
            return false;
        }

        const selectedInstance = this._getHealthyRedisInstance();
        if (!selectedInstance) {
            debug("No healthy Redis instance available.");
            return false;
        }
       
        let payload;

        try {
            // Construct the message payload
            if (this.enableRedisDataCompression) {
                // If compression is enabled, use notepack to encode
                payload = notepack.encode(message);
            } else {
                // If not using compression, use JSON serialization
                payload = JSON.stringify(message);
            }
            // Only publish after successful construction
            selectedInstance.publisher.publish(channel, payload);
            return true; 
        } catch (error) {
            debug(`Failed to serialize or publish message on channel "${channel}":`, error);
            return false;
        }
    }

     /**
     * Publish a message to target servers or handle cross-server callback and events.
     *
     * @param {string} event - Event name. An empty string indicates a callback response.
     * @param {Object} message - The message payload to send.
     * @param {Function} [callback] - Optional callback function to handle responses from target servers.
     * @param {Object} [options] - Optional configuration object.
     * @param {string|string[]} [options.targetServer=[]] - The target server(s) to send the message to. 
     *                                                      An empty array or string indicates broadcast to all servers.
     * @param {number} [options.timeout=1000] - Callback timeout in milliseconds. Ignored if no callback is provided.
     * @param {number} [options.expectedResponses=1] - The expected number of server responses. 
     *                                                 In broadcast mode, defaults to 1 if not explicitly provided. 
     *                                                 In non-broadcast mode, it is set to the number of target servers.
     * @param {boolean} [options.exceptSelf=false] - When broadcasting, whether to exclude the current server from handling the message.
     * @returns {void}
     */
    emitCrossServer(event, message, callback, options = {}) {

        // If cross-server functionality is not enabled, return early 
        if (!this.enableCrossServer) {
            debug("Cross-server functionality is not enabled.");
            return;
        }

        // Check if data is provided
        if (!message) {
            debug("emitCrossServer: No data provided for the cross-server event.");
            return;
        }

        // Destructure options with default values for target servers, timeout, expected response count, and self-exclusion flag
        let { targetServer = [], timeout = 5000, expectedResponses = 1, exceptSelf = false } = options;

       // Ensure timeout is a positive integer, otherwise use the default value of 5000
        if (!Number.isInteger(timeout) || timeout <= 0) {
            timeout = 5000;
        }

        // Construct initial data packet with message, event name, and sender server identifier
        let data = { event, senderServer: this.serverName };

        if (message.isCallback) {
            // If the message is a callback, merge the message data into the data object.
            data = { ...data, ...message };
        } else {
            // If not a callback, just add the message as a property to the data object.
            data.message = message;
        }

        // Normalize target server input
        const targets = Array.isArray(targetServer)
            ? targetServer
            : (typeof targetServer === 'string' && targetServer)
                ? [targetServer]
                : [];

        // Update data.targetServer
        data.targetServer = targets;

        // Check if the message is a broadcast type
        const isBroadcast = targets.length === 0;

        if (isBroadcast) {
            // In broadcast mode, the expected number of responses must be explicitly specified.
            // If not specified, default to 1.
            if (!Number.isInteger(expectedResponses) || expectedResponses <= 0) {
                debug("Broadcast mode requires expectedResponses to be specified as a positive integer. Defaulting to 1.");
                expectedResponses = 1;  // Default to 1 if not a valid positive integer
            }
        } else {
            // If specific target servers are defined, the expected number of responses should match the number of target servers
            expectedResponses = targets.length;
        }

        // Determine if the current server should also handle the message (either by broadcast or explicit targeting)
        const isSendingToSelf = (isBroadcast && !exceptSelf) || targets.includes(this.serverName);

        // If a callback is provided, register it with timeout handling
        if (callback && typeof callback === 'function') {
            const callbackId = this._generateCrossServerCallbackId();
            data.callbackId = callbackId; 
            this.crossServerCallback[callbackId] = {
                callbackFunction: callback, 
                targetServers: targets, 
                expectedResponses, 
                timeoutId: setTimeout(() => {
                    // Triggered on timeout: respond with an error payload and report unresponsive servers
                    callback({
                        success: false,
                        error: 'Cross-server callback timed out.',
                        callbackId,
                        unrespondedCount: this.crossServerCallback[callbackId].expectedResponses 
                    });
                    delete this.crossServerCallback[callbackId];
                }, timeout)
            };
        }

        // If sending to self, handle locally first
        if (isSendingToSelf) {
            const { callbackId, isCallback } = data;
        
            // Handle callback responses
            if (isCallback && callbackId) {
                const cb = this.crossServerCallback[callbackId];
                if (cb) {
                    debug(`Processing callback for ${event}, callbackId: ${callbackId}`);
                    if (cb.resolveFunction) cb.resolveFunction(data);
                    if (cb.callbackFunction) {
                        // Only decrement expectedResponses if a callback is invoked (because cb.resolveFunction already handles this)
                        cb.expectedResponses--; // Decrease the expected response count after receiving one valid response
                        // Invoke the callback function with the received data
                        cb.callbackFunction({
                            success: true,
                            data,
                            remainingResponses: cb.expectedResponses 
                        });
                    }
                    // Once all expected responses have been received, clear the timeout and remove the callback entry
                    if (cb.expectedResponses <= 0) {
                        if (cb.timeoutId) clearTimeout(cb.timeoutId);
                        delete this.crossServerCallback[callbackId];
                    }
                }
            }

            // If not a callback, invoke registered event listeners
            if (!isCallback) {
                //debug(`Invoking cross-server listeners for event: ${event}`);
                this._invokeCrossServerListeners(event, data, callbackId, this.serverName);
            }
        }

        // If there are other servers to send to, publish the message via Redis
        if (!(isSendingToSelf && targets.length === 1)) {
            //debug(`Publishing to Redis with data: ${JSON.stringify(data)}`);
            this.publishRedisMessage(this.serverBridgeChannel, { data });
        }
    }

    /**
     * Emit a cross-server event and return a promise that resolves when all expected responses are received or the timeout is reached.
     *
     * This method allows sending a message to one or more servers (or broadcasting), and waiting for responses
     * from the target servers. It uses a promise-based approach for cleaner async handling.
     *
     * @param {string} event - The event name to emit.
     * @param {Object} message - The payload to send with the event.
     * @param {Object} [options] - Additional configuration options.
     * @param {string|string[]} [options.targetServer=[]] - Target server(s) to send the message to. An empty array or omitted means broadcasting to all servers.
     * @param {number} [options.timeout=5000] - Timeout in milliseconds to wait for responses before resolving with failure.
     * @param {number} [options.expectedResponses=1] - Number of expected responses. For broadcasts, must be specified explicitly or will default to 1.
     * @param {boolean} [options.exceptSelf=false] - If true, excludes the current server from handling the event when broadcasting.
     * @returns {Promise<Object>} A promise that resolves with the result:
     *                            { success: true, responses } on success,
     *                            or { success: false, message, responses, unrespondedCount } on timeout.
     */
    emitCrossServerWithPromise(event, message, options = {}) {
        return new Promise((resolve) => {
            // If cross-server functionality is not enabled, return failure status
            if (!this.enableCrossServer) {
                debug("Cross-server functionality is not enabled.");
                return resolve({
                    success: false,
                    message: 'Cross-server functionality is not enabled'
                });
            }

            // Check if data is provided
            if (!message) {
                debug("No data provided for the cross-server event.");
                return resolve({
                    success: false,
                    message: 'No data provided for the cross-server event.'
                });
            }

            // Destructure options with default values for target servers, timeout, expected response count, and self-exclusion flag
            let { targetServer = [], timeout = 5000, expectedResponses = 1, exceptSelf = false } = options;

            // Ensure timeout is a positive integer, otherwise use the default value of 5000
            if (!Number.isInteger(timeout) || timeout <= 0) {
                timeout = 5000;
            }

            // Construct initial data packet with message, event name, and sender server identifier
            let data = { message, event, senderServer: this.serverName };

            // Normalize target server input
            const targets = Array.isArray(targetServer)
                ? targetServer
                : (typeof targetServer === 'string' && targetServer)
                    ? [targetServer]
                    : [];

            // Update data.targetServer
            data.targetServer = targets;

            // Determine broadcast
            const isBroadcast = targets.length === 0;

            // Check if the message is a broadcast type
            if (isBroadcast) {
                // In broadcast mode, the expected number of responses must be explicitly specified.
                // If not specified, default to 1.
                if (!Number.isInteger(expectedResponses) || expectedResponses <= 0) {
                    debug("Broadcast mode requires expectedResponses to be specified as a positive integer. Defaulting to 1.");
                    expectedResponses = 1;  // Default to 1 if not a valid positive integer
                }
            } else {
                // If specific target servers are defined, the expected number of responses should match the number of target servers
                expectedResponses = targets.length;
            }
        
            // Determine if the current server should also handle the message (either by broadcast or explicit targeting)
            const isSendingToSelf = (isBroadcast && !exceptSelf) || targets.includes(this.serverName);

            // Register callback tracking
            const callbackId = this._generateCrossServerCallbackId();
            data.callbackId = callbackId;

            // Store all responses
            const responses = {}; 

            this.crossServerCallback[callbackId] = {
                resolveFunction: (resData) => {
                    responses[resData.senderServer] = resData; 
                    const cb = this.crossServerCallback[callbackId];
                    // Decrement the expected response count after receiving one valid response
                    cb.expectedResponses--;
                    if (cb.expectedResponses <= 0) {
                        if (cb.timeoutId) clearTimeout(cb.timeoutId);
                        delete this.crossServerCallback[callbackId];
                        resolve({ success: true, responses }); // Resolve when all responses arrive
                    }
                },
                targetServers: targets,
                expectedResponses,
                timeoutId: setTimeout(() => {
                    const cb = this.crossServerCallback[callbackId];
                    const unrespondedCount = cb.expectedResponses;
                    delete this.crossServerCallback[callbackId];
                    resolve({
                        success: false,
                        message: 'Cross-server callback timed out.',
                        responses,
                        unrespondedCount
                    });
                }, timeout)
            };

            // Handle local first if self included
            if (isSendingToSelf) {
                // Since emitCrossServerWithPromise is only used to initiate events (not handle callbacks),
                // isCallback is guaranteed to be false here. So we directly invoke registered handlers.
                this._invokeCrossServerListeners(event, data, callbackId, this.serverName);
            }

            // Publish to Redis if not only self
            if (!(isSendingToSelf && targets.length === 1)) {
                this.publishRedisMessage(this.serverBridgeChannel, { data });
            }
        });
    }

    /**
     * Delete a cross-server callback by ID
     * @param {string} callbackId - The ID of the callback to remove
     * @returns {boolean} True if the callback existed and was removed, false otherwise
     */
    deleteCrossServerCallback(callbackId) {
        if (callbackId && this.crossServerCallback && this.crossServerCallback[callbackId]) {
            delete this.crossServerCallback[callbackId];
            return true;
        }
        return false;
    }

    /**
     * Subscribe to a specific Redis channel manually
     * 
     * @param {string} channel - The name of the channel to subscribe to
     * @returns {void}
     */
    manualSubscribe(channel) {
        // Type check for channel - must be a valid string
        if (!channel || typeof channel !== 'string') {
            throw new TypeError('The channel must be a non-empty string');
        }
        
        // If cross-server functionality is not enabled, return
        if (!this.enableCrossServer) {
            debug('manualSubscribe: Invalid channel or cross-server functionality is disabled');
            return;
        }

        if (this.redisChannels.has(channel)) {
            debug(`manualSubscribe: Already subscribed to channel: ${channel}`);
            return; 
        }

        // Iterate over Redis instances and subscribe to the specified channel
        for (let { subscriber } of this.redisInstances) {
            subscriber.subscribe(channel, (err) => {
                if (err) {
                    this._handleRedisSubscriptionError(subscriber, channel, err, 'subscribe');
                } else {
                    debug(`manualSubscribe: Subscribed to channel: ${channel}`);
                    this.redisChannels.add(channel); 
                }
            });
        }
    }

    /**
     * Unsubscribe from a specific Redis channel manually
     * 
     * @param {string} channel - The name of the channel to unsubscribe from
     * @returns {void}
     */
    manualUnsubscribe(channel) {
        // Type check for channel - must be a valid string
        if (!channel || typeof channel !== 'string') {
            throw new TypeError('The channel must be a non-empty string');
        }

        // If cross-server functionality is not enabled, return
        if (!this.enableCrossServer) {
            debug('manualUnsubscribe: Invalid channel or cross-server functionality is disabled');
            return;
        }
        if (!this.redisChannels.has(channel)) {
            debug(`manualUnsubscribe: Not subscribed to channel: ${channel}`);
            return; 
        }

        // Iterate over Redis instances and unsubscribe from the specified channel
        for (let { subscriber } of this.redisInstances) {
            subscriber.unsubscribe(channel, (err) => {
                if (err) {
                    this._handleRedisSubscriptionError(subscriber, channel, err, 'unsubscribe');
                } else {
                    debug(`manualUnsubscribe: Unsubscribed from channel: ${channel}`);
                    this.redisChannels.delete(channel);  
                }
            });
        }
    }

    /**
     * Unsubscribe from a room namespace if autoUnsubscribe is enabled,
     * and skip unsubscribing for preset room namespaces.
     * @param {string} roomNamespace - The room namespace to unsubscribe from.
     */
    _unsubscribeRoomNamespace(roomNamespace) {
        // Return immediately if autoUnsubscribe is disabled
        if (!this.autoUnsubscribe) return;

        // Check if the roomNamespace is in the preset rooms list and skip if so
        if (this.presetRoomNamespaces && this.presetRoomNamespaces.includes(roomNamespace)) {
            return;
        }

        // Determine the actual Redis channel name (may have prefix)
        const channel = this._isWebSocketChannel(roomNamespace)
            ? roomNamespace
            : this.wsPrefix + roomNamespace;

        // Call the function to manually unsubscribe from the channel
        this.manualUnsubscribe(channel);
    }

    /**
     * Sets the custom channel message handler function
     * 
     * @param {Function} handler - The custom message handler function
     */
    setCustomChannelHandler(handler) {
        if (!this.enableCrossServer) return;
        if (typeof handler !== 'function') {
            throw new TypeError("Handler must be a function.");
        }
        this.customChannelHandler = handler;
    }

    /**
     * Removes the custom channel message handler function
     */
    removeCustomChannelHandler() {
        this.customChannelHandler = null;
    }

    /**
     * Add a Redis instance and optionally start health check mechanism based on config.
     *
     * This method adds a new Redis instance (publisher + subscriber) and sets up related event
     * listeners and message handlers. If multiple Redis instances exist and either:
     *    1. `redisForcePing` is enabled, or
     *    2. `selectionStrategy` is set to `'fastest'`,
     * then a ping timer is started to periodically ping all nodes and dynamically select
     * the one with the lowest latency for message publishing.
     *
     * @param {object} config - Redis client connection configuration object
     * @returns {void} - This function does not return any value.
     */
    addRedisInstance(config) {
        this._initRedisInstance(config);

        // If there are multiple Redis instances, and the force ping monitoring (redisForcePing) is enabled, 
        // or the selection strategy is "fastest", then start the ping monitoring timer.
        // Periodically sends ping requests to each Redis node to measure response times, 
        // dynamically selecting the fastest node among the available ones for requests.
        if (
            this.redisInstances.length > 1 &&
            (this.redisForcePing || this.selectionStrategy === 'fastest')
        ) {
            this._startRedisPingTimer();
        }
    }

    /**
     * Get the count of healthy Redis instances
     * 
     * The method filters all healthy Redis instances (where `isHealthy` is true) and returns their count.
     * 
     * @param {string} type - The type of Redis instance to count ('publisher' or 'subscriber')
     * @returns {number} The number of healthy Redis instances of the specified type
     */
    getHealthyRedisInstancesCount(type) {
        // Validate the 'type' parameter to ensure it's either 'publisher' or 'subscriber'
        if (type !== 'publisher' && type !== 'subscriber') {
            throw new TypeError("Invalid type. Must be 'publisher' or 'subscriber'.");
        }

        // Filter healthy Redis instances based on the specified type
        const healthyInstances = this.redisInstances.filter(instance => instance[type] && instance[type].isHealthy);

        // Return the count of healthy instances
        return healthyInstances.length;
    }

    /**
     * Get the count of current Redis instances
     * @returns {number} The number of Redis instances
     */
    getRedisInstancesCount() {
        return this.redisInstances.length;
    }

    /**
     * Registers a listener for a specific WebSocket event.
     * 
     * @param {string} event - The name of the event to listen for.
     * @param {Function} listener - The callback function to be invoked when the event is triggered.
     * @returns {void}
     */
    onWebSocketEvent(event, listener) {
        // Check if both event and listener are provided, if not, log a debug message
        if (!event || !listener) {
            debug('Error: Both event and listener must be provided.');
            return; 
        }

        // If WebSocket service is disabled, skip !
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping event registration for:', event);
            return;
        }

        // If there is no array of listeners for the event, initialize it.
        if (!this.webSocketEventListeners[event]) this.webSocketEventListeners[event] = [];

        // Add the new listener to the array of listeners for the event
        this.webSocketEventListeners[event].push({ fn: listener, once: false });
    }

    /**
     * Registers a listener that will only be triggered once for a specific WebSocket event.
     * 
     * @param {string} event - The name of the event to listen for.
     * @param {Function} listener - The callback function to be invoked when the event is triggered.
     * @returns {void}
     */
    onceWebSocketEvent(event, listener) {
        // Check if both event and listener are provided, if not, log a debug message
        if (!event || !listener) {
            debug('Error: Both event and listener must be provided.');
            return; // Early return if any parameter is missing
        }
        // If WebSocket service is disabled, skip !
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping event registration for:', event);
            return;
        }

        // If there is no array of listeners for the event, initialize it.
        if (!this.webSocketEventListeners[event]) this.webSocketEventListeners[event] = [];

        // Add the new listener to the array of listeners for the event and set 'once' to true, meaning the listener will be triggered only once.
        this.webSocketEventListeners[event].push({ fn: listener, once: true });
    }

    /**
     * Removes a listener from a specific WebSocket event.
     * 
     * @param {string} event - The name of the event for which the listener should be removed.
     * @param {Function} listener - The listener function to be removed.
     * @returns {void}
     */
    offWebSocketEvent(event, listener) {
        // Check if both event and listener are provided, if not, log a debug message
        if (!event || !listener) {
            debug('Error: Both event and listener must be provided.');
            return; // Early return if any parameter is missing
        }
        // If WebSocket service is disabled, skip !
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping event registration for:', event);
            return;
        }
        const listeners = this.webSocketEventListeners[event];
        if (listeners) {
            // Filter out the listener to be removed
            this.webSocketEventListeners[event] = listeners.filter(item => item.fn !== listener);
        }
    }

    /**
     * Broadcasts a message to all WebSocket clients in a specific room.
     *
     * - If `options.localOnly` is true, only broadcast to local clients.
     * - You can exclude specific clients using `options.excludeSocketIds`.
     * - If `options.localOnly` is false, broadcast via Redis across servers.
     * - If `options.roomDstroy` is true, destroy the room immediately after broadcasting.
     * 
     * @param {string} roomNamespace - The room namespace (e.g., 'chat', 'gameRoom').
     * @param {string} roomId - The specific room ID within the namespace.
     * @param {string} event - The name of the event to broadcast.
     * @param {Object} data - The message data to be sent to the room.
     * @param {Object} [options={}] - Additional optional parameters.
     * @param {string[]} [options.excludeSocketIds=[]] - List of socketIds to exclude from receiving the message.
     * @param {boolean} [options.localOnly=false] - Whether to only broadcast to local clients.
     * @param {boolean} [options.roomDstroy=false] - Whether to delete the room after local broadcast.
     * @returns {void} 
     */
    broadcastToRoom(roomNamespace, roomId, event, data, options = {}) {
        // Skip if WebSocket service is disabled
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping broadcasting for room:', roomNamespace, roomId);
            return;
        }

        // Validate parameters
        if (!roomNamespace || typeof roomNamespace !== 'string') {
            throw new TypeError('roomNamespace must be a non-empty string');
        }

        if (!roomId || typeof roomId !== 'string') {
            throw new TypeError('roomId must be a non-empty string');
        }

        // Validate essential parameters
        if (!event || !data) {
            debug('broadcastToRoom: Event or data missing, skipping broadcast for room:', roomNamespace, roomId);
            return;
        }

        const sendMessage = JSON.stringify({
            event,
            message: data
        });

        // Destructure additional options
        const {
            excludeSocketIds = [],
            localOnly = false,
            roomDstroy = false
        } = options;

        // Get all socketIds in the specified room
        const sockets = this.getRoomSocketIds(roomNamespace, roomId);
      
        // Local broadcast (excluding excluded socketIds)
        if (sockets.size > 0) {
            sockets.forEach(socketId => {
                if (excludeSocketIds.includes(socketId)) return; 
                const ws = this.socketMap.get(socketId);  
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(sendMessage);  
                } else {
                    debug('WebSocket is not open for socketId:', socketId, 'in room:', roomNamespace, roomId);
                }
            });
        }

        // If room destroy flag is true, delete the room immediately
        if (roomDstroy) {
            //debug('Room destroy flag is set, removing room:', roomNamespace, roomId);
            this.removeRoom(roomNamespace, roomId); 
        }

        // Skip Redis publish if localOnly is true
        if (localOnly) {
            return;
        }

        // Cross-server broadcast via Redis with exclude list
        debug('Publishing Redis message for room:', roomNamespace, roomId);

        const channel = this._isWebSocketChannel(roomNamespace)
            ? roomNamespace
            : this.wsPrefix + roomNamespace;
        this.publishRedisMessage(channel, {
            data: sendMessage,
            roomNamespace,
            roomId,
            senderServer: this.serverName,
            excludeSocketIds
        });
    }

    /**
     * Sends a message to a specific player.
     *
     * @param {string} socketId - The WebSocket socketId of the player.
     * @param {Object} data - The message data to be sent.
     * @param {string} event - The event name to be sent.
     * @returns {void}
     */
    toSocketId(socketId, event, data) {
        // If WebSocket service is disabled, skip broadcasting
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping broadcasting');
            return;
        }

        // SocketId must be a non-empty string
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }

        if (!event || !data) {
            debug('toSocketId: Missing parameters: event or data');
            return;
        };

        // If it's a callback, the data already contains full info 
        let payload = data.callbackId ? data : {
            message: data
        };

        payload.event = event;
        const sendMessage = JSON.stringify(payload);

        // Check locally, if the connection exists, send the message directly.
        const ws = this.socketMap.get(socketId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(sendMessage); 
            return;
        }

        // If no local connection, publish the message to Redis for cross-server delivery.
        this.publishRedisMessage(this.privateChannel, { data: sendMessage, socketId, senderServer: this.serverName });
    }

    /**
     * Sends a message to multiple players.
     *
     * @param {Array<string>} socketIds - The list of WebSocket socketIds of players.
     * @param {Object} data - The message data to be sent.
     * @returns {void}
     */
    toSocketIds(socketIds, event, data) {
        // If WebSocket service is disabled, skip broadcasting
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping broadcasting');
            return; 
        }

        // If socketIds, event, or data are missing, do nothing
        if (!socketIds || !event || !data) {
            debug('toSocketIds: Missing parameters: socketIds, event, or data');
            return;
        }

        const sendMessage = JSON.stringify({
            event,
            message: data
        });

        // Used to store socketIds of players who cannot receive the message locally.
        const remainingSocketIds = [];

        // Check locally and send message to available players.
        socketIds.forEach(socketId => {
            if (typeof socketId === 'string' && socketId) {
                const ws = this.socketMap.get(socketId);  
                if (ws && ws.readyState === WebSocket.OPEN) {
                    // If WebSocket connection is open, send the message to the player.
                    ws.send(sendMessage);
                } else {
                    // If the connection is unavailable, store the socketId for remote players.
                    remainingSocketIds.push(socketId);
                }
            }
        });

        // For players not connected to the local server, publish the message to Redis.
        if (remainingSocketIds.length > 0) {
            // If there are players not connected locally, publish the message to Redis for cross-server broadcasting.
            this.publishRedisMessage(this.privateChannel, { data: sendMessage, socketIds: remainingSocketIds, senderServer: this.serverName });
        }
    }
  
    /**
     * Broadcasts a message to all connected WebSocket clients.
     * If the `localOnly` flag is set to true, the message will only be broadcast locally to the connected clients.
     * If `localOnly` is false (or not provided), the message will also be published to Redis for cross-server broadcasting.
     *
     * @param {Object} data - The message data to be broadcasted.
     * @param {boolean} [localOnly=false] - A flag indicating whether to broadcast only to local clients. If true, the message will not be published to Redis.
     * @returns {void}
     */
    broadcast(event, data, localOnly = false) {
        // If WebSocket service is disabled, skip broadcasting
        if (!this.enableWebSocket) {
            debug('WebSocket service is disabled, skipping broadcasting');
            return;
        }

        // Parameter check
        if (!event || !data) {
            debug('broadcast: Missing parameters: event or data');
            return;
        }

        const sendMessage = JSON.stringify({
            event,
            message: data
        });

        // Local broadcast to all connected WebSocket clients.
        this.wss.clients.forEach((ws) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(sendMessage); 
            }
        });

        if (localOnly) return;  // If only broadcasting locally, exit.
        
        // Publish broadcast message to Redis for cross-server broadcasting.
        this.publishRedisMessage(this.broadcastChannel, { data: sendMessage, senderServer: this.serverName });
    }

    /**
     * Adds a socket to a specific room.
     * 
     * @param {string} roomNamespace - The room namespace (used to distinguish different types of rooms).
     * @param {string} roomId - The unique identifier of the room.
     * @param {string} socketId - The socketId of the player.
     * @returns {void}
     */
    joinRoom(roomNamespace, roomId, socketId) {
        // Validate parameters
        if (!roomNamespace || typeof roomNamespace !== 'string') {
            throw new TypeError('roomNamespace must be a non-empty string');
        }
        if (!roomId || typeof roomId !== 'string') {
            throw new TypeError('roomId must be a non-empty string');
        }
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }
       
        // Check if socketId exists in socketRooms, if not, initialize it
        if (!this.socketRooms.has(socketId)) {
            this.socketRooms.set(socketId, new Map());
        }

        // Get the current socketId's room record Map
        const socketRoomMap = this.socketRooms.get(socketId);

        // Check if the roomNamespace exists, if not, initialize it with a Set
        if (!socketRoomMap.has(roomNamespace)) {
            socketRoomMap.set(roomNamespace, new Set());
        }

        // Get the Set of rooms under the namespace
        const roomSet = socketRoomMap.get(roomNamespace);

        // Add roomId to set
        roomSet.add(roomId);

        // Ensure global room structure is initialized
        if (!this.rooms.has(roomNamespace)) {
            this.rooms.set(roomNamespace, new Map());
        }

        // Get the Map of rooms under the namespace
        const roomMap = this.rooms.get(roomNamespace);

        // Initialize room if it doesn't exist
        if (!roomMap.has(roomId)) {
            roomMap.set(roomId, new Set());
        }

        // Add socketId to room set
        roomMap.get(roomId).add(socketId);

        const channel = this._isWebSocketChannel(roomNamespace)
            ? roomNamespace
            : this.wsPrefix + roomNamespace;

        this.manualSubscribe(channel);
    }

    /**
     * Removes a socket from a specific room.
     * 
     * @param {string} roomNamespace - The room namespace.
     * @param {string} roomId - The unique identifier of the room.
     * @param {string} socketId - The socketId of the player.
     * @returns {void}
     */
    leaveRoom(roomNamespace, roomId, socketId) {
        // Validate parameters
        if (!roomNamespace || typeof roomNamespace !== 'string') {
            throw new TypeError('roomNamespace must be a non-empty string');
        }
        if (!roomId || typeof roomId !== 'string') {
            throw new TypeError('roomId must be a non-empty string');
        }
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }

        // Return if the roomNamespace doesn't exist
        if (!this.rooms.has(roomNamespace)) return;
        const roomMap = this.rooms.get(roomNamespace);
        if (!roomMap.has(roomId)) return;
        const roomSet = roomMap.get(roomId);
        roomSet.delete(socketId);
        if (roomSet.size === 0) {
            roomMap.delete(roomId);
            if (roomMap.size === 0) {
                this.rooms.delete(roomNamespace);

                // Unsubscribe from the room namespace if autoUnsubscribe is enabled,
                // and the roomNamespace is not in the presetRoomNamespaces list,
                // and there are no more rooms under this namespace locally.
                this._unsubscribeRoomNamespace(roomNamespace);
            }
        }

        // Update socketRooms structure
        const socketRoomMap = this.socketRooms.get(socketId);
        if (socketRoomMap) {
            const socketRoomSet = socketRoomMap.get(roomNamespace);
            if (socketRoomSet) {
                socketRoomSet.delete(roomId);
                if (socketRoomSet.size === 0) {
                    socketRoomMap.delete(roomNamespace);
                    if (socketRoomMap.size === 0) {
                        this.socketRooms.delete(socketId);
                    }
                }
            }
        }
    }

    /**
     * Removes the specified room and cleans up all socketId mappings related to the room.
     * 
     * @param {string} roomNamespace - The room type.
     * @param {string} roomId - The room ID.
     * @returns {void}
     */
    removeRoom(roomNamespace, roomId) {
        if (this.rooms.has(roomNamespace)) {
            const roomMap = this.rooms.get(roomNamespace);
            if (roomMap.has(roomId)) {
                const roomSet = roomMap.get(roomId);

                // Loop through the room's sockets and clean the socketRooms mappings
                roomSet.forEach(socketId => {
                    const socketRoomMap = this.socketRooms.get(socketId);
                    if (socketRoomMap) {
                        // Get the Set of rooms under the roomNamespace for this socket
                        const socketRoomSet = socketRoomMap.get(roomNamespace);
                        if (socketRoomSet) {
                            // Remove the current room from the socket's room set
                            socketRoomSet.delete(roomId);

                            // If there are no rooms left for the roomNamespace, delete the roomNamespace
                            if (socketRoomSet.size === 0) {
                                socketRoomMap.delete(roomNamespace);

                                // If the socketId is no longer in any room types, delete the socketId record
                                if (socketRoomMap.size === 0) {
                                    this.socketRooms.delete(socketId);
                                }
                            }
                        }
                    }
                });

                // Delete the room record
                roomMap.delete(roomId);

                // If there are no rooms left under this roomNamespace, delete the roomNamespace
                if (roomMap.size === 0) {
                    this.rooms.delete(roomNamespace);
                    // Unsubscribe from the room namespace if autoUnsubscribe is enabled,
                    // and the roomNamespace is not in the presetRoomNamespaces list,
                    // and there are no more rooms under this namespace locally.
                    this._unsubscribeRoomNamespace(roomNamespace);
                }

                // Log the room removal for debugging purposes
                debug(`Room ${roomNamespace}:${roomId} has been removed.`);
            }
        }
    }
 
    /**
     * Get the user count in a specified room or room type.
     *
     * - If `roomId` is provided, counts users in that room.
     * - If `roomId` is not provided, counts users in all rooms under the namespace.
     * - Supports exact and fuzzy matching.
     * 
     * @param {string} roomNamespace - The room namespace (e.g., 'chat', 'gameRoom').
     * @param {string} [roomId] - The room ID, default is undefined.
     * @param {Object} [options] - Matching options.
     * @param {boolean} [options.exactMatch=true] - Whether to perform exact matching.
     * @returns {number} Socket count
     */
    getSocketCountInRoom(roomNamespace, roomId, options = { exactMatch: true }) {
        // If no roomNamespace is provided, return 0
        if (!roomNamespace || !this.rooms.has(roomNamespace)) {
            return 0;
        }
        const roomMap = this.rooms.get(roomNamespace);
        let count = 0;
        if (roomId) {
            if (options.exactMatch) {
                // Exact match
                if (roomMap.has(roomId)) {
                    count = roomMap.get(roomId).size;
                }
            } else {
                // Fuzzy match
                for (const [id, socketSet] of roomMap.entries()) {
                    if (id.startsWith(roomId)) {
                        count += socketSet.size;
                    }
                }
            }
        } else {
            // No roomId, count all rooms under this roomNamespace
            for (const socketSet of roomMap.values()) {
                count += socketSet.size;
            }
        }
        return count;
    }

    /**
     * Retrieves all sockets in a given room type, optionally filtered by roomId.
     * 
     * @param {string} roomNamespace - The name of the room type to query.
     * @param {string|null} roomId - The roomId to filter sockets by (optional).
     * @param {Object} [options] - Optional configuration object.
     * @param {boolean} [options.exactMatch=true] - Whether to perform exact matching.
     * @returns {Set<string>} - A set of socket IDs in the matched rooms.
     */
    getRoomSocketIds(roomNamespace, roomId, options = { exactMatch: true }) {
        const socketSet = new Set();

        // If the room type does not exist, return empty set
        if (!this.rooms.has(roomNamespace)) {
            return socketSet;
        }
        const roomMap = this.rooms.get(roomNamespace); // Map<roomId, Set<socketId>>
        if (roomId) {
            if (options.exactMatch) {
                // Exact match
                const sockets = roomMap.get(roomId);
                if (sockets) {
                    sockets.forEach(id => socketSet.add(id));
                }
            } else {
                // Fuzzy match: match rooms starting with roomId
                for (const [id, sockets] of roomMap.entries()) {
                    if (id.startsWith(roomId)) {
                        sockets.forEach(id => socketSet.add(id));
                    }
                }
            }
        } else {
            // If no roomId, return all socketIds under this roomNamespace
            for (const sockets of roomMap.values()) {
                sockets.forEach(id => socketSet.add(id));
            }
        }
        return socketSet;
    }

    /**
     * Get the rooms the specified socketId has joined, optionally filtered by room prefix.
     * 
     * @param {string} socketId - The socketId to query.
     * @param {string|null} [roomNamespace=null] - Room type prefix to filter (optional).
     * 
     * @returns {Map<string, Set<string>>} - Returns a Map of room types and sets of room IDs.
     */
    getJoinedRooms(socketId, roomNamespace = null) {
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }
        // Get the set of rooms the socket has joined
        const socketRoomMap = this.socketRooms.get(socketId);
        if (!socketRoomMap) {
            // If no rooms joined, return an empty Map
            return new Map();
        }

        // If no roomNamespace is provided, return the entire room map
        if (!roomNamespace) {
            return socketRoomMap;
        }

        // If roomNamespace prefix is provided, filter rooms by prefix
        const filteredRooms = new Map();
        for (const [type, rooms] of socketRoomMap.entries()) {
            if (type.startsWith(roomNamespace)) {
                filteredRooms.set(type, rooms);
            }
        }
        return filteredRooms;
    }

    /**
     * Check whether the specified socketId has joined a room or a type of room.
     * 
     * @param {string} socketId - The socketId to check.
     * @param {string} roomNamespace - Room type prefix (required).
     * @param {string} [roomId] - Room ID to specify (optional).
     * 
     * @returns {boolean} - Returns true if the socket has joined the room or room type; otherwise false.
     */
    isJoinedRoom(socketId, roomNamespace, roomId = null) {
        // Invalid socketId, return false
        if (!socketId || typeof socketId !== 'string') {
            return false;
        }
        // Invalid roomNamespace, return false
        if (!roomNamespace || typeof roomNamespace !== 'string') {
            return false;
        }

        // Get the map of rooms the socket has joined
        const socketRoomMap = this.socketRooms.get(socketId);
        if (!socketRoomMap) {
            return false;
        }

        if (roomId !== null) {
            // If roomId is provided, check if the socket has joined the specific room
            const roomSet = socketRoomMap.get(roomNamespace);
            if (roomSet && roomSet.has(roomId)) {
                return true;
            }
            return false;
        } else {
            // If no roomId is provided, check if the socket has joined any room in the roomNamespace
            return socketRoomMap.has(roomNamespace);
        }
    }

    /**
     * Get the number of rooms under the specified room namespace.
     * 
     * @param {string} roomNamespace - The namespace prefix to search.
     * @param {Object} [options] - Match options.
     * @param {boolean} [options.exactMatch=true] - Whether to match the namespace exactly.
     * 
     * @returns {number} - The number of matched rooms.
     */
    getRoomCount(roomNamespace, options = { exactMatch: true }) {
        // If no roomNamespace is provided, return 0
        if (!roomNamespace) return 0;
        let count = 0;
        if (options.exactMatch) {
        
            // Exact match: only check the given roomNamespace
            if (this.rooms.has(roomNamespace)) {
                count = this.rooms.get(roomNamespace).size;
            }
        } else {
            // Fuzzy match: match all namespaces that start with the given roomNamespace
            for (const [namespace, roomMap] of this.rooms.entries()) {
                if (namespace.startsWith(roomNamespace)) {
                    count += roomMap.size;
                }
            }
        }
        return count;
    }

    /**
     * Get all roomIds under the specified room namespace.
     * 
     * @param {string} roomNamespace - The namespace prefix to search.
     * @param {Object} [options] - Match options.
     * @param {boolean} [options.exactMatch=true] - Whether to match the namespace exactly.
     * 
     * @returns {string[]} - An array of matched roomIds.
     */
    getRoomIds(roomNamespace, options = { exactMatch: true }) {
        if (!roomNamespace) return [];
        const result = [];
        if (options.exactMatch) {
            // Exact match: get roomIds only under the exact namespace
            if (this.rooms.has(roomNamespace)) {
                const roomMap = this.rooms.get(roomNamespace);
                result.push(...roomMap.keys());
            }
        } else {
            // Fuzzy match: get roomIds from all namespaces that start with the prefix
            for (const [namespace, roomMap] of this.rooms.entries()) {
                if (namespace.startsWith(roomNamespace)) {
                    result.push(...roomMap.keys());
                }
            }
        }
        return result;
    }

    /**
     * Removes a socket from all rooms it is part of and cleans up the records.
     * 
     * @param {string} socketId - The socketId of the player.
     */
    _removeSocket(socketId) {
        // Get the set of rooms the socket has joined
        const socketRoomMap = this.socketRooms.get(socketId);
        if (socketRoomMap) {
            // Iterate through all room types
            for (const [roomNamespace, roomSet] of socketRoomMap.entries()) {
                // Iterate through all rooms under the roomNamespace
                for (const roomId of roomSet) {
                    // Get the room set for this roomId
                    const roomMap = this.rooms.get(roomNamespace);
                    if (roomMap) {
                        const room = roomMap.get(roomId);
                        if (room) {
                            // Remove the socket from the room
                            room.delete(socketId);

                            // Delete the room if it's empty
                            if (room.size === 0) {
                                roomMap.delete(roomId);
                            }
                        }
                    }
                }

                // If no rooms left under this roomNamespace, delete the roomNamespace
                if (roomSet.size === 0) {
                    this.rooms.delete(roomNamespace);
                    // Unsubscribe from the room namespace if autoUnsubscribe is enabled,
                    // and the roomNamespace is not in the presetRoomNamespaces list,
                    // and there are no more rooms under this namespace locally.
                    this._unsubscribeRoomNamespace(roomNamespace);
                }
            }

            // Clean up socketRooms record
            this.socketRooms.delete(socketId);
        }
    }

 
    /**
     * Adds a user-socket mapping.
     * 
     * @param {string} socketId - The user's socketId (must be a string).
     * @param {Object} socket - The WebSocket connection object.
     * @throws Will throw an error if socketId is not a string or socket is falsy.
     */
    setUserSocket(socketId, socket) {
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }
        if (!socket) {
            throw new Error('Invalid socket object.');
        }
        this.socketMap.set(socketId, socket);
    }

    /**
     * Removes a user-socket mapping.
     * 
     * @param {string} socketId - The user's socketId (must be a string)
     * @throws {TypeError} If socketId is not a string
     */
    removeUserSocket(socketId) {
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }
        // Remove the socket from all room mappings and the socketId-to-socket map
        this._removeSocket(socketId);
        this.socketMap.delete(socketId);
        
    }

    /**
     * Gets the WebSocket instance for a given socket ID.
     * 
     * @param {string} socketId - The user's socketId (must be a string)
     * @returns {WebSocket|null} - The WebSocket instance, or null if not found
     * @throws {TypeError} If socketId is not a string
     */
    getSocketInstance(socketId) {
        if (!socketId || typeof socketId !== 'string') {
            throw new TypeError('socketId must be a non-empty string');
        }
        return this.socketMap.get(socketId) || null;
    }


    /**
     * Get the total number of clients on the current server node.
     * 
     * @returns {number} The current number of clients
     */
    getSocketClientCount() {
        return this.socketMap.size;
    }

    /**
     * Determine whether a given channel belongs to the WebSocket communication system.
     * 
     * @param {string} channel - The name of the channel to check
     * @returns {boolean} true if it's a WebSocket channel, otherwise false
     */
    _isWebSocketChannel(channel) {
        return channel.startsWith(this.wsPrefix);
    }

    /**
     * Add WebSocket or server bridge prefixes to room names to standardize Redis channel naming.
     * 
     * @param {string[]} rooms - Array of room names
     * @returns {string[]} Array of Redis channels with correct prefixes
     */
    _prefixWsChannels(rooms) {
        return rooms.map(room => {
            if (room.startsWith(this.bridgePrefix)) return room;
            if (room.startsWith(this.wsPrefix)) return room;
            return `${this.wsPrefix}${room}`;
        });
    }

    /**
     * Get current server name.
     * 
     * @returns {string} The current server name
     */
    getServerName() {
        return this.serverName;
    }

    /**
     * Generate a unique callback ID for cross-server callbacks
     * 
     * @returns {string} - A unique callback ID
     */
    _generateCrossServerCallbackId() {
        if (!this._cachedServerName) {
            // Cache truncated serverName (max 6 characters) for performance
            this._cachedServerName = this.serverName.length > 6 ? this.serverName.slice(-6) : this.serverName;
        }
        // Increment the internal counter
        this._callbackIdCounter = (this._callbackIdCounter || 0) + 1;
        // Generate unique callback ID combining serverName, timestamp, random string, and counter
        return `${this._cachedServerName}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${this._callbackIdCounter.toString(36)}`;
    }

    /**
     * Get the WebSocket server instance
     * @returns {WebSocket.Server} WebSocket server instance
     */
    getWss() {
        if (!this.wss) {
            debug('WebSocket server is not initialized');
            return null;
        }
        return this.wss;
    }

    /**
     * Parse URL query parameters and path from WebSocket request
     * 
     * @param {object} req - WebSocket request object
     * @param {object} options - Options for parsing
     * @param {boolean} [options.autoLowerCaseKeys=false] - Whether to convert query parameter keys to lowercase
     * @param {boolean} [options.autoRemoveLeadingSlash=true] - Whether to remove leading slash from path
     * 
     * @returns {object} Parsed result
     * @returns {object} result.params - Parsed URL query parameters
     * @returns {string|null} result.path - Parsed request path
     */
    parseWsRequestParams(req, options = {}) {
        const result = {
            params: {},  // URL query parameters
            path: null,  // Request path
        };

        const {
            autoLowerCaseKeys = false, // Default: don't convert keys to lowercase
            parsePath = true,          // Default: parse path
            autoRemoveLeadingSlash = true, // Whether to auto remove leading slash from path
        } = options;

        try {
            if (req.url) {
                const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                urlObj.searchParams.forEach((value, key) => {
                    if (autoLowerCaseKeys) {
                        key = key.toLowerCase(); 
                    }
                    if (!result.params[key]) {
                        result.params[key] = value; 
                    } else if (Array.isArray(result.params[key])) {
                        result.params[key].push(value); 
                    } else {
                        result.params[key] = [result.params[key], value]; 
                    }
                });
                if (parsePath) {
                    result.path = urlObj.pathname; 
                    if (autoRemoveLeadingSlash && result.path) {
                        result.path = result.path.replace(/^\/+/, '');  
                    }
                }
            }

        } catch (e) {
            console.error('Failed to parse WebSocket request params:', e);
        }

        return result; 
    }

}

module.exports = WebSocketCrossServerAdapter;
