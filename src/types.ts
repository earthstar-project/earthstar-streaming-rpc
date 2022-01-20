import { Envelope } from './types-envelope.ts';
import { Watchable } from './watchable.ts';

export type Thunk = () => void;
export type Fn = (...args: any[]) => any;

/**
 * Typical options for the Transport constructor.
 *
 * But note that each flavor of Transport will have a slightly different constructor
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
export type TransportStatus = 'OPEN' | 'CLOSED'
export interface ITransport {
    status: Watchable<TransportStatus>;
    isClosed: boolean;

    methods: { [methodName: string]: Fn };
    deviceId: string;
    connections: IConnection[];

    onClose(cb: Thunk): Thunk;
    close(): void;

    // constructor(opts: ITransportOpts)
}

export interface ConnectionOpts {
    description: string;
    transport: ITransport;
    deviceId: string;
    methods: { [methodName: string]: Fn };

    // conn will be "this"
    sendEnvelope: (conn: IConnection, env: Envelope) => Promise<void>;
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
export interface IConnection {
    status: ConnectionStatus;
    _closeCbs: Set<Thunk>;

    description: string;
    _transport: ITransport;
    _deviceId: string;
    _otherDeviceId: string | null; // null until we discover it
    _methods: { [methodName: string]: Fn };

    get isClosed(): boolean;
    onClose(cb: Thunk): Thunk;
    close(): void;

    _sendEnvelope: (conn: IConnection, env: Envelope) => Promise<void>; // the transport provides this function for us

    // constructor(transport: ITransport);

    handleIncomingEnvelope(env: Envelope): Promise<void>;

    notify(method: string, ...args: any[]): Promise<void>;
    request(method: string, ...args: any[]): Promise<any>;
    // TODO: stream
}
