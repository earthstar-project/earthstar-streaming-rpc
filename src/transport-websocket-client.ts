import { RpcError, RpcErrorNetworkProblem, RpcErrorUseAfterClose } from './errors.ts';
import { FnsBag } from './types-bag.ts';
import { IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { ensureEndsWith, setImmediate2, sleep, withTimeout } from './util.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

const CONNECT_TIMEOUT = 2000; // TODO: make this configurable
const RECONNECT_TIMEOUT = 2000;

export class TransportWebsocketClient<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();

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
        log('addConnection to url:', url);

        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch (error) {
            throw new RpcErrorNetworkProblem(error);
        }

        ws.onopen = (e: Event) => {
            log('>>> ws on open');
            conn.status.set('OPEN');
        };

        ws.onmessage = async (e: MessageEvent) => {
            log('>>> ws on message');
            conn.status.set('OPEN');
            let env = JSON.parse(e.data) as Envelope<BagType>;
            log(`>>> ws on message: it\'s a ${env.kind}`);
            log(`>>> ws on message: handling...`);
            await conn.handleIncomingEnvelope(env);
            log(`>>> ws on message: done`);
        };

        ws.onerror = (e: Event) => {
            log('>>> ws on error 2');
            conn.status.set('ERROR');
            //throw new RpcErrorNetworkProblem('could not connect');
            log(`could not connect.  retrying in ${RECONNECT_TIMEOUT} ms...`);
            setTimeout(() => {
                log('reconnecting');
                this.addConnection(url);
            }, RECONNECT_TIMEOUT);
        };

        ws.onclose = (e: CloseEvent) => {
            log('>>> ws on close.  closing the connection.');
            conn.close();
        };

        const conn = new Connection({
            description: url,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            // PUSH
            sendEnvelope: async (conn: IConnection<BagType>, env: Envelope<BagType>) => {
                if (conn.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, env);
                log('waiting for OPEN...');
                await conn.status.waitUntil('OPEN', CONNECT_TIMEOUT);
                log('send...');
                ws.send(JSON.stringify(env));
                log('...done');
            },
        });

        conn.onClose(async () => {
            log('>>> connection onClose.  closing the ws.');
            if (ws.bufferedAmount !== 0) {
                // the websocket still has queued data to send.
                // give it one more moment to finish sending before we close it.
                await sleep(1000);
            }
            ws.close();
            this.connections.delete(conn);
        });

        conn.status.onChange((oldVal, newVal) => {
            log(`connection status changed from ${oldVal} --> ${newVal}`);
        });

        this.connections.add(conn);
        log('...done adding connection');
        return conn;
    }
}
