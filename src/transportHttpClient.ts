import { Fn, IConnection, ITransport, ITransportOpts, Thunk } from "./types.ts";
import { Envelope } from "./types-envelope.ts";
import { Connection } from "./connection.ts";

export class TransportHttpClient implements ITransport {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];

    constructor(opts: ITransportOpts) {
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
    }

    addConnection(url: string): Connection {
        // TODO: set up http connection
        const conn = new Connection({
            transport: this,
            deviceId: this.deviceId,
            description: url,
            methods: this.methods,
            sendEnvelope: async (env: Envelope) => {
                // send envelope in its own HTTP POST.
                // The caller (from Connection) is responsible for checking if the conn is closed.
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(env),
                });
                if (!res.ok) {
                    // TODO: error state for connections
                    console.warn(`POST to ${url} resulted in http ${res.status}`);
                } else {
                    const resJson = await res.json();
                    console.log("successful POST of an envelope.  got back:", resJson);
                }
            },
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
        for (const cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        for (const conn of this.connections.values()) {
            conn.close();
        }
    }
}
