import { FnsBag } from './types-bag.ts';
import { RpcError, RpcErrorNetworkProblem, RpcErrorUseAfterClose } from './errors.ts';
import { IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable } from './watchable.ts';
import { ensureEndsWith, setImmediate2, sleep, withTimeout } from './util.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

const TIMEOUT = 1000; // TODO: make this configurable

export class TransportHttpClient<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: IConnection<BagType>[] = [];

    constructor(opts: ITransportOpts<BagType>) {
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

    addConnection(url: string): Connection<BagType> {
        url = ensureEndsWith(url, '/');
        log('addConnection to url:', url);

        const conn = new Connection({
            description: url,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            // PUSH
            sendEnvelope: async (conn, env) => {
                // send envelope in its own HTTP POST.
                // TODO: does this work right if it's called multiple times at once?
                // probably conn.status ends up wrong.
                if (conn.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, env);
                log('send...');
                try {
                    conn.status.set('CONNECTING');
                    const urlToPost = url + `from/${this.deviceId}`;
                    log(`send... POSTing to ${urlToPost}`);
                    const res = await withTimeout(
                        TIMEOUT,
                        fetch(urlToPost, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify([env]), // a batch of one envelope
                        }),
                    );
                    if (!res.ok) {
                        log('send... POST was not ok...');
                        throw new RpcErrorNetworkProblem(
                            `a POST to ${urlToPost} resulted in http ${res.status}`,
                        );
                    } else {
                        log('send... success.');
                        conn.status.set('OPEN');
                    }
                } catch (error) {
                    log('send... error.');
                    conn.status.set('ERROR');
                    //console.warn('> sendEnvelope error:', error);
                    // re-throw the error
                    throw error;
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
                    const urlToGet = url + `for/${this.deviceId}`;
                    const response = await withTimeout(TIMEOUT, fetch(urlToGet));
                    if (this.isClosed) return;
                    if (!response.ok) {
                        throw new RpcErrorNetworkProblem('pull thread HTTP response was not ok');
                    }
                    const envs = await response.json();
                    if (!Array.isArray(envs)) throw new RpcError('expected an array');
                    // poll slower when there's nothing there
                    sleepTime = envs.length >= 1 ? QUICK_POLL : SLOW_POLL;

                    // pass envelopes to the connection to handle one at a time
                    conn.status.set('OPEN');
                    log(`got ${envs.length} envelopes`);
                    for (const env of envs) {
                        if (this.isClosed) return;
                        await conn.handleIncomingEnvelope(env);
                    }
                } catch (error) {
                    conn.status.set('ERROR');
                    sleepTime = ERROR_POLL;
                    console.warn('> problem polling for envelopes:', error);
                    // don't re-throw; swallow this error because there's nobody to catch it
                }
                if (this.isClosed) return;
                log(`sleeping ${sleepTime} ms...`);
                await sleep(sleepTime);
                log('...done sleeping.');
                if (this.isClosed) return;
            }
        });

        this.connections.push(conn);
        return conn;
    }
}
