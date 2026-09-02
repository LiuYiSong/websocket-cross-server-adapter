'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const WebSocketCrossServerAdapter = require('../src/WebSocketCrossServerAdapter');

function makeFakeSocket() {
    return { readyState: WebSocket.OPEN, send: () => {} };
}

// Deterministic, fast window testing without real sleeps: temporarily
// override Date.now for the duration of the callback.
function withMockedNow(startTime, fn) {
    const realNow = Date.now;
    let current = startTime;
    Date.now = () => current;
    try {
        return fn((ms) => { current += ms; });
    } finally {
        Date.now = realNow;
    }
}

describe('_checkRateLimit (per-socket inbound WebSocket message rate limiting)', () => {
    test('allows messages at or below the configured limit', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 5 });
        const socket = makeFakeSocket();
        withMockedNow(1_000_000, () => {
            for (let i = 0; i < 5; i++) {
                assert.equal(adapter._checkRateLimit(socket), true);
            }
        });
    });

    test('drops messages once the limit is exceeded within the same window', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 3 });
        const socket = makeFakeSocket();
        withMockedNow(1_000_000, () => {
            assert.equal(adapter._checkRateLimit(socket), true);
            assert.equal(adapter._checkRateLimit(socket), true);
            assert.equal(adapter._checkRateLimit(socket), true);
            assert.equal(adapter._checkRateLimit(socket), false); // 4th in-window message
            assert.equal(adapter._checkRateLimit(socket), false);
        });
    });

    test('resets the count once the ~1s window elapses', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 2 });
        const socket = makeFakeSocket();
        withMockedNow(1_000_000, (advance) => {
            assert.equal(adapter._checkRateLimit(socket), true);
            assert.equal(adapter._checkRateLimit(socket), true);
            assert.equal(adapter._checkRateLimit(socket), false);
            advance(1000);
            assert.equal(adapter._checkRateLimit(socket), true);
        });
    });

    test('tracks each socket independently', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 1 });
        const socketA = makeFakeSocket();
        const socketB = makeFakeSocket();
        withMockedNow(1_000_000, () => {
            assert.equal(adapter._checkRateLimit(socketA), true);
            assert.equal(adapter._checkRateLimit(socketA), false); // A exhausted
            assert.equal(adapter._checkRateLimit(socketB), true);  // B unaffected
        });
    });

    test('rateLimit is configurable via constructor options', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 10 });
        assert.equal(adapter.rateLimit, 10);
    });

    test('rateLimit: 0 disables limiting entirely', () => {
        const adapter = new WebSocketCrossServerAdapter({ rateLimit: 0 });
        const socket = makeFakeSocket();
        withMockedNow(1_000_000, () => {
            for (let i = 0; i < 1000; i++) {
                assert.equal(adapter._checkRateLimit(socket), true);
            }
        });
    });

    test('defaults to 100 messages/sec when rateLimit is not specified', () => {
        const adapter = new WebSocketCrossServerAdapter({});
        assert.equal(adapter.rateLimit, 100);
    });
});

describe('inbound message handler wiring (integration, real ws connection)', () => {
    let adapter, client, port;

    before(async () => {
        adapter = new WebSocketCrossServerAdapter({
            wsOptions: { port: 0 },
            rateLimit: 3,
            heartbeatStr: 'PING',
        });
        await new Promise((resolve) => adapter.wss.once('listening', resolve));
        port = adapter.wss.address().port;
        client = new WebSocket(`ws://127.0.0.1:${port}`);
        await new Promise((resolve, reject) => {
            client.once('open', resolve);
            client.once('error', reject);
        });
    });

    after(async () => {
        client.close();
        await new Promise((resolve) => adapter.wss.close(resolve));
    });

    test('heartbeat and business messages share one per-connection budget', async () => {
        let heartbeatReplies = 0;
        client.on('message', (data) => {
            if (data.toString() === 'PING') heartbeatReplies++;
        });

        // limit is 3: send 2 heartbeats + 3 business messages (5 total).
        // Only the first 3 accepted messages (mixed types) should be
        // processed; this proves heartbeats now consume from the same
        // budget business messages do, rather than bypassing it.
        client.send('PING');
        client.send(JSON.stringify({ event: 'noop' }));
        client.send('PING');
        client.send(JSON.stringify({ event: 'noop' }));
        client.send(JSON.stringify({ event: 'noop' }));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Only messages within the shared budget of 3 were processed; since
        // 2 of the first 3 sent were heartbeats, exactly 2 PING replies
        // should have been received (not the 2 that would occur if
        // heartbeats bypassed the limiter and always got a reply).
        assert.equal(heartbeatReplies, 2);
    });
});
