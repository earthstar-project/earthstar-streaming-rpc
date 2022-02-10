import {
    RpcError,
    RpcErrorFromMethod,
    RpcErrorUnknownMethod,
    RpcErrorUseAfterClose,
} from './errors.ts';
import { ConnectionOpts, ConnectionStatus, IConnection, ITransport, Thunk } from './types.ts';
import { FnsBag } from './types-bag.ts';
import {
    Envelope,
    EnvelopeNotify,
    EnvelopeRequest,
    EnvelopeResponseWithData,
    EnvelopeResponseWithError,
} from './types-envelope.ts';
import { Watchable } from './watchable.ts';
import { Deferred, makeDeferred, makeId } from './util.ts';

import { logConnection as log } from './log.ts';

export class Connection<BagType extends FnsBag> implements IConnection<BagType> {
    status: Watchable<ConnectionStatus> = new Watchable('CONNECTING' as ConnectionStatus);
    _closeCbs: Set<Thunk> = new Set();

    description: string;
    _transport: ITransport<BagType>;
    _deviceId: string;
    _otherDeviceId: string | null = null;
    _methods: BagType;
    _sendEnvelope: (conn: IConnection<BagType>, env: Envelope<BagType>) => Promise<void>;
    _deferredRequests: Map<string, Deferred<any>> = new Map(); // keyed by env id
    _lastSeen = 0;

    constructor(opts: ConnectionOpts<BagType>) {
        log(`Connection constructor: ${opts.deviceId} "${opts.description}"`);
        this._transport = opts.transport;
        this._deviceId = opts.deviceId;
        this.description = opts.description;
        this._methods = opts.methods;
        this._sendEnvelope = opts.sendEnvelope;
    }

    get isClosed() {
        return this.status.value === 'CLOSED';
    }
    onClose(cb: Thunk): Thunk {
        if (this.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
        this._closeCbs.add(cb);
        return () => this._closeCbs.delete(cb);
    }
    close(): void {
        if (this.isClosed) return;
        log(`${this.description} | closing...`);
        this.status.set('CLOSED');
        for (const cb of this._closeCbs) cb();
        this._closeCbs.clear();
        // the transport is responsible for removing this connection from transport.collections
        log(`${this.description} | ...closed.`);
    }

    async handleIncomingEnvelope(env: Envelope<BagType>): Promise<void> {
        // TODO: maybe this function should be in a lock to ensure it only runs one at a time
        if (this.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
        // TODO: throw error if status is ERROR ?
        log(`${this.description} | incoming envelope:`, env);
        if (env.kind === 'NOTIFY') {
            if (!Object.prototype.hasOwnProperty.call(this._methods, env.method)) {
                // swallow the error - in notify mode there's no place for the error to emerge
                //throw new RpcErrorUnknownMethod(`unknown method in NOTIFY: ${env.method}`);
                console.warn(`> error in NOTIFY handler: no notify method called "${env.method}"`);
            } else {
                try {
                    await this._methods[env.method](...env.args);
                } catch (error) {
                    // the method had an error.
                    // swallow the error - in notify mode there's no place for the error to emerge
                    console.warn(`> error when running NOTIFY method:`, env, error);
                }
            }
        } else if (env.kind === 'REQUEST') {
            try {
                if (!Object.prototype.hasOwnProperty.call(this._methods, env.method)) {
                    throw new RpcErrorUnknownMethod(`unknown method in REQUEST: ${env.method}`);
                }
                const data = await this._methods[env.method](...env.args);
                const responseEnvData: EnvelopeResponseWithData<BagType, keyof BagType> = {
                    kind: 'RESPONSE',
                    fromDeviceId: this._deviceId,
                    envelopeId: env.envelopeId,
                    data,
                };
                await this._sendEnvelope(this, responseEnvData);
            } catch (error) {
                const responseEnvError: EnvelopeResponseWithError = {
                    kind: 'RESPONSE',
                    fromDeviceId: this._deviceId,
                    envelopeId: env.envelopeId,
                    error: `${error}`,
                };
                await this._sendEnvelope(this, responseEnvError);
            }
        } else if (env.kind === 'RESPONSE') {
            // We got a response back, so look up and resolve the deferred we made when we sent the REQUEST
            const deferred = this._deferredRequests.get(env.envelopeId);
            if (deferred === undefined) {
                //console.warn(
                //    `> got a RESPONSE with an envelopeId we did not expect: ${env.envelopeId}`,
                //);
                return;
            }
            if ('data' in env) {
                deferred.resolve(env.data);
            } else if ('error' in env) {
                deferred.reject(new RpcErrorFromMethod(env.error));
            } else {
                console.warn(
                    '> RESPONSE has neither data nor error.  this should never happen',
                );
                deferred.reject(new RpcError('> RESPONSE had neither data nor error??'));
            }
            // Clean up.
            // TODO: eventually clean up orphaned old deferreds that were never answered
            this._deferredRequests.delete(env.envelopeId);
        }
        log(`${this.description} | ...done with incoming envelope`);
    }

    async notify<MethodKey extends keyof BagType>(
        method: MethodKey,
        ...args: Parameters<BagType[MethodKey]>
    ): Promise<void> {
        if (this.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
        const env: EnvelopeNotify<BagType, keyof BagType> = {
            kind: 'NOTIFY',
            fromDeviceId: this._deviceId,
            envelopeId: 'env:' + makeId(),
            method,
            args,
        };
        log(`${this.description} | sending NOTIFY:`, env);
        await this._sendEnvelope(this, env);
        log(`${this.description} | done sending NOTIFY.`);
    }
    async request<MethodKey extends keyof BagType>(
        method: MethodKey,
        ...args: Parameters<BagType[MethodKey]>
    ): Promise<ReturnType<BagType[MethodKey]>> {
        if (this.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
        const env: EnvelopeRequest<BagType, keyof BagType> = {
            kind: 'REQUEST',
            fromDeviceId: this._deviceId,
            envelopeId: 'env:' + makeId(),
            method,
            args,
        };
        // save a deferred for when the response comes back
        const deferred = makeDeferred<any>();
        this._deferredRequests.set(env.envelopeId, deferred);
        log(`${this.description} | sending REQUEST:`, env);
        await this._sendEnvelope(this, env);
        log(`${this.description} | done sending REQUEST.`);
        return deferred.promise;
    }
}
