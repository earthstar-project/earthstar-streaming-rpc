import { ConnectionOpts, Fn, IConnection, ITransport, Thunk } from "./types.ts";
import {
    Envelope,
    EnvelopeNotify,
    EnvelopeRequest,
    EnvelopeResponseWithData,
    EnvelopeResponseWithError,
} from "./types-envelope.ts";
import { Deferred, makeDeferred, makeId } from "./util.ts";

export class Connection implements IConnection {
    isClosed = false;
    _closeCbs: Set<Thunk> = new Set();
    transport: ITransport;
    deviceId: string;
    otherDeviceId: string | null = null;
    methods: { [methodName: string]: Fn };
    description: string;
    _sendEnvelope: (env: Envelope) => Promise<void>;
    _deferredRequests: Map<string, Deferred<any>> = new Map(); // keyed by env id

    constructor(opts: ConnectionOpts) {
        this.transport = opts.transport;
        this.deviceId = opts.deviceId;
        this.description = opts.description;
        this.methods = opts.methods;
        this._sendEnvelope = opts.sendEnvelope;
    }

    async handleIncomingEnvelope(env: Envelope): Promise<void> {
        if (this.isClosed) throw new Error("connection is closed");
        if (env.kind === "NOTIFY") {
            if (!Object.prototype.hasOwnProperty.call(env, env.method)) {
                //error - unknown method -- do nothing because this is a notify
                console.warn(`unknown method in NOTIFY: ${env.method}`);
            } else {
                await this.methods[env.method](...env.args);
            }
        } else if (env.kind === "REQUEST") {
            try {
                if (!Object.prototype.hasOwnProperty.call(env, env.method)) {
                    console.warn(`unknown method in REQUEST: ${env.method}`);
                    throw new Error(`unknown method in REQUEST: ${env.method}`);
                }
                const data = await this.methods[env.method](...env.args);
                const responseEnvData: EnvelopeResponseWithData = {
                    kind: "RESPONSE",
                    fromDeviceId: this.deviceId,
                    envelopeId: env.envelopeId,
                    data,
                };
                if (this.isClosed) throw new Error("connection is closed");
                await this._sendEnvelope(responseEnvData);
            } catch (error) {
                const responseEnvError: EnvelopeResponseWithError = {
                    kind: "RESPONSE",
                    fromDeviceId: this.deviceId,
                    envelopeId: env.envelopeId,
                    error: `${error}`,
                };
                if (this.isClosed) throw new Error("connection is closed");
                await this._sendEnvelope(responseEnvError);
            }
        } else if (env.kind === "RESPONSE") {
            // We got a response back, so look up and resolve the deferred we made when we sent the REQUEST
            const deferred = this._deferredRequests.get(env.envelopeId);
            if (deferred === undefined) {
                console.warn(
                    `got a RESPONSE with an envelopeId we did not expect: ${env.envelopeId}`,
                );
                return;
            }
            if ("data" in env) deferred.resolve(env.data);
            else if ("error" in env) deferred.reject(new Error(env.error));
            else console.warn("RESPONSE has neither data nor error.  this should never happen");
            // Clean up.
            // TODO: eventually clean up orphaned old deferreds that were never answered
            this._deferredRequests.delete(env.envelopeId);
        }
    }

    async notify(method: string, ...args: any[]): Promise<void> {
        if (this.isClosed) throw new Error("connection is closed");
        const env: EnvelopeNotify = {
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
        const env: EnvelopeRequest = {
            kind: "REQUEST",
            fromDeviceId: this.deviceId,
            envelopeId: makeId(),
            method,
            args,
        };
        // save a deferred for when the response comes back
        const deferred = makeDeferred<any>();
        this._deferredRequests.set(env.envelopeId, deferred);
        await this._sendEnvelope(env);
        return deferred.promise;
    }

    onClose(cb: Thunk): Thunk {
        if (this.isClosed) throw new Error("connection is closed");
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }

    close(): void {
        if (this.isClosed) return;
        this.isClosed = true;
        for (const cb of this._closeCbs) cb();
        this._closeCbs = new Set();
        this.transport.connections = this.transport.connections.filter(
            (c) => c !== this,
        );
    }
}
