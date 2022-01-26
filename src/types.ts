import { Envelope } from './types-envelope.ts';
import { Fn, FnsBag } from './types-bag.ts';
import { Watchable } from './watchable.ts';

export type Thunk = () => void;

/**
 * Typical options for the Transport constructor.
 *
 * But note that each flavor of Transport will have a slightly different constructor
 */
export interface ITransportOpts<BagType extends FnsBag> {
    deviceId: string; // id of this device
    methods: BagType;
    //streams: { [method: string]: Fn },
}

/**
 * Manages a specific kind of connection (an HTTP server, etc).
 *
 * Creates Connections.
 */
export type TransportStatus = 'OPEN' | 'CLOSED';
export interface ITransport<BagType extends FnsBag> {
    status: Watchable<TransportStatus>;
    isClosed: boolean;

    methods: BagType;
    deviceId: string;
    connections: IConnection<BagType>[];

    onClose(cb: Thunk): Thunk;
    close(): void;

    // constructor(opts: ITransportOpts)
}

export interface ConnectionOpts<BagType extends FnsBag> {
    description: string;
    transport: ITransport<BagType>;
    deviceId: string;
    methods: BagType;

    // conn will be "this"
    sendEnvelope: (conn: IConnection<BagType>, env: Envelope<BagType>) => Promise<void>;
}

/**
 * Status always starts as CONNECTING, then
 * can switch back and forth between OPEN and ERROR,
 * (or skips OPEN and ERROR completely)
 * and finally ends at CLOSED.
 *
 * ERROR means something failed but it's ok to try again.
 * CLOSED means it's never coming back.
 */
export type ConnectionStatus =
    | 'CONNECTING'
    | 'OPEN'
    | 'ERROR'
    | 'CLOSED';

/**
 * Converts method calls to Envelopes and passes them to a Postman.
 *
 * Represents a one-to-one network connection.
 */
export interface IConnection<
    MethodsType extends FnsBag,
> {
    // TODO: actually connections need to track their incoming and outgoing
    // statuses separately, and then exposed a combined status somehow?
    // What if only one direction has an error?

    status: Watchable<ConnectionStatus>;
    _closeCbs: Set<Thunk>;

    description: string;
    _transport: ITransport<MethodsType>;
    _deviceId: string;
    _otherDeviceId: string | null; // null until we discover it
    _methods: { [methodName: string]: Fn };
    _lastSeen: number;

    get isClosed(): boolean;
    onClose(cb: Thunk): Thunk;
    close(): void;

    _sendEnvelope: (conn: IConnection<MethodsType>, env: Envelope<MethodsType>) => Promise<void>; // the transport provides this function for us

    // constructor(transport: ITransport);

    handleIncomingEnvelope(env: Envelope<MethodsType>): Promise<void>;

    // TODO: maybe this can be synchronous since
    // we don't care about the result --
    // does it wait until sent over the network, or just queued in a batch?
    notify<MethodKey extends keyof MethodsType>(
        method: MethodKey,
        ...args: Parameters<MethodsType[MethodKey]>
    ): Promise<void>;

    // Wait for the return value to come back
    request<MethodKey extends keyof MethodsType>(
        method: MethodKey,
        ...args: Parameters<MethodsType[MethodKey]>
    ): Promise<ReturnType<MethodsType[MethodKey]>>;

    // TODO: stream
}
