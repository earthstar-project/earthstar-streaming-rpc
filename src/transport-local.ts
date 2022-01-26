import { FnsBag } from './types-bag.ts';
import { IConnection, ITransport, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export interface ITransportLocalOpts<BagType extends FnsBag> {
    deviceId: string; // id of this device
    methods: BagType;
    //streams: { [method: string]: Fn },
    description: string;
}

/**
 * A Transport that connects directly to other Transports in memory, on the same machine.
 *
 * This is mostly useful for testing.
 */
export class TransportLocal<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();
    description: string;

    constructor(opts: ITransportLocalOpts<BagType>) {
        log(`TransportLocal constructor: ${opts.deviceId} "${opts.description}"`);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this.description = `transport ${opts.description}`;
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

    addConnection(otherTrans: TransportLocal<BagType>) {
        if (this.isClosed) throw new Error('Can\'t use a transport after it\'s closed');
        // deno-lint-ignore prefer-const
        let thisConn: Connection<BagType>;
        // deno-lint-ignore prefer-consv
        let otherConn: Connection<BagType>;
        thisConn = new Connection({
            description: `conn ${this.deviceId} to ${otherTrans.deviceId}`,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            sendEnvelope: async (conn: IConnection<BagType>, env: Envelope<BagType>) => {
                await otherConn.handleIncomingEnvelope(env);
            },
        });
        otherConn = new Connection({
            description: `conn ${otherTrans.deviceId} to ${this.deviceId}`,
            transport: otherTrans,
            deviceId: otherTrans.deviceId,
            methods: otherTrans.methods,
            sendEnvelope: async (conn: IConnection<BagType>, env: Envelope<BagType>) => {
                await thisConn.handleIncomingEnvelope(env);
            },
        });

        // close one side of the connection, the other side closes
        thisConn.onClose(() => {
            otherConn.close()
            this.connections.delete(thisConn);
        });
        otherConn.onClose(() => thisConn.close());

        this.connections.add(thisConn);
        otherTrans.connections.add(otherConn);

        return { thisConn, otherConn };
    }
}

export function makeLocalTransportPair<BagType extends FnsBag>(methods: BagType) {
    const transA = new TransportLocal({
        deviceId: 'device:A',
        methods,
        description: 'A',
    });
    const transB = new TransportLocal({
        deviceId: 'device:B',
        methods,
        description: 'B',
    });
    const { thisConn, otherConn } = transA.addConnection(transB);
    return { transA, transB, thisConn, otherConn };
}
