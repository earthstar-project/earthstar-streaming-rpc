import {
    default as nodeFetch,
    Headers as NodeHeaders,
    Request as NodeRequest,
    Response as NodeResponse,
} from 'https://esm.sh/node-fetch';

// dnt-shim-ignore
const hasFetch = !!globalThis.fetch;
// dnt-shim-ignore
export const Headers = hasFetch ? globalThis.Headers : NodeHeaders;
// dnt-shim-ignore
export const Request = hasFetch ? globalThis.Request : NodeRequest;
// dnt-shim-ignore
export const Response = hasFetch ? globalThis.Response : NodeResponse;
// dnt-shim-ignore
// dnt-shim-ignore
export default hasFetch ? globalThis.fetch : nodeFetch;
