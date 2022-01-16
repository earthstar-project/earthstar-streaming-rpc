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

export type EnvelopeKind =
    | "NOTIFY"
    | "REQUEST"
    | "RESPONSE";

export interface EnvelopeNotify {
    kind: "NOTIFY";
    fromScribeID: string;
    envelopeId: string;
    method: string;
    args: any[];
}
export interface EnvelopeRequest {
    kind: "REQUEST";
    fromScribeId: string;
    envelopeId: string;
    method: string;
    args: any[];
}
export interface EnvelopeResponseWithData {
    kind: "RESPONSE";
    fromScribeId: string;
    envelopeId: string;
    data: any;
}
export interface EnvelopeResponseWithError {
    kind: "RESPONSE";
    fromScribeId: string;
    envelopeId: string;
    error: string;
}
export type EnvelopeResponse =
    | EnvelopeResponseWithData
    | EnvelopeResponseWithError;

export type Envelope =
    | EnvelopeNotify
    | EnvelopeRequest
    | EnvelopeResponseWithData
    | EnvelopeResponseWithError;
