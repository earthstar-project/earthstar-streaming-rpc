import { TransportLocalScenario } from './scenarios.universal.ts';
import { FnsBag } from '../types-bag.ts';
import { IConnection, ITransport } from '../types.ts';
import { ITransportScenario } from './scenario-types.ts';
import { TransportHttpClient } from '../transport-http-client.ts';
import { TransportHttpServerExpress } from '../transport-http-server-express.ts';
import { default as express, Express } from 'https://esm.sh/express@4.17.2?dts';
import { sleep } from '../util.ts';

class TransportHttpExpressScenario<BagType extends FnsBag> implements ITransportScenario<BagType> {
    name = 'TransportHttpClient + TransportHttpServerOpine';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: ITransport<BagType>;
    serverTransport: ITransport<BagType>;

    _server: ReturnType<Express['listen']>;

    constructor(methods: BagType) {
        const clientTransport = new TransportHttpClient({ methods, deviceId: 'testclient' });

        const app = express();

        const serverTransport = new TransportHttpServerExpress({
            methods,
            deviceId: 'testserver',
            app,
        });

        // Do a little dance here for Typescript.
        const connBtoA: IConnection<typeof methods> = null as unknown as IConnection<
            typeof methods
        >;
        this.connBtoA = connBtoA;

        serverTransport.connections.onAdd((conn) => this.connBtoA = conn);

        this._server = app.listen(
            1234,
        );

        this.connAtoB = clientTransport.addConnection('http://localhost:1234');

        this.clientTransport = clientTransport;
        this.serverTransport = serverTransport;
    }

    teardown() {
        this.serverTransport.close();
        this.clientTransport.close();
        this._server.close();

        // Have to do this because Express takes a while to wind down.
        // Not doing this would make consecutive tests using express fail.
        // I learned this the hard way.
        return sleep(5000);
    }
}

export const scenarios = [
    //TransportLocalScenario,
    TransportHttpExpressScenario,
];
