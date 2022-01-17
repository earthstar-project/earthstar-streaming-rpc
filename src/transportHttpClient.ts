import { IConnection, ITransport, ITransportOpts, Thunk } from "./types.ts";
import { Envelope } from "./types-envelope.ts";
import { Connection } from "./connection.ts";

export class TransportHttpClient implements ITransport {
    isClosed: boolean = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    connections: IConnection[] = [];

    constructor(opts: ITransportOpts) {
        this.deviceId = opts.deviceId;
        // TODO: methods should be saved here and passed into the Connections
    }

    async addConnection(url: string): Promise<Connection> {
        // TODO: set up http connection
        let conn = new Connection({
            transport: this,
            deviceId: this.deviceId,
            description: url,
            sendEnvelope: async (env: Envelope) => {
                // TODO: send over HTTP
                // TODO: check if closed (how to get a pointer to the Connection?)
            },
            // TODO: methods
        });
        // TODO: when envs arrive by HTTP, push them to conn.handleIncomingEnvelope
        this.connections.push(conn);
        return conn;
    }

    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;
        this.isClosed = true;
        for (let cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        for (let conn of this.connections.values()) {
            conn.close();
        }
    }
}
