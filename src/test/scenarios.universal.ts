import { ITransportScenario } from './scenario-types.ts';
import { FnsBag } from '../types-bag.ts';
import { IConnection, ITransport } from '../types.ts';
import { makeLocalTransportPair } from '../transport-local.ts';

export class TransportLocalScenario<BagType extends FnsBag> implements ITransportScenario<BagType> {
    name = 'TransportLocal';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: ITransport<BagType>;
    serverTransport: ITransport<BagType>;
    constructor(methods: BagType) {
        const {
            transA: clientTransport,
            transB: serverTransport,
            thisConn: connAtoB,
            otherConn: connBtoA,
        } = makeLocalTransportPair(methods);

        this.connAtoB = connAtoB;
        this.connBtoA = connBtoA;
        this.clientTransport = clientTransport;
        this.serverTransport = serverTransport;
    }

    teardown() {
        this.clientTransport.close();
        this.serverTransport.close();

        return Promise.resolve();
    }
}
