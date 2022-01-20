import { Fn, IConnection, ITransport, ITransportOpts, Thunk } from './types.ts';
import { Envelope } from './types-envelope.ts';
import { Connection } from './connection.ts';

import { logTransport as log } from './log.ts';

export class TransportHttpClient implements ITransport {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    deviceId: string;
    methods: { [methodName: string]: Fn };
    connections: IConnection[] = [];

    constructor(opts: ITransportOpts) {
        log('constructor for device', opts.deviceId);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
    }

    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;
        log('closing...');
        this.isClosed = true;
        for (const cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        log('...closing connections...');
        for (const conn of this.connections.values()) {
            conn.close();
        }
        log('...closed');
    }

    addConnection(url: string): Connection {
        // TODO: set up http connection
        log('addConnection to url:', url);
        const conn = new Connection({
            description: url,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            sendEnvelope: async (conn: IConnection, env: Envelope) => {
                // send envelope in its own HTTP POST.
                // TODO: does this work right if it's called multiple times at once?
                // probably conn.status ends up wrong.
                if (conn.isClosed) throw new Error('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, env);
                log('send...');
                try {
                    conn.status = 'CONNECTING';
                    log('send... POSTing...');
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(env),
                    });
                    if (!res.ok) {
                        // TODO: error state for connections
                        log('send... POST was not ok...');
                        throw new Error(`a POST to ${url} resulted in http ${res.status}`);
                    } else {
                        log('send... parsing JSON response...');
                        const resJson = await res.json();
                        if (conn.isClosed) throw new Error('the connection is closed');
                        conn.status = 'OPEN';
                        log('send... POST success.  got back:', resJson);
                    }
                } catch (error) {
                    conn.status = 'ERROR';
                    log('send... error');
                    console.warn('sendEnvelope error:', error);
                }
            },
        });
        // TODO: when envs arrive by HTTP, send them to conn.handleIncomingEnvelope
        this.connections.push(conn);
        return conn;
    }
}
