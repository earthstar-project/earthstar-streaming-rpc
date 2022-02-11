import { FnsBag } from '../types-bag.ts';
import { IConnection, ITransport } from '../types.ts';
import { ITransportScenario } from './scenario-types.ts';
import { TransportHttpClient } from '../transport-http-client.ts';
import { TransportHttpServer } from '../transport-http-server.ts';
import { TransportHttpServerOpine } from '../transport-http-server-opine.ts';
import { TransportWebsocketServer } from '../transport-websocket-server.ts';
import { TransportWebsocketClient } from '../transport-websocket-client.ts';
import { TransportLocalScenario } from './scenarios.universal.ts';

import { sleep } from '../util.ts';
import { serve } from 'https://deno.land/std@0.123.0/http/mod.ts';
import { Opine, opine } from 'https://deno.land/x/opine@2.1.1/mod.ts';

class TransportHttpScenario<BagType extends FnsBag> implements ITransportScenario<BagType> {
    name = 'TransportHttpClient + TransportHttpServer';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: ITransport<BagType>;
    serverTransport: ITransport<BagType>;
    _controller: AbortController;
    _serve: Promise<void>;

    constructor(methods: BagType) {
        const clientTransport = new TransportHttpClient({ methods, deviceId: 'testclient' });
        const serverTransport = new TransportHttpServer({
            methods,
            deviceId: 'testserver',
        });

        // Do a little dance here for Typescript.
        const connBtoA: IConnection<typeof methods> = null as unknown as IConnection<
            typeof methods
        >;
        this.connBtoA = connBtoA;

        serverTransport.connections.onAdd((conn) => this.connBtoA = conn);

        this._controller = new AbortController();

        this._serve = serve(serverTransport.handler, {
            hostname: '0.0.0.0',
            port: 1234,
            signal: this._controller.signal,
        });

        this.connAtoB = clientTransport.addConnection('http://localhost:1234');
        this.connBtoA = connBtoA;
        this.clientTransport = clientTransport;
        this.serverTransport = serverTransport;
    }

    teardown() {
        this.serverTransport.close();
        this.clientTransport.close();
        this._controller.abort();
        return this._serve;
    }
}

class TransportHttpOpineScenario<BagType extends FnsBag> implements ITransportScenario<BagType> {
    name = 'TransportHttpClient + TransportHttpServerOpine';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: ITransport<BagType>;
    serverTransport: ITransport<BagType>;
    _controller: AbortController;
    _server: ReturnType<Opine['listen']>;

    constructor(methods: BagType) {
        const clientTransport = new TransportHttpClient({ methods, deviceId: 'testclient' });

        const app = opine();

        const serverTransport = new TransportHttpServerOpine({
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

        this._controller = new AbortController();

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
        this._controller.abort();
        this._server.close();

        return sleep(10);
    }
}

class TransportWebsocketScenario<BagType extends FnsBag> implements ITransportScenario<BagType> {
    name = 'TransportWebsocketClient + TransportWebsocketServer';
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType> | null = null;
    clientTransport: TransportWebsocketClient<BagType>;
    serverTransport: TransportWebsocketServer<BagType>;
    _controller: AbortController;
    _serve: Promise<void>;

    constructor(methods: BagType) {
        const SERVER_URL = 'ws://localhost:8008';

        this.serverTransport = new TransportWebsocketServer({
            deviceId: 'test-ws-server',
            methods,
            url: SERVER_URL,
        });

        this._controller = new AbortController();

        this.serverTransport.connections.onAdd((conn) => this.connBtoA = conn);

        this._serve = serve(this.serverTransport.reqHandler, {
            hostname: '0.0.0.0',
            port: 8008,
            signal: this._controller.signal,
        });

        this.clientTransport = new TransportWebsocketClient({
            deviceId: 'test-ws-client',
            methods,
        });
        this.connAtoB = this.clientTransport.addConnection(SERVER_URL);
    }

    teardown() {
        this.serverTransport.close();
        this.clientTransport.close();
        this._controller.abort();
        return this._serve;
    }
}

export const scenarios = [
    TransportLocalScenario,
    TransportHttpScenario,
    TransportHttpOpineScenario,
    TransportWebsocketScenario,
];
