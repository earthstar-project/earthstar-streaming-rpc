import { ITransportHttpServerOpts, TransportHttpServer } from './transport-http-server.ts';
import { FnsBag } from './types-bag.ts';
import {
    Express,
    json,
    Request as ExpressRequest,
    Response as ExpressResponse,
} from 'https://esm.sh/express@4.17.2?dts';

export interface ITransportHttpServerExpressOpts<BagType extends FnsBag>
    extends ITransportHttpServerOpts<BagType> {
    app: Express;
}

export class TransportHttpServerExpress<BagType extends FnsBag>
    extends TransportHttpServer<BagType> {
    constructor(opts: ITransportHttpServerExpressOpts<BagType>) {
        super(opts);

        opts.app.use(json());
        opts.app.all('*', (req, res) => {
            this._expressHandler(req, res);
        });
    }

    _expressHandler = async (
        req: ExpressRequest,
        res: ExpressResponse,
        opts?: { abortController: AbortController },
    ) => {
        const origin = `${req.protocol}://${req.get('host')}`;
        const url = new URL(req.url, origin);

        let body = undefined;

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            body = JSON.stringify(req.body);
        }

        const init = {
            method: req.method,
            headers: createFetchReqHeaders(req.headers),
            signal: opts?.abortController.signal,
            body,
        };

        const request = new Request(url.href, init);

        const response = await this.handler(request);

        res.status(response.status);

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
    requestHeaders: ExpressRequest['headers'],
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
