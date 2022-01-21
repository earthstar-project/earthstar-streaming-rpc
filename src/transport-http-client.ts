import { Fn, IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable } from './watchable.ts';
import { setImmediate2, sleep } from './util.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export class TransportHttpClient implements ITransport {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];

    constructor(opts: ITransportOpts) {
        log('constructor for device', opts.deviceId);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
    }

    get isClosed() {
        return this.status.value === 'CLOSED';
    }
    onClose(cb: Thunk): Thunk {
        return this.status.onChangeTo('CLOSED', cb);
    }

    close(): void {
        if (this.isClosed) return;

        log('closing...');
        this.status.set('CLOSED');

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
                    conn.status.set('CONNECTING');
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
                        conn.status.set('OPEN');
                    }
                } catch (error) {
                    log('send... error.');
                    conn.status.set('ERROR');
                    console.warn('> sendEnvelope error:', error);
                }
            },
        });

        // times we should wait in different conditions
        const QUICK_POLL = 10; // got good data, try again right away
        const SLOW_POLL = 1000; // got no data, slow down
        const ERROR_POLL = 3000; // got an error, back off

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
                    conn.status.set('OPEN');
                    for (const env of envs) {
                        if (this.isClosed) return;
                        await conn.handleIncomingEnvelope(env);
                    }
                } catch (error) {
                    conn.status.set('ERROR');
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
