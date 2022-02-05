import { ITransportHttpServerOpts, TransportHttpServer } from './transport-http-server.ts';
import { FnsBag } from './types-bag.ts';
import { json, Opine, OpineRequest, OpineResponse } from 'https://deno.land/x/opine@2.1.1/mod.ts';

export interface ITransportHttpServerOpineOpts<BagType extends FnsBag>
    extends ITransportHttpServerOpts<BagType> {
    app: Opine;
}

export class TransportHttpServerOpine<BagType extends FnsBag> extends TransportHttpServer<BagType> {
    constructor(opts: ITransportHttpServerOpineOpts<BagType>) {
        super(opts);

        opts.app.use(json());
        opts.app.all('*', (req, res) => {
            this._opineHandler(req, res);
        });
    }

    _opineHandler = async (
        req: OpineRequest,
        res: OpineResponse,
        opts?: { abortController: AbortController },
    ) => {
        const origin = `${req.protocol}://${req.get('host')}`;
        const url = new URL(req.url, origin);

        const init: RequestInit = {
            method: req.method,
            headers: createFetchReqHeaders(req.headers),
            signal: opts?.abortController.signal,
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            init.body = JSON.stringify(req.body);
        }

        const request = new Request(url.href, init);

        const response = await this.handler(request);

        res.setStatus(response.status);

        for (const [key, values] of Object.entries(response.headers)) {
            for (const value of values) {
                res.append(key, value);
            }
        }

        if (opts?.abortController.signal.aborted) {
            res.set('Connection', 'close');
        }

        try {
            res.send(await response.json());
        } catch {
            res.end();
        }
    };
}

function createFetchReqHeaders(
    requestHeaders: OpineRequest['headers'],
): Headers {
    const headers = new Headers();

    for (const [key, values] of Object.entries(requestHeaders)) {
        if (values) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    headers.append(key, value);
                }
            } else {
                headers.set(key, values);
            }
        }
    }

    return headers;
}
