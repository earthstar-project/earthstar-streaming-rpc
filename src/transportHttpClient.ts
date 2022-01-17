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
        // TODO: methods??
    }

    async addConnection(url: string): Promise<Connection> {
        let conn = new Connection({
            transport: this,
            deviceId: this.deviceId,
            description: url,
            onIncomingEnvelope: async () => {
                // TODO
            },
            onOutgoingEnvelope: async () => {
                // TODO
            },
        });
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
