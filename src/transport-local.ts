import { Fn, IConnection, ITransport, ITransportOpts, Thunk } from './types.ts';
import { ExposedReadableStream, makeExposedStream, setImmediate2 } from './util.ts';
import { Envelope } from './types-envelope.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export interface ITransportLocalOpts {
    deviceId: string; // id of this device
    methods: { [methodName: string]: Fn };
    //streams: { [method: string]: Fn },
    description: string;
}

/**
 * A transport with a single connection, using an in/out pair of ExposedReadableStreams.
 *
 * This is mostly useful for testing.
 *
 * If either stream ends or is closed, the Transport will be closed (along with its only Connection).
 */
export class TransportLocal implements ITransport {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];
    description: string;

    constructor(opts: ITransportLocalOpts) {
        log(`TransportLocalOpts constructor: ${opts.deviceId} "${opts.description}"`);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this.description = `transport ${opts.description}`;
    }

    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;

        log(`${this.deviceId} | closing...`);
        this.isClosed = true;

        for (const cb of this._closeCbs) cb();
        this._closeCbs = new Set();

        log(`${this.deviceId} | ...closing connections...`);
        for (const conn of this.connections.values()) {
            conn.close();
        }
        log(`${this.deviceId} | ...closed`);
    }

    addConnection(otherTrans: TransportLocal) {
        let thisConn: Connection;
        let otherConn: Connection;
        thisConn = new Connection({
            description: `conn ${this.deviceId} to ${otherTrans.deviceId}`,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            sendEnvelope: async (conn: IConnection, env: Envelope) => {
                await otherConn.handleIncomingEnvelope(env);
            },
        });
        otherConn = new Connection({
            description: `conn ${otherTrans.deviceId} to ${this.deviceId}`,
            transport: otherTrans,
            deviceId: otherTrans.deviceId,
            methods: otherTrans.methods,
            sendEnvelope: async (conn: IConnection, env: Envelope) => {
                await thisConn.handleIncomingEnvelope(env);
            },
        });
        thisConn.onClose(() => otherConn.close());
        otherConn.onClose(() => thisConn.close());
        thisConn.onClose(() => this.close());
        otherConn.onClose(() => otherTrans.close());
        this.connections.push(thisConn);
        otherTrans.connections.push(otherConn);
        return { thisConn, otherConn };
    }
}

export let makeLocalTransportPair = (methods: { [methodName: string]: Fn }) => {
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
};
