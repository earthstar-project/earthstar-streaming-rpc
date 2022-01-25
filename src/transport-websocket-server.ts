import { RpcError, RpcErrorNetworkProblem, RpcErrorUseAfterClose } from './errors.ts';
import { FnsBag } from './types-bag.ts';
import { IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { ensureEndsWith, setImmediate2, sleep, withTimeout } from './util.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export interface ITransportWebsocketServerOpts<BagType extends FnsBag> {
    url: string;
    deviceId: string; // id of this device
    methods: BagType;
    //streams: { [method: string]: Fn },
}

export class TransportWebsocketServer<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();
    _url: string;
    reqHandler: any;

    constructor(opts: ITransportWebsocketServerOpts<BagType>) {
        log('constructor for device', opts.deviceId);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this._url = opts.url;

        this.reqHandler = (req: Request) => {
            log(`${req.method} ${req.url}`);
            if (req.headers.get('upgrade') !== 'websocket') {
                return new Response(null, { status: 501 });
            }
            log('upgrading websocket...');
            const { socket: ws, response } = Deno.upgradeWebSocket(req);
            log('...upgrading websocket: done.');

            const conn = new Connection({
                description: `connection from ?`, // TODO: how to get other device id?  put it in the url again?
                transport: this,
                deviceId: this.deviceId,
                methods: this.methods,
                sendEnvelope: async (conn, env) => {
                    // outgoing message
                    log('conn.sendEnvelope');
                    ws.send(JSON.stringify(env));
                },
            });

            ws.onopen = () => {
                log('>>> ws.onopen');
                this.connections.add(conn);
                conn.status.set('OPEN');
            };

            ws.onmessage = async (m) => {
                // incoming message
                log('>>> ws.onmessage:', m.data);
                conn.status.set('OPEN');
                const env = JSON.parse(m.data);
                log('...ws.onmessage: handling envelope');
                await conn.handleIncomingEnvelope(env);
                log('...ws.onmessage: done');
            };

            ws.onerror = (error) => {
                log(`>>> ws.onerror: ${(error as any).message}`);
                conn.status.set('ERROR');
            };

            ws.onclose = () => {
                log('>>> ws.onclose');
                conn.close();
                this.connections.delete(conn);
            };

            this.onClose(() => {
                ws.close();
                conn.close();
            });

            return response;
        };
    }

    get isClosed() {
        return this.status.value === 'CLOSED';
    }
    onClose(cb: Thunk): Thunk {
        log('transport.onClose(cb) -- registering callback');
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
}
