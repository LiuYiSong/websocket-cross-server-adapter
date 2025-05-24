
/**
 * Copyright (c) 2025 LiuYiSong
 * Email: 349233775@qq.com
 * https://github.com/LiuYiSong/websocket-cross-server-adapter
 * All rights reserved.
 * 
 * WebSocketConnector Client Class
 *
 * This class manages the lifecycle of a WebSocket client connection. 
 * It provides automatic and manual reconnection, heartbeat support, event-based communication with response callbacks, 
 * and is suitable for frontend or Node.js clients requiring stable bidirectional communication.
 *
 */

'use strict';
let WebSocket;
if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined') {
    WebSocket = window.WebSocket;
} else {
    WebSocket = require('ws');
}

class WebSocketConnector {
    /**
     * Constructor function to initialize the WebSocket client instance.
     * The constructor accepts an options object `options` and sets the default configuration for the WebSocket client, 
     * while allowing the user to provide custom configurations. 
     * 
     * @param {Object} options - User-provided configuration options to override the defaults.
     * @param {string} options.url - Full WebSocket connection URL, must start with `ws://` or `wss://`, e.g., `ws://127.0.0.1:8081` or `wss://example.com/chatroom`.
     *                  Must include protocol, domain or IP, optional port, and optional path. / 
     * @param {number} options.pingInterval - Time interval to trigger a ping, default is 10000 ms.
     * @param {number} options.pongTimeout -  Duration to wait for a pong response after sending ping (in ms), default is 2000.
     *                        If no pong is received within this duration, the connection is considered broken and will be closed.
    
     * @param {number} options.fastReconnectThreshold - Maximum number of fast reconnection attempts, default is 3 times.
     * @param {number} options.fastReconnectInterval  - Time interval between attempts during the fast reconnection phase, default is 3000 ms.
     * @param {number} options.reconnectMaxInterval - Maximum interval between reconnection attempts after exponential backoff, default is 120_000 ms.
     * @param {string} options.pingMsg - Ping message sent to the server, default is "".
     * @param {number} options.callbackTimeout - Timeout duration in milliseconds for event responses with callbacks or Promises. Default is 5000 ms.
     *                        When sending an event using `emit(event, data, callback)` or `await emitWithPromise(event, data)`,
     *                        if no response is received from the server within the configured timeout duration, it is considered a timeout:
     *                        For callback usage, the callback will be invoked with a timeout error;
     *                        For Promise usage, it will resolve with an object like `{ success: false, error: string }`.
     * @param {number} options.repeatLimit - Maximum number of reconnection attempts, default is unlimited (null).
     * @param {number} options.pendingTimeout - Timeout to trigger pending callbacks, default is 100 ms.
     *                       After calling `emit`, if no server response (neither success nor failure) is received within this duration,
     *                       a pending handler (e.g., showing a loading UI) will be triggered. This helps provide user feedback like "processing…".
     *                       Once the response arrives, this handler won't be called again.
     *                       Note that `pendingTimeout` must be less than `callbackTimeout` to function properly, 
     *                       as it triggers the pending handler before the callback timeout occurs.
     * @param {Object} options.customParams - Custom additional parameters that This object contains key-value pairs representing the parameters and their values.
     */

    constructor(options) {
        // Default configuration options
        this.options = {
            // WebSocket connection URL, must be a complete URL starting with ws:// or wss://,
            // e.g., ws://127.0.0.1:8081 or wss://example.com/chat.
            // Must include protocol, domain/IP, optional port, and optional path.
            url: '',
            pingInterval: 10000,        // Time interval to trigger ping
            pongTimeout: 2000,        // Timeout for no pong response after ping
            //autoReconnect: true,      // Whether to enable auto-reconnect (enabled by default)
            fastReconnectThreshold: 3,            // Maximum fast reconnect attempts
            fastReconnectInterval: 3000, // Fast reconnect interval
            reconnectMaxInterval: 120_000, // Maximum interval
            pingMsg: '',              // Ping message sent to the server
            callbackTimeout: 5000,    // Timeout for callback functions
            repeatLimit: null,        // Maximum reconnection attempts
            pendingTimeout: 100,      // Timeout for pending callback triggers (in ms)
            customParams: {}          // Custom additional parameters
        };

        // Merge provided options with defaults
        this.options = { ...this.options, ...options };

        // Connection state tracking
        this.pingGoTime = 0;           // Last ping time (used to calculate latency)
        this.repeat = 0;               // Current reconnection attempt count

        // Event and callback storage
        this.webSocketEventListeners = {}; // Registered event listeners
        this.socketCallbacks = {};         // Store callbacks, timers, and callback ID mappings

        // Timer references
        this.pingTimer = null;     // Ping timer
        this.pongTimer = null;     // Pong timer

        // Initialize WebSocket connection
        this._createWebSocket();
    }

    /**
     * Creates a WebSocket connection and binds event handlers.
     * This function attempts to connect to the WebSocket server and binds the `onopen`, `onmessage`, `onerror`, and `onclose` event handlers.
     * If the connection fails, the reconnection mechanism will be triggered.
     *
     * @returns {void}
     */
    _createWebSocket() {
        try {
            if (!this.options.url) {
                throw new Error("Missing WebSocket URL: please provide a complete ws:// or wss:// address in options.url.");
            }
            let url = this.options.url;
            const customParams = this.options.customParams;
            if (customParams && typeof customParams === 'object' && !Array.isArray(customParams)) {
                const queryParams = new URLSearchParams();
                for (const [key, value] of Object.entries(customParams)) {
                    queryParams.append(key, String(value));
                }
                if (queryParams.toString()) {
                    const separator = url.includes('?') ? '&' : '?';
                    url += separator + queryParams.toString();
                }
            }

            this.ws = new WebSocket(url);

            /**
             * In a Node.js environment, using `this.ws.on('open', function open() {})` style will receive binary data (Buffer) in the `message` event,
             * requiring manual parsing by the developer.
             * Using `this.ws.onopen = function() {}` style will receive a `MessageEvent` object, and the actual data must be accessed via `message.data`.
             * Node.js ws client supports both `on` and `onopen` registration styles,
             * but the browser's built-in WebSocket only supports `onopen = function()`.
             * To maintain consistency between browser and Node.js environments, we adopt `onopen = function()` here,
             * and always access the actual data from `message.data` in the `message` event.
             * in Node.js it is typically a string or Buffer. When processing `message.data`, 
             * ensure proper handling based on the actual data type.
             * If you prefer handling binary (Buffer) data in Node.js, you should modify the handling logic here.
             */
            this.ws.onopen = this._onOpen.bind(this);
            this.ws.onmessage = this._onMessage.bind(this);
            this.ws.onerror = this._onError.bind(this);
            this.ws.onclose = this._onClose.bind(this);

        } catch (e) {
            this.reconnect();
            console.error('Failed to connect to WebSocket server:', e);
        }
    }

    /**
     * Handles the WebSocket connection open event.
     * This function triggers the `onopen` event callback and resets the reconnection attempts (`repeat`).
     * After that, it starts the heartbeat mechanism. 
     * 
     * @param {Event} event - The event object when the WebSocket connection is opened.
     * @returns {void}
     */
    _onOpen(event) {
        this._executeListeners("open", event); // Execute the onopen callback function.
        this.repeat = 0;
        this._heartCheck();
    }

    /**
     * Handles the WebSocket connection close event.
     * This function triggers the `onclose` event callback and provides information about the closure.
     * 
     * The connection could be closed due to various reasons, such as:
     * - Server-side closure, for example, authentication failure, forced disconnection, etc.
     * 
     * The `event.code` provides detailed information about the closure reason:
     * - For example, a code of `1000` indicates a normal closure, while other codes may indicate specific errors.
     * 
     * In this case, the reconnection logic (`this.reconnect()`) is not automatically triggered, as the reason for the closure may require custom handling.
     * Developers can listen for the `onclose` event and decide whether to attempt reconnection based on the `event.code` or other application-specific logic.
     * 
     * @param {Event} event - The event object when the WebSocket connection is closed, containing `event.code` and other details.
     * @returns {void}
     */
    _onClose(event) {
        // Log information about the connection closure, such as the code and reason (optional).
        // console.log('Connection closed ===', event.code, event.reason);
    
        // Execute the registered `onclose` callback functions (if any).
        this._executeListeners("close", event);

        // Developers are responsible for handling the reconnection logic based on event.code or other criteria.
        // this.reconnect(); 
    }

    /**
     * Handles the WebSocket error event.
     * This function triggers the `onerror` event callback and attempts to reconnect.
     * 
     * When an error occurs during the WebSocket communication (e.g., network issues, server unavailability),
     * this function will be triggered. The error event provides details about the nature of the error.
     * 
     * @param {Event} event - The event object when a WebSocket error occurs, containing details about the error. 
     * @returns {void}
     */
    _onError(event) {
        // Execute the registered `onerror` callback functions (if any).
        this._executeListeners("error", event);

        // Attempt to reconnect after the error occurs.
        // The reconnection logic can be customized by the developer, depending on the error.
        this.reconnect();

    }

    /**
     * Handles the received message.
     * 
     * This function first checks if the message is valid. If invalid, it returns immediately.
     * Then, it executes the `onmessage` event callback and resets the heartbeat timer.
     * If the message data matches the `pingMsg` configuration, it indicates a pong response.
     * It calculates and executes the `onpong` event callback, passing the round-trip delay (ping time).
     * Otherwise, it treats the message as a normal message and calls the `_handleMessage` method. 
     * 
     * @param {Object} message - The received message object.
     * @returns {void}
     */
    _onMessage(message) {
        /**
         * Explanation:
         * - `!message` checks if the message object exists; if not, it returns immediately.
         * - `message.data === undefined` checks if the `data` field in the message is `undefined`. 
         * We are only concerned with whether the `data` field exists, not whether it is an empty string (""). 
         * This is because we might have agreements, such as a heartbeat packet being an empty string (""), and in that case, we still want to proceed with subsequent logic.
         */
        if (!message || message.data === undefined) return;
        
        this._executeListeners("message", message.data);
        if (message.data === this.options.pingMsg) {
            // Handle pong response
            let now = (new Date()).getTime();
            let speed = now - this.pingGoTime;
            this._executeListeners("pong", speed);
            this._heartCheck();
        } else {
            this._handleMessage(message.data);
        }
    }
 
    /**
     * Handles the received messages.
     * 
     * This function attempts to parse the incoming JSON data. If parsing fails, it ignores the message.
     * If the message contains a `callbackId`, it finds and executes the callback or Promise associated with that ID.
     * If the message contains an `event`, it triggers the corresponding event and executes registered listeners.
     * 
     * @param {string} data - The received message data. 
     * @returns {void}
     */
    _handleMessage(data) {
        try {
            data = JSON.parse(data);
        } catch (err) {
            return;
        }
        if (!data) return;

        // Handle callback responses
        if (data.callbackId) {
            let cb = this.socketCallbacks[data.callbackId];
            if (cb) {
                // Execute the corresponding callback function
                if (cb.callback) cb.callback(null, data);
                if (cb.resolve) cb.resolve({ success: true, data });

                // Clean up timers and references
                if (cb.timeoutId) clearTimeout(cb.timeoutId);
                if (cb.pendingTimer) clearTimeout(cb.pendingTimer);
                delete this.socketCallbacks[data.callbackId];
            }
            return;
        }
    
        // Handle event-triggered messages
        if (data.event) this._executeListeners(data.event, data);
    }

    /**
     * Executes all listener functions for a specified event.
     * 
     * This function first checks if the event is valid, then finds and executes all registered listeners.
     * If the listener is set to execute only once, it is removed after execution.
     * 
     * @param {string} event - The event name to be triggered.
     * @param {Object} data - The data to be passed to the listeners. 
     * @returns {void}
     */
    _executeListeners(event, data) {
        // If no event name is provided, do nothing.
        if (!event) return;
    
        const listeners = this.webSocketEventListeners[event];
        if (listeners) {
            // Execute all listeners
            listeners.forEach(({ fn, once }) => {
                try {
                    fn(data);
                } catch (err) {
                    console.error(`[${event}] Listener execution failed:`, err);
                }
                if (once) this.off(event, fn);
            });
        }
    }

    /**
     * Registers an event listener function that gets executed when the event is triggered.
     *
     * @param {string} event - The name of the event to listen for.
     * @param {function} listener - The callback function to be executed when the event is triggered.
     * @returns {void}
     */
    on(event, listener) {
        // Ensure event is a non-empty string
        if (!event || typeof event !== 'string') {
            throw new TypeError('event must be a non-empty string');
        }

        // Ensure listener is a function
        if (typeof listener !== 'function') {
            throw new TypeError('listener must be a function');
        }
        if (!this.webSocketEventListeners[event]) this.webSocketEventListeners[event] = [];
        this.webSocketEventListeners[event].push({ fn: listener, once: false });
    }

    /**
     * Registers a one-time event listener function that gets executed once and then automatically removed.
     *
     * @param {string} event - The name of the event to listen for.
     * @param {function} listener - The callback function to be executed when the event is triggered.
     * @returns {void}
     */
    once(event, listener) {
        // Ensure event is a non-empty string
        if (!event || typeof event !== 'string') {
            throw new TypeError('event must be a non-empty string');
        }

        // Ensure listener is a function
        if (typeof listener !== 'function') {
            throw new TypeError('listener must be a function');
        }
        if (!this.webSocketEventListeners[event]) this.webSocketEventListeners[event] = [];
        this.webSocketEventListeners[event].push({ fn: listener, once: true });
    }

    /**
     * Removes an event listener function and unregisters it for that event.
     *
     * @param {string} event - The name of the event to remove the listener for.
     * @param {function} listener - The callback function to be removed.
     * @returns {void}
     */
    off(event, listener) {
        // Ensure event is a non-empty string
        if (!event || typeof event !== 'string') {
            throw new TypeError('event must be a non-empty string');
        }

        // Ensure listener is a function
        if (typeof listener !== 'function') {
            throw new TypeError('listener must be a function');
        }

        const listeners = this.webSocketEventListeners[event];
        if (listeners) {
            this.webSocketEventListeners[event] = listeners.filter(item => item.fn !== listener);
        }
    }

    /**
     * Sends data with an event to the WebSocket server and optionally handles the callback and pending behavior.
     * 
     * This function checks the WebSocket connection state before sending.
     * If connected, it sends the data. If a callback is provided, a unique callback ID is generated and attached,
     * and the callback is registered to handle the server response.
     * 
     * @param {string} event - The event name to be sent.  
     * @param {Object} data - The data object to be sent.  
     * @param {function} [callback] - Optional response callback function.  
     * @param {Object} [options] - Optional extra options object.  
     * @param {number} [options.callbackTimeout] - Timeout for the callback function in milliseconds.  
     * @param {function} [options.onPending] - Function triggered while waiting for callback.  
     * @param {number} [options.pendingTimeout] - Timeout before triggering onPending in milliseconds.   
     * @returns {void}
     */
    emit(event, data, callback, options = {}) {
        // Do nothing if event or data is not provided.
        if (!event || !data) return;

        // Protective check: this.ws might be null during reconnecting.
        // Accessing readyState in that case would throw TypeError.
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            if (callback && typeof callback === 'function') {
                callback({
                    error: 'WebSocket is not open',
                    errorCode: 'WS_NOT_OPEN',
                }, null);
            }
            return;
        }

        // If a callback is provided, generate ID and register it.
        if (callback && typeof callback === 'function') {
            const callbackId = this._generateCallbackId();
            data.callbackId = callbackId;
            this._registerSocketCallback({
                callbackId,
                type: 'callback',
                fn: callback,
                onPending: options.onPending,
                pendingTimeout: options.pendingTimeout || this.options.pendingTimeout,
                callbackTimeout: options.callbackTimeout || this.options.callbackTimeout,
            });
        }

        // Set event and send the data.
        data.event = event;
        this.ws.send(JSON.stringify(data));
    }

    /**
     * Sends event data and returns a Promise to handle the response or timeout.
     * 
     * If the connection is open, the function sends the data and registers a callback.
     * It supports response timeout and a pending handler before timeout.
     * If the connection is invalid, it returns an error directly.
     * 
     * @param {string} event - The event name to be sent.
     * @param {Object} data - The data object to be sent.
     * @param {Object} [options] - Optional configuration object.
     * @param {function} [options.onPending] - Callback to be invoked before timeout if response is pending.
     * @param {number} [options.pendingTimeout] - Timeout duration for the pending callback in milliseconds.
     * @param {number} [options.callbackTimeout] - Timeout duration for the response callback in milliseconds.
     * @returns {Promise<Object>} - Returns a Promise containing either response data or error info.
     */
    emitWithPromise(event, data, options = {}) {
        return new Promise((resolve) => {
            // Parameter check: Return error if event or data is missing.
            if (!event || !data) return resolve({ success: false, error: 'No data or event provided in emitWithPromise' });

            // Check if WebSocket connection is available.
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return resolve({
                    success: false,
                    error: 'WebSocket is not open',
                    errorCode: 'WS_NOT_OPEN'
                });
            }

            // Generate callback ID and register the callback.
            const callbackId = this._generateCallbackId();
            data.callbackId = callbackId;
            this._registerSocketCallback({
                callbackId,
                type: 'promise',
                fn: resolve,
                onPending: options.onPending,
                pendingTimeout: options.pendingTimeout || this.options.pendingTimeout,
                callbackTimeout: options.callbackTimeout || this.options.callbackTimeout
            });

            // Add event name and send data.
            data.event = event;
            this.ws.send(JSON.stringify(data));
        });
    }

    /**
     * Registers the callback function for WebSocket messages and handles timeout and pending logic.
     *
     * This function registers the callback function, timeout logic, and pending logic into `socketCallbacks`.
     * It sets the timeout based on the provided options and calls the corresponding error handling function after the timeout.
     * If a pending callback function is provided, it will be called within the specified time.
     * 
     * @param {Object} options - The options for registering the callback function.
     * @param {string} options.callbackId - The unique callback identifier, used to track the callback.
     * @param {string} options.type - The type of callback, either 'callback' for standard callbacks or 'promise' for Promise-based callbacks.
     * @param {function} options.fn - The callback function to register, invoked when the server responds.
     *   - If the `type` is 'callback', this function is called when the server responds with the result.
     *   - If the `type` is 'promise', this function acts as the `resolve` function for the promise.
     * @param {function} [options.onPending] - The pending callback function to invoke before timeout occurs, if provided.
     * @param {number} [options.pendingTimeout] - The timeout duration (in milliseconds) for triggering the pending callback, if `onPending` is provided.
     * @param {number} options.callbackTimeout - The timeout duration (in milliseconds) for the callback function to be triggered before it's considered a timeout.
     * @returns {void}
     */
    _registerSocketCallback(options) {
        // Destructure the options object to extract callback-related parameters.
        const { callbackId, type, fn, onPending, pendingTimeout, callbackTimeout } = options;
        // Parameter validation: callbackTimeout must be positive integers
        if (!Number.isInteger(callbackTimeout) || callbackTimeout <= 0) {
            throw new Error(
                'Invalid timeout parameters: "callbackTimeout" must be positive integers.'
            );
        }
        // Parameter validation: if "pendingTimeout" is provided, it must be a positive integer
        if (pendingTimeout !== undefined && (!Number.isInteger(pendingTimeout) || pendingTimeout <= 0)) {
            throw new Error('"pendingTimeout" must be a positive integer if provided.');
        }

        // Set the callback timeout, and invoke the appropriate error callback based on the type.
        const timeoutId = setTimeout(() => {
            if (type === 'callback') {
                fn({
                    error: `Is callback timeout: ${callbackId}`,
                    errorCode: 'CALLBACK_TIMEOUT'
                }, null);
            } else if (type === 'promise') {
                fn({
                    success: false,
                    error: `Is promise callback timeout: ${callbackId}`,
                    errorCode: 'CALLBACK_TIMEOUT'
                });
            }
            delete this.socketCallbacks[callbackId];
        }, callbackTimeout);

        // If there is a pending callback and the pending timeout is less than the maximum timeout, set a pending timer.
        let pendingTimer = null;
        if (onPending && typeof onPending === 'function' && pendingTimeout < callbackTimeout) {
            pendingTimer = setTimeout(() => {
                onPending();
            }, pendingTimeout);
        }
    
        // Store the callback, timeout ID, and pending timer in the `socketCallbacks` object.
        this.socketCallbacks[callbackId] = {
            [type === 'callback' ? 'callback' : 'resolve']: fn,
            timeoutId,
            pendingTimer,
        };
    }

    /**
     * Generates a unique callback ID.
     * 
     * The callback ID consists of:
     * 1. The current timestamp (in milliseconds).
     * 2. A randomly generated string to ensure uniqueness.
     * 3. An incremental counter to avoid collisions in high-frequency calls within the same millisecond.
     * 
     * @returns {string} - The generated unique callback ID.
     */
    _generateCallbackId() {
        this._callbackIdCounter = (this._callbackIdCounter || 0) + 1;
        return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}-${this._callbackIdCounter.toString(36)}`;
    }

    /**
     * Attempts to reconnect the WebSocket connection.
     * 
     * This method first checks if the maximum reconnect attempts have been reached, if reconnection is locked, or if reconnection is forbidden.
     * Then, depending on the current reconnect attempt count, it uses different strategies for reconnection, including fast reconnect and exponential backoff (with jitter to avoid reconnect competition).
     * Finally, it starts a timer to perform the reconnection, ensuring that only one timer is active at any given time.
     * @param {boolean} [repeatReset] - // Whether to reset the current retry count to 0 on each reconnection attempt; default is false
     * 
     * @returns {void}
     */
    reconnect(repeatReset = false) {
        // Reset heartbeat timer
        this._heartReset();
        if (repeatReset) this.repeat = 0;

        // If autoReconnect is disabled in the options, reconnection is locked or forbidden. exit directly.
        // if (!this.options.autoReconnect || this.lockReconnect || this.forbidReconnect) return;

        if (this.lockReconnect || this.forbidReconnect) return;
       
        // Check if the maximum reconnect attempts have been reached.
        if (this.options.repeatLimit !== null && typeof this.options.repeatLimit === 'number' && this.options.repeatLimit <= this.repeat) {
            // Trigger the listener when the maximum reconnection attempts are reached.
            this._executeListeners("repeat-limit", this.options.repeatLimit);
            return;
        }

        // If the current WebSocket instance exists, close it first
        if (this.ws) {
            // Unbind all WebSocket event listeners.
            // Unbinding events like onopen/onmessage/onerror/onclose prevents callbacks from firing after the connection is closed,
            // avoiding memory leaks or unexpected behavior.
            ['onopen', 'onmessage', 'onerror', 'onclose'].forEach(event => {
                this.ws[event] = null;
            });

            // Check the current connection state and safely close the WebSocket.
            // Only call close() when the connection state is CONNECTING or OPEN to avoid exceptions when closing an already closed or closing connection.
            if ([WebSocket.CONNECTING, WebSocket.OPEN].includes(this.ws.readyState)) {
                // Use a custom close code (recommended range: 4000–4999) and reason string when manually closing the connection
                this.ws.close(4001, 'client manual close');
            }

            // Manually set this.ws to null.
            // After closing the WebSocket connection, explicitly set this.ws to null.
            // This serves two purposes:
            // Release the reference to the old WebSocket instance to help garbage collection (GC) clean up memory.
            // Clearly mark that this.ws is disconnected during the reconnect cycle to avoid misoperations.
            this.ws = null;
        }
        // Lock the reconnection to prevent multiple reconnection timers from running simultaneously.
        this.lockReconnect = true;
        this.repeat++;
        let timeout;
        if (this.repeat <= this.options.fastReconnectThreshold) {
            // Fast reconnect strategy.
            timeout = this.options.fastReconnectInterval;
        } else {

            // Exponential backoff strategy + jitter to avoid competition when multiple clients are reconnecting.
            let baseTimeout = Math.pow(2, this.repeat - this.options.fastReconnectThreshold) * this.options.fastReconnectInterval;

            // Jitter adds random delay to avoid reconnection competition.
            let jitter = Math.random() * this.options.fastReconnectInterval;

            // Ensure the timeout does not exceed the maximum reconnect interval.
            timeout = Math.min(baseTimeout + jitter, this.options.reconnectMaxInterval);

            // Ensure timeout is not negative and greater than or equal to the minimum reconnect interval.
            timeout = Math.max(timeout, this.options.fastReconnectInterval);

            // Round timeout to ensure it is an integer (milliseconds).
            timeout = Math.floor(timeout);
        }

        // Trigger the reconnect event, passing the current reconnect attempt count (repeat)
        // and the timeout value (in milliseconds) indicating when the reconnection should actually be triggered.
        this._executeListeners("reconnect", { repeat: this.repeat, timeout });

        // The lockReconnect flag ensures the uniqueness of reconnection, preventing multiple timers in the same reconnect cycle.
        // Using lockReconnect to prevent setting multiple timers, ensuring that only one timer is active during each reconnect attempt.
        // But it is possible to manually reconnect during the reconnection period, so a timer needs to be stored
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this._createWebSocket();
            this.lockReconnect = false;
        }, timeout)
    }

    /**
     * Determines if the WebSocket is currently reconnecting automatically.
     * 
     * If `this.repeat` is greater than 0, it indicates that the WebSocket is in the process of reconnecting.
     * 
     * @returns {boolean} Returns `true` if the WebSocket is reconnecting, otherwise `false`.
     */
    reconnecting() {
        return this.repeat > 0;
    }


    /**
     * Reset and start the heartbeat mechanism.
     * 
     * This method first calls `_heartReset()` to reset the heartbeat, then calls `_heartStart()` to start the heartbeat.
     * 
     * @returns {void}
     */
    _heartCheck() {
        this._heartReset();
        this._heartStart();
    }

    /**
     * Starts the WebSocket heartbeat mechanism and periodically sends a ping message to check the connection status.
     * 
     * This method sends a ping message to the server at regular intervals, and expects a pong message in return to verify the connection.
     * If no response is received within a specified time, it considers the connection closed and closes the WebSocket.
     * 
     * @returns {void}
     */
    _heartStart() {
        // If reconnection is forbidden, do not perform heartbeat.
        if (this.forbidReconnect) return;
        
        this.pingTimer = setTimeout(() => {
            // Send a ping message, the server will return a pong message to confirm the connection.
            this._executeListeners("ping");
            this.pingGoTime = (new Date()).getTime();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(this.options.pingMsg);
            }
            
            // If no pong response is received within the specified time, the connection might be closed, and we handle it.
            this.pongTimer = setTimeout(() => {
                // Trigger the listener when pong timeout occurs.
                this._executeListeners("pong-timeout");
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close(4002, 'pong timeout');
                }
            }, this.options.pongTimeout);
        }, this.options.pingInterval);
    }

    /**
     * Resets the WebSocket heartbeat status by clearing the ping and pong timeout timers.
     * 
     * This method clears both the ping sending timer and the pong waiting timer.
     * 
     * @returns {void}
     */
    _heartReset() {
        if (this.pingTimer) clearTimeout(this.pingTimer);
        if (this.pongTimer) clearTimeout(this.pongTimer);
    }

    /**
     * Set the ping interval for the heartbeat mechanism.
     * @param {number} newInterval - The new ping interval in milliseconds. Must be a positive number.
     * @param {boolean} [immediate=false] - Whether to apply the new interval immediately by clearing the current timer.
     *                                     If true, the heartbeat timer will be reset right away.
     */
    setPingInterval(newInterval, immediate = false) {
        if (typeof newInterval !== 'number' || newInterval <= 0) {
            throw new TypeError('pingInterval must be a positive number');
        }
        this.options.pingInterval = newInterval;
        if (immediate && this.pingTimer) {
            clearTimeout(this.pingTimer);
            this._heartStart();
        }
    }

    /**
     * Get the current ping interval configuration.
     * 
     * @returns {number} The ping interval in milliseconds.
     */
    getPingInterval() {
        return this.options.pingInterval;
    }

    /**
     * Manually closes the WebSocket connection and disables the reconnection mechanism.
     * 
     * After manually closing the connection, this method disables automatic reconnection, 
     * clears heartbeat timers, and releases related resource references to speed up memory recycling.
     * 
     * @returns {void}
     */
    manualClose() {
        // Stop automatic reconnection after manually closing the connection.
        this.forbidReconnect = true;

        // Clear the heartbeat timer.
        this._heartReset();

        // Clear the reconnect timer.
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        if (this.ws) {
            // Explicitly remove all event listeners to help accelerate garbage collection.
            ['onopen', 'onmessage', 'onerror', 'onclose'].forEach(event => {
                this.ws[event] = null;
            });

            // Only call close if the connection is in CONNECTING or OPEN state.
            if ([WebSocket.CONNECTING, WebSocket.OPEN].includes(this.ws.readyState)) {
                // Use a custom close code (recommended range: 4000–4999) and reason string when manually closing the connection
                this.ws.close(4001, 'client manual close');
            }

            // Release the ws reference to ensure complete disconnection and memory cleanup.
            this.ws = null;
        }
    }

}

// Check if running in a CommonJS environment (Node.js or bundlers like Webpack, Rollup)
if (typeof module !== 'undefined' && module.exports) {
  // Export as a CommonJS module
  module.exports = WebSocketConnector;
} else if (typeof window !== 'undefined') {
  // Otherwise, if running in a browser environment,
  // expose WebSocketConnector as a global variable on the window object
  window.WebSocketConnector = WebSocketConnector;
}
