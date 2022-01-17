import {
    ConnectionOpts,
    IConnection,
    ITransport,
    OnIncomingEnvelopeCb,
    OnOutgoingEnvelopeCb,
    Thunk,
} from "./types.ts";
import { Envelope, EnvelopeNotify, EnvelopeRequest } from "./types-envelope.ts";
import { makeId } from "./util.ts";

export class Connection implements IConnection {
    isClosed: boolean = false;
    _closeCbs: Set<Thunk> = new Set();
    transport: ITransport;
    deviceId: string;
    otherDeviceId: string | null = null;
    description: string;
    _onIncomingEnvelopeCb: OnIncomingEnvelopeCb;
    _onOutgoingEnvelopeCb: OnOutgoingEnvelopeCb;

    constructor(opts: ConnectionOpts) {
        this.transport = opts.transport;
        this.deviceId = opts.deviceId;
        this.description = opts.description;
        this._onIncomingEnvelopeCb = opts.onIncomingEnvelope;
        this._onOutgoingEnvelopeCb = opts.onOutgoingEnvelope;
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
        await this.send(env);
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
        // TODO: make a Deferred and listen for responses
    }

    async send(env: Envelope): Promise<void> {
        if (this.isClosed) throw new Error("connection is closed");
        await this._onOutgoingEnvelopeCb(env);
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
