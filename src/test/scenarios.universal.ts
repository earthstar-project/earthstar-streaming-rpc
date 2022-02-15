import { ITransportScenario } from './scenario-types.ts';
import { FnsBag } from '../types-bag.ts';
import { IConnection, ITransport } from '../types.ts';
import { makeLocalTransportPair } from '../transport-local.ts';
import { TransportBroadcastChannel } from '../transport-broadcast-channel.ts';
import { sleep } from '../util.ts';

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

    prepare() {
        return Promise.resolve();
    }

    teardown() {
        this.clientTransport.close();
        this.serverTransport.close();

        return Promise.resolve();
    }
}

export class TransportBroadcastChannelScenario<BagType extends FnsBag>
    implements ITransportScenario<BagType> {
    name = 'TransportBroadcastChannel';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: TransportBroadcastChannel<BagType>;
    serverTransport: TransportBroadcastChannel<BagType>;
    _andAnotherOne: TransportBroadcastChannel<BagType>;
    constructor(methods: BagType) {
        const clientTransport = new TransportBroadcastChannel({
            methods,
            deviceId: 'bchannel-test-client',
            channel: 'testing',
        });

        const serverTransport = new TransportBroadcastChannel({
            methods,
            deviceId: 'bchannel-test-server',
            channel: 'testing',
        });

        this._andAnotherOne = new TransportBroadcastChannel({
            methods,
            deviceId: 'heheh-test-server',
            channel: 'testing',
        });

        const connAtoB: IConnection<typeof methods> = null as unknown as IConnection<
            typeof methods
        >;
        this.connAtoB = connAtoB;
        const connBtoA: IConnection<typeof methods> = null as unknown as IConnection<
            typeof methods
        >;
        this.connBtoA = connBtoA;

        clientTransport.connections.onAdd((conn) => {
            this.connAtoB = conn;
        });
        serverTransport.connections.onAdd((conn) => {
            this.connBtoA = conn;
        });

        this.clientTransport = clientTransport;
        this.serverTransport = serverTransport;
    }

    async prepare() {
        this.clientTransport.register();
        this.serverTransport.register();
        this._andAnotherOne.register();
        await sleep(10);
    }

    teardown() {
        this.clientTransport.close();
        this.serverTransport.close();
        this._andAnotherOne.close();

        return Promise.resolve();
    }
}
