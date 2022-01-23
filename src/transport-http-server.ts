import { Fn, IConnection, ITransport, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { ensureEndsWith, withTimeout } from './util.ts';
import { Watchable } from './watchable.ts';
import { Connection } from './connection.ts';

import { logTransport2 as log } from './log.ts';

import type { Opine } from '../deps.ts';

const TIMEOUT = 1000; // TODO: make this configurable

export interface ITransportHttpServerOpts {
    deviceId: string; // id of this device
    methods: { [methodName: string]: Fn };
    //streams: { [method: string]: Fn },
    app: Opine;
    path: string; // url path on server, like '/'
}

/**
 * A Transport that connects directly to other Transports in memory, on the same machine.
 *
 * This is mostly useful for testing.
 */
export class TransportHttpServer implements ITransport {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];
    description: string;

    _app: Opine;
    _path: string;
    _outgoingBuffer: Map<string, Envelope[]> = new Map(); // keyed by other side's deviceId

    constructor(opts: ITransportHttpServerOpts) {
        log(`TransportHttpServer constructor: ${opts.deviceId}`);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this.description = `transport ${opts.deviceId}`;
        this._app = opts.app;
        this._path = ensureEndsWith(opts.path, '/');

        // clean up stale connections after a few seconds of not seeing them
        const KEEP_STALE_CONNECTIONS_FOR_MS = 20 * 1000;
        const staleCheckTimer = setInterval(() => {
            log('checking for stale connections');
            const now = Date.now();
            let conns = [...this.connections];
            for (let conn of conns) {
                if (conn._lastSeen < now - KEEP_STALE_CONNECTIONS_FOR_MS) {
                    log(`    removing stale connection to ${conn._deviceId}`);
                    conn.close(); // this will also remove it from the array
                }
            }
        }, KEEP_STALE_CONNECTIONS_FOR_MS + 1000);
        this.onClose(() => clearInterval(staleCheckTimer));

        // outgoing
        this._app.get(this._path + 'for/:otherDeviceId', (req, res) => {
            const otherDeviceId = req.params.otherDeviceId;
            log('GET: (outgoing) for device', otherDeviceId);
            if (this.isClosed) res.sendStatus(404);

            const conn = this._addOrGetConnection(otherDeviceId);

            const envsToSend = this._outgoingBuffer.get(otherDeviceId) ?? [];
            log(`GET: sending ${envsToSend.length} envelopes`);
            this._outgoingBuffer.set(otherDeviceId, []);
            res.json(envsToSend);
            log('GET: done');
        });

        // incoming
        this._app.post(this._path + 'from/:otherDeviceId', async (req, res) => {
            const otherDeviceId = req.params.otherDeviceId;
            log('POST: (incoming) from device', otherDeviceId);
            if (this.isClosed) res.sendStatus(404);

            const conn = this._addOrGetConnection(otherDeviceId);

            try {
                const envs = req.body as Envelope[];
                if (!envs || !Array.isArray(envs)) res.sendStatus(400);
                log(`POST: received ${envs.length} envelopes; handling them with the Connection...`);
                for (const env of envs) {
                    await conn.handleIncomingEnvelope(env);
                }
                res.sendStatus(200);
                log('POST: done');
            } catch (error) {
                log('server error:', error);
                return;
            }
        });
    }

    _addOrGetConnection(otherDeviceId: string): IConnection {
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
            sendEnvelope: async (conn, env) => {
                // TODO: this should block until the envelope is delivered
                log('conn.sendEnvelope: adding to outgoing buffer');
                const buffer = this._outgoingBuffer.get(otherDeviceId) ?? [];
                buffer.push(env);
                this._outgoingBuffer.set(otherDeviceId, buffer);
            },
        });
        conn._otherDeviceId = otherDeviceId;
        conn._lastSeen = Date.now();
        conn.status.set('OPEN');
        conn.onClose(() => {
            log('conn.onClose: clearing outgoing buffer');
            this._outgoingBuffer.delete(conn._otherDeviceId as string);
            this.connections = this.connections.filter((c) => c !== conn);
        });
        this.connections.push(conn);
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
        log(`${this.deviceId} | ...closed`);
    }
}
