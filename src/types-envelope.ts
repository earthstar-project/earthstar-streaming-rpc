//--------------------------------------------------------------------------------
/*
    Either side of a connection can send any of these envelopes in any order,
    but only certain orders will make sense; the rest will be ignored with warnings.

    For example either side can send a REQUEST, and the other side should reply
    with a RESPONSE.

    Expected sequences of envelopes

    * NOTIFY (no response needed)

    * REQUEST --> RESPONSE (with data or with an error)

    * // TODO: stream-related envelopes types: start, cancel, data, end, etc
*/

import { Fn, FnsBag } from './types-bag.ts';

export type EnvelopeKind =
    | 'NOTIFY'
    | 'REQUEST'
    | 'RESPONSE';

export interface EnvelopeNotify<BagType extends FnsBag, Method extends keyof BagType> {
    kind: 'NOTIFY';
    fromDeviceId: string;
    envelopeId: string;
    method: Method;
    args: Parameters<BagType[Method]>;
}
export interface EnvelopeRequest<BagType extends FnsBag, Method extends keyof BagType> {
    kind: 'REQUEST';
    fromDeviceId: string;
    envelopeId: string;
    method: Method;
    args: Parameters<BagType[Method]>;
}
export interface EnvelopeResponseWithData<BagType extends FnsBag, Method extends keyof BagType> {
    kind: 'RESPONSE';
    fromDeviceId: string;
    envelopeId: string;
    data: ReturnType<BagType[Method]>;
}
export interface EnvelopeResponseWithError {
    kind: 'RESPONSE';
    fromDeviceId: string;
    envelopeId: string;
    error: string;
}
export type EnvelopeResponse<BagType extends FnsBag> =
    | EnvelopeResponseWithData<BagType, keyof BagType>
    | EnvelopeResponseWithError;

export type Envelope<BagType extends FnsBag> =
    | EnvelopeNotify<BagType, keyof BagType>
    | EnvelopeRequest<BagType, keyof BagType>
    | EnvelopeResponseWithData<BagType, keyof BagType>
    | EnvelopeResponseWithError;
