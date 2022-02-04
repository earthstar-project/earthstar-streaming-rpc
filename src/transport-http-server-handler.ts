import { FnsBag } from './types-bag.ts';
import { IConnection, ITransport, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { ensureEndsWith } from './util.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { Connection } from './connection.ts';

import { logTransport2 as log } from './log.ts';
import { type OpineRequest, type OpineResponse } from '../deps.ts';

const KEEP_STALE_CONNECTIONS_FOR = 10 * 1000;

export interface ITransportHttpServerHandlerOpts<BagType extends FnsBag> {
    deviceId: string; // id of this device
    methods: BagType;
    //streams: { [method: string]: Fn },

    path?: string; // url path on server, like '/'
}

/** A Transport that connects directly to other Transports via HTTP. */
export class TransportHttpServerHandler<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();
    description: string;
    _path = '/';
    _outgoingBuffer: Map<string, Envelope<BagType>[]> = new Map(); // keyed by other side's deviceId

    constructor(opts: ITransportHttpServerHandlerOpts<BagType>) {
        log(`TransportHttpServer constructor: ${opts.deviceId}`);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this.description = `transport ${opts.deviceId}`;

        if (opts.path) {
            this._path = ensureEndsWith(opts.path, '/');
        }

        // clean up stale connections after a few seconds of not seeing them

        const staleCheckTimer = setInterval(() => {
            log('checking for stale connections');
            const now = Date.now();
            for (const conn of this.connections) {
                if (conn._lastSeen < now - KEEP_STALE_CONNECTIONS_FOR) {
                    log(`    removing stale connection to ${conn._deviceId}`);
                    conn.close(); // this will also remove it from the set
                }
            }
        }, KEEP_STALE_CONNECTIONS_FOR + 1000);
        this.onClose(() => clearInterval(staleCheckTimer));
    }

    handler = async (req: Request): Promise<Response> => {
        const outgoingUrlPattern = new URLPattern({ pathname: `${this._path}for/:otherDeviceId` });
        const incomingUrlPattern = new URLPattern({ pathname: `${this._path}from/:otherDeviceId` });

        if (outgoingUrlPattern.test(req.url)) {
            const otherDeviceId =
                outgoingUrlPattern.exec(req.url)?.pathname.groups['otherDeviceId'];
            log('GET: (outgoing) for device', otherDeviceId);

            if (!otherDeviceId || this.isClosed) {
                // return 404 response
                return new Response('Not Found', {
                    status: 404,
                });
            }

            const envsToSend = this._outgoingBuffer.get(otherDeviceId) ?? [];
            log(`GET: sending ${envsToSend.length} envelopes`);
            this._outgoingBuffer.set(otherDeviceId, []);

            log('GET: done');
            return new Response(JSON.stringify(envsToSend), {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } else if (incomingUrlPattern.test(req.url)) {
            const otherDeviceId =
                incomingUrlPattern.exec(req.url)?.pathname.groups['otherDeviceId'];
            log('POST: (incoming) from device', otherDeviceId);
            if (!otherDeviceId || this.isClosed) {
                return new Response('Not Found', {
                    status: 404,
                });
            }

            const conn = this._addOrGetConnection(otherDeviceId);

            try {
                const bodyJson = await req.json();

                const envs = bodyJson as Envelope<BagType>[];
                if (!envs || !Array.isArray(envs)) {
                    return new Response('Not Found', {
                        status: 404,
                    });
                }
                log(`POST: received ${envs.length} envelopes; handling them with the Connection...`);
                for (const env of envs) {
                    // TODO: fix: if this throws an error it will skip the rest of the envelopes
                    await conn.handleIncomingEnvelope(env);
                }
                log('POST: done');
                return new Response('ok', {
                    status: 200,
                });
            } catch (error) {
                log('server error:', error);
                console.warn('> error in server handler for incoming envelopes', error);
                return new Response('Server error', {
                    status: 500,
                });
            }
        }

        return new Response('Not found', {
            status: 404,
        });
    };

    expressHandler = async (
        req: OpineRequest,
        res: OpineResponse,
        opts?: { abortController: AbortController },
    ) => {
        const origin = `${req.protocol}://${req.get('host')}`;
        const url = new URL(req.url, origin);

        const init: RequestInit = {
            method: req.method,
            headers: createFetchReqHeaders(req.headers),
            signal: opts?.abortController.signal,
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            init.body = JSON.stringify(req.body);
        }

        const request = new Request(url.href, init);

        const response = await this.handler(request);

        res.setStatus(response.status);

        for (const [key, values] of Object.entries(response.headers)) {
            for (const value of values) {
                res.append(key, value);
            }
        }

        if (opts?.abortController.signal.aborted) {
            res.set('Connection', 'close');
        }

        try {
            res.send(await response.json());
        } catch {
            res.end();
        }
    };

    _addOrGetConnection(otherDeviceId: string): IConnection<BagType> {
        for (const conn of this.connections) {
            if (conn._otherDeviceId === otherDeviceId) {
                log('Connection exists already');
                conn._lastSeen = Date.now();
                conn.status.set('OPEN');
                return conn;
            }
        }
        log('Connection does not exist already.  Making a new one.');
        const conn = new Connection({
            description: `connection to ${otherDeviceId}`,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            sendEnvelope: (_conn, env) => {
                // TODO: this should block until the envelope is delivered
                log('conn.sendEnvelope: adding to outgoing buffer');
                const buffer = this._outgoingBuffer.get(otherDeviceId) ?? [];
                buffer.push(env);
                this._outgoingBuffer.set(otherDeviceId, buffer);

                return Promise.resolve();
            },
        });
        conn._otherDeviceId = otherDeviceId;
        conn._lastSeen = Date.now();
        conn.status.set('OPEN');
        conn.onClose(() => {
            log('conn.onClose: clearing outgoing buffer');
            this._outgoingBuffer.delete(conn._otherDeviceId as string);
            this.connections.delete(conn);
        });
        this.connections.add(conn);
        return conn;
    }

    get isClosed() {
        return this.status.value === 'CLOSED';
    }
    onClose(cb: Thunk): Thunk {
        return this.status.onChangeTo('CLOSED', cb);
    }
    close(): void {
        if (this.isClosed) return;

        log(`${this.deviceId} | closing...`);
        this.status.set('CLOSED');

        log(`${this.deviceId} | ...closing connections...`);
        for (const conn of this.connections) {
            conn.close();
        }
        this.connections.clear();
        log(`${this.deviceId} | ...closed`);
    }
}

function createFetchReqHeaders(
    requestHeaders: OpineRequest['headers'],
): Headers {
    const headers = new Headers();

    for (const [key, values] of Object.entries(requestHeaders)) {
        if (values) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, value);
                }
            } else {
                headers.set(key, values);
            }
        }
    }

    return headers;
}
