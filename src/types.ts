import { Envelope } from "./types-envelope.ts";

export type Thunk = () => void;
export type Fn = (...args: any[]) => any;

/**
 * Options for the Scribe constructor.
 */
export interface ITransportOpts {
    deviceId: string; // id of this device
    methods: { [methodName: string]: Fn };
    //streams: { [method: string]: Fn },
}

/**
 * Manages a specific kind of connection (an HTTP server, etc).
 *
 * Creates Connections.
 */
export interface ITransport {
    isClosed: boolean;
    _closeCbs: Set<Thunk>;
    deviceId: string;
    connections: IConnection[];

    // constructor(opts: ITransportOpts)

    onClose(cb: Thunk): Thunk;
    close(): void;
}

export type OnIncomingEnvelopeCb = (env: Envelope) => Promise<void>;
export type OnOutgoingEnvelopeCb = (env: Envelope) => Promise<void>;

export interface ConnectionOpts {
    transport: ITransport;
    deviceId: string;
    onIncomingEnvelope: OnIncomingEnvelopeCb;
    onOutgoingEnvelope: OnOutgoingEnvelopeCb;
}

/**
 * Converts method calls to Envelopes and passes them to a Postman.
 *
 * Represents a one-to-one network connection.
 */
export interface IConnection {
    isClosed: boolean;
    _closeCbs: Set<Thunk>;
    transport: ITransport;
    deviceId: string;
    otherDeviceId: string | null; // null until we discover it

    // constructor(transport: ITransport);

    notify(method: string, ...args: any[]): Promise<void>;
    request(method: string, ...args: any[]): Promise<any>;
    // TODO: stream

    onClose(cb: Thunk): Thunk;
    close(): void;
}
