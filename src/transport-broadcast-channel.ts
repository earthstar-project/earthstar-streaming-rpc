import { RpcErrorUseAfterClose } from './errors.ts';
import { FnsBag } from './types-bag.ts';
import { IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

type TransportMessage<BagType extends FnsBag> = {
    forDeviceId: string;
    envelope: Envelope<BagType>;
} | { deviceId: string };

function isEnvelopeMessage<BagType extends FnsBag>(message: TransportMessage<BagType>): message is {
    forDeviceId: string;
    envelope: Envelope<BagType>;
} {
    if ('envelope' in message) {
        return true;
    }

    return false;
}

export interface ITransportBroadcastChannelOpts<BagType extends FnsBag>
    extends ITransportOpts<BagType> {
    /** The channel for this transport's BroadcastChannel instance to join. */
    channel: string;
}

/** A Transport that connects to other transports using the same BroadcastChannel channel in other tabs or windowns on the same machine.
 * Many TransportBroadcastChannel can join the same channel to comunicate.
 */
export class TransportBroadcastChannel<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();
    _channel: BroadcastChannel;

    constructor(opts: ITransportBroadcastChannelOpts<BagType>) {
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;

        this._channel = new BroadcastChannel(opts.channel);

        const onEvent = (event: MessageEvent<TransportMessage<BagType>>) => {
            // If the event contains envelope data...
            if (isEnvelopeMessage(event.data)) {
                // Make sure we're the intnded recipient...
                if (event.data.forDeviceId === this.deviceId) {
                    const connection = this._addOrGetConnection(event.data.envelope.fromDeviceId);
                    // ... and handle it.
                    connection.handleIncomingEnvelope(event.data.envelope);
                }
                // This envelope wasn't for us!
                return;
            }

            // This was just another TransportBroadcastChannel telling us it exists.
            this._addOrGetConnection(event.data.deviceId);
        };

        this._channel.addEventListener('message', onEvent);

        this.onClose(() => {
            this._channel.close();
            this._channel.removeEventListener('message', onEvent);
        });

        this.register();
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

    /** Ping other transports on the same BroadcastChannel to make them create a connection to this one. */
    register() {
        log(`Registering ${this.deviceId} on "${this._channel.name}"...`);
        this._channel.postMessage({ deviceId: this.deviceId });
    }

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
            sendEnvelope: (_conn, envelope) => {
                if (conn.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, envelope);
                log('send...');

                conn.status.set('CONNECTING');

                // Send the envelope along with an ID indicating the intended recipient.
                this._channel.postMessage({ envelope, forDeviceId: otherDeviceId });

                return Promise.resolve();
            },
        });

        conn.onClose(() => {
            this.connections.delete(conn);
        });

        conn._otherDeviceId = otherDeviceId;
        conn._lastSeen = Date.now();
        conn.status.set('OPEN');

        this.connections.add(conn);
        return conn;
    }
}
