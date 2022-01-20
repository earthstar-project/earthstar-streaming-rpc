import { Fn, IConnection, ITransport, ITransportOpts, Thunk } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { setImmediate2, sleep } from './util.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export class TransportHttpClient implements ITransport {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];

    constructor(opts: ITransportOpts) {
        log('constructor for device', opts.deviceId);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
    }

    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;
        log('closing...');
        this.isClosed = true;
        for (const cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        log('...closing connections...');
        for (const conn of this.connections) {
            conn.close();
        }
        log('...closed');
    }

    addConnection(url: string): Connection {
        log('addConnection to url:', url);

        const conn = new Connection({
            description: url,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            // PUSH
            sendEnvelope: async (conn: IConnection, env: Envelope) => {
                // send envelope in its own HTTP POST.
                // TODO: does this work right if it's called multiple times at once?
                // probably conn.status ends up wrong.
                if (conn.isClosed) throw new Error('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, env);
                log('send...');
                try {
                    conn.status = 'CONNECTING';
                    log('send... POSTing...');
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(env),
                    });
                    if (!res.ok) {
                        log('send... POST was not ok...');
                        throw new Error(`a POST to ${url} resulted in http ${res.status}`);
                    } else {
                        log('send... parsing JSON response...');
                        const resJson = await res.json();
                        if (conn.isClosed) throw new Error('the connection is closed');
                        log('send... POST success.  got back:', resJson);
                        conn.status = 'OPEN';
                    }
                } catch (error) {
                    log('send... error.');
                    conn.status = 'ERROR';
                    console.warn('> sendEnvelope error:', error);
                }
            },
        });

        // times we should wait in different conditions
        const QUICK_POLL = 10; // got good data, try again right away
        const SLOW_POLL = 1500; // got no data, slow down
        const ERROR_POLL = 5000; // got an error, back off

        // PULL
        // Poll for a batch (array) of new envs by HTTP GET and send them to conn.handleIncomingEnvelope
        // This loop ends when conn.status is CLOSED.
        setImmediate2(async () => {
            while (!this.isClosed) {
                log('----- pull thread...');
                let sleepTime = QUICK_POLL;
                try {
                    // fetch (with lots of checks for closure happening during a fetch)
                    if (this.isClosed) return;
                    const response = await fetch(url);
                    if (this.isClosed) return;
                    if (!response.ok) throw new Error();
                    const envs = await response.json();
                    if (!Array.isArray(envs)) throw new Error('expected an array');
                    // poll slower when there's nothing there
                    sleepTime = envs.length >= 1 ? QUICK_POLL : SLOW_POLL;

                    // pass envelopes to the connection to handle one at a time
                    conn.status = 'OPEN';
                    for (const env of envs) {
                        if (this.isClosed) return;
                        await conn.handleIncomingEnvelope(env);
                    }
                } catch (error) {
                    conn.status = 'ERROR';
                    sleepTime = ERROR_POLL;
                    console.warn('> problem polling for envelopes:', error);
                }
                if (this.isClosed) return;
                await sleep(sleepTime);
                if (this.isClosed) return;
            }
        });

        this.connections.push(conn);
        return conn;
    }
}
