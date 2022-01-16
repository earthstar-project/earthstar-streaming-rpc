import { Envelope } from "./types-envelope.ts";

export type Thunk = () => void;
export type Fn = (...args: any[]) => any;

/**
 * Options for the Scribe constructor.
 */
export interface IScribeConstructorOpts {
    id?: string; // randomly set if not provided
    methods: { [method: string]: Fn };
    //streams: { [method: string]: Fn },
    postmen?: IPostman[];
}

/**
 * Converts method calls to Envelopes and passes them to a Postman.
 */
export interface IScribe {
    id: string;
    isClosed: boolean;

    addPostman(postman: IPostman): void;

    notify(method: string, ...args: any[]): Promise<void>;
    request(method: string, ...args: any[]): Promise<any>;

    close(): void;
}

/**
 * Manages a specific kind of connection (an HTTP server, etc).
 *
 * Accepts Envelopes and sends them over the appropriate Connection.
 */
export interface IPostman {
    isClosed: boolean;
    connections: Map<string, Connection>; // keyed by scribe id

    send(env: Envelope): Promise<void>;

    close(): void;
}

/**
 * Represents a one-to-one network connection.
 */
export interface Connection {
}
