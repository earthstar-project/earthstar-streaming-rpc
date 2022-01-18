import { ConnectionOpts, Fn, IConnection, ITransport, Thunk } from "./types.ts";
import { Envelope, EnvelopeNotify, EnvelopeRequest } from "./types-envelope.ts";
import { makeId } from "./util.ts";

export class Connection implements IConnection {
    isClosed: boolean = false;
    _closeCbs: Set<Thunk> = new Set();
    transport: ITransport;
    deviceId: string;
    otherDeviceId: string | null = null;
    methods: { [methodName: string]: Fn };
    description: string;
    _sendEnvelope: (env: Envelope) => Promise<void>;

    constructor(opts: ConnectionOpts) {
        this.transport = opts.transport;
        this.deviceId = opts.deviceId;
        this.description = opts.description;
        this.methods = opts.methods;
        this._sendEnvelope = opts.sendEnvelope;
    }

    async handleIncomingEnvelope(env: Envelope): Promise<void> {
        // TODO: handle incoming NOTIFY: call the method
        // TODO: handle incoming REQUEST: call the method and send out a RESPONSE envelope
        // TODO: handle incoming RESPONSE: resolve a Deferred
    }

    async notify(method: string, ...args: any[]): Promise<void> {
        if (this.isClosed) throw new Error("connection is closed");
        let env: EnvelopeNotify = {
            kind: "NOTIFY",
            fromDeviceId: this.deviceId,
            envelopeId: makeId(),
            method,
            args,
        };
        await this._sendEnvelope(env);
    }
    async request(method: string, ...args: any[]): Promise<any> {
        if (this.isClosed) throw new Error("connection is closed");
        let env: EnvelopeRequest = {
            kind: "REQUEST",
            fromDeviceId: this.deviceId,
            envelopeId: makeId(),
            method,
            args,
        };
        // TODO: make a Deferred and add it to a list to be handled in handleIncomingEnvelope
    }

    onClose(cb: Thunk): Thunk {
        if (this.isClosed) throw new Error("connection is closed");
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;
        this.isClosed = true;
        for (let cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        this.transport.connections = this.transport.connections.filter(
            (c) => c !== this,
        );
    }
}
