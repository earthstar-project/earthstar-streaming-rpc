import { Fn, IConnection, ITransport, ITransportOpts, Thunk } from './types.ts';
import { ExposedReadableStream, makeExposedStream, setImmediate2 } from './util.ts';
import { Envelope } from './types-envelope.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export interface ITransportWebStreamOpts {
    deviceId: string; // id of this device
    methods: { [methodName: string]: Fn };
    //streams: { [method: string]: Fn },
    description: string;
    inStream: ExposedReadableStream;
    outStream: ExposedReadableStream;
}

/**
 * A transport with a single connection, using an in/out pair of ExposedReadableStreams.
 *
 * This is mostly useful for testing.
 *
 * If either stream ends or is closed, the Transport will be closed (along with its only Connection).
 */
export class TransportExposedStreams implements ITransport {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];
    description: string;
    inStream: ExposedReadableStream;
    outStream: ExposedReadableStream;

    constructor(opts: ITransportWebStreamOpts) {
        log(
            `TransportExposedStreams constructor: ${opts.deviceId} "${opts.description}"`,
        );
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
        this.description = `transport ${opts.description}`;
        this.inStream = opts.inStream;
        this.outStream = opts.outStream;
        this.connections.push(
            new Connection({
                description: `connection from ${opts.description}`,
                transport: this,
                deviceId: this.deviceId,
                methods: this.methods,
                sendEnvelope: async (
                    conn: IConnection,
                    env: Envelope,
                ): Promise<void> => {
                    log(`${this.deviceId} | sending envelope to outStream:`, env);
                    try {
                        await this.outStream.controller.enqueue(env);
                    } catch (error) {
                        log(error);
                        log(
                            `${this.deviceId} | cannot send to outStream, it must be closed.  closing the Transport.`,
                        );
                        this.close();
                    }
                },
            }),
        );
        setImmediate2(async () => {
            log(`${this.deviceId} | starting read thread`);
            const reader = this.inStream.stream.getReader();
            while (true) {
                let { value, done } = await reader.read();
                if (this.isClosed) {
                    log(
                        `${this.deviceId} | transport is closed; ending the read thread.`,
                    );
                }
                if (done) {
                    log(
                        `${this.deviceId} | inStream was closed.  closing the Transport.`,
                    );
                    this.close();
                    return;
                }
                log(`${this.deviceId} | incoming envelope:`, value);
                log(
                    `${this.deviceId} | ...incoming envelope, passing it to the Connection to handle...`,
                );

                await this.connections[0].handleIncomingEnvelope(value);
                log(
                    `${this.deviceId} | ...incoming envelope: Connection is done handling it.`,
                );
                if (this.isClosed) {
                    log(
                        `${this.deviceId} | transport is closed; ending the read thread.`,
                    );
                }
            }
        });
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

        log(`${this.deviceId} | ...closing streams...`);
        try {
            this.inStream.controller.close();
        } catch (error) {}
        try {
            this.outStream.controller.close();
        } catch (error) {}

        log(`${this.deviceId} | ...closing connections...`);
        for (const conn of this.connections.values()) {
            conn.close();
        }
        log(`${this.deviceId} | ...closed`);
    }
}

export let makeLocalTransportPair = (methods: { [methodName: string]: Fn }) => {
    const streamAtoB = makeExposedStream();
    const streamBtoA = makeExposedStream();
    const transA = new TransportExposedStreams({
        deviceId: 'device:A',
        methods,
        description: 'A',
        inStream: streamBtoA,
        outStream: streamAtoB,
    });
    const transB = new TransportExposedStreams({
        deviceId: 'device:B',
        methods,
        description: 'B',
        inStream: streamAtoB,
        outStream: streamBtoA,
    });
    return { streamAtoB, streamBtoA, transA, transB };
};
