import { assert, assertEquals } from './asserts.ts';
import { IConnection, ITransport } from '../types.ts';
import { FnsBag } from '../types-bag.ts';
import { makeLocalTransportPair } from '../transport-local.ts';
import { TransportHttpClient } from '../transport-http-client.ts';
import { TransportHttpServerHandler } from '../transport-http-server-handler.ts';
import { serve } from 'https://deno.land/std@0.123.0/http/mod.ts';
import { opine, opineJson } from '../../deps.ts';

import { sleep } from '../util.ts';
import { EventLog } from './event-log.ts';

//================================================================================

const makeObservedMethods = (e: EventLog) => {
    return {
        add: (a: number, b: number) => {
            e.observe(`$${a} + ${b} = ${a + b}`);
            return a + b;
        },
        addAsync: async (a: number, b: number) => {
            await sleep(10);
            e.observe(`async: $${a} + ${b} = ${a + b}`);
            await sleep(10);
            return a + b;
        },
        shout: (s: string) => {
            e.observe('shout: ' + s.toLocaleUpperCase());
        },
        shoutAsync: async (s: string) => {
            await sleep(10);
            e.observe('shoutAsync: ' + s.toLocaleUpperCase());
            await sleep(10);
        },
        alwaysError: (msg: string) => {
            e.observe(`alwaysError: ${msg}`);
            throw new Error(msg);
        },
    };
};

async function testConnectionNotify(
    t: Deno.TestContext,
    conn: IConnection<ReturnType<typeof makeObservedMethods>>,
    e: EventLog,
) {
    await t.step({
        name: 'notify',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            e.clear();
            e.note('about to shout');
            await conn.notify('shout', 'hello');
            e.expect('shout: \'HELLO\'');
            e.note('shouted');
            await conn.notify('shoutAsync', 'hello');
        },
    });

    await t.step({
        name: 'notify eith error',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            // When notify's method has an error, it should be swallowed and not returned to us
            // because notify is not supposed to return anything.
            // This will show as a console.warn but that's expected.

            // error in the method call (no such method
            try {
                await conn.notify('nosuch' as unknown as keyof typeof makeObservedMethods);
                assert(true, 'notify should not return errors');
            } catch {
                assert(false, 'notify should not return errors');
            }

            // error in the method
            try {
                await conn.notify('alwaysError', 'Error!');
                assert(true, 'notify should not return errors');
            } catch {
                assert(false, 'notify should not return errors');
            }
        },
    });
}

async function testConnectionRequestResponse(
    t: Deno.TestContext,
    conn: IConnection<ReturnType<typeof makeObservedMethods>>,
    e: EventLog,
) {
    await t.step({
        name: 'request-response',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            const three = await conn.request('add', 1, 2);
            assertEquals(three, 3, 'conn.request returns correct answer');
            const threeAsync = await conn.request('addAsync', 1, 2);
            assertEquals(threeAsync, 3, 'conn.request returns correct answer');
        },
    });

    await t.step({
        name: 'request-response with error',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            // error in the method call (no such method)
            try {
                const three = await conn.request(
                    'nosuch' as unknown as keyof typeof makeObservedMethods,
                );
                assert(false, 'should catch error from unknown method call');
            } catch (error) {
                assert(true, 'should catch error from unknown method call');
            }

            // error in the method
            try {
                const three = await conn.request('alwaysError', 'Error!');
                assert(false, 'should catch error from method call');
            } catch (error) {
                assert(true, 'should catch error from method call');
            }
        },
    });
}

async function testClosingConnection<BagType extends FnsBag>(
    t: Deno.TestContext,
    connAtoB: IConnection<BagType>,
    connBtoA: IConnection<BagType>,
    transA: ITransport<BagType>,
    transB: ITransport<BagType>,
) {
    await t.step({
        name: 'closing things',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: () => {
            assert(!transA.isClosed, 'transA is not closed yet');
            assert(!transB.isClosed, 'transB is not closed yet');
            assert(!connAtoB.isClosed, 'connAtoB is not closed yet');
            assert(!connBtoA.isClosed, 'connBtoA is not closed yet');

            // close one side of the connection, the other side closes, but not the transport
            connAtoB.close();
            assert(!transA.isClosed, 'transA is not closed yet');
            assert(!transB.isClosed, 'transB is not closed yet');
            assert(connAtoB.isClosed, 'connAtoB is closed');

            //TODO: We need a way to close connections remotely?
            //assert(connBtoA.isClosed, 'connBtoA is closed');

            transA.close();
            transB.close();
            assert(transA.isClosed, 'transA is closed');
            assert(transB.isClosed, 'transB is closed');
        },
    });
}

Deno.test('connection behaviour: TransportLocal', async (t) => {
    //----------------------------------------
    // set the stage

    const e = new EventLog();
    const methods = makeObservedMethods(e);
    const {
        transA,
        transB,
        thisConn: connAtoB,
        otherConn: connBtoA,
    } = makeLocalTransportPair(methods);

    //----------------------------------------
    // run the tests

    await testConnectionNotify(t, connAtoB, e);
    await testConnectionRequestResponse(t, connAtoB, e);
    await testClosingConnection(t, connAtoB, connBtoA, transA, transB);
});

Deno.test('connection behaviour: TransportHttp', async (t) => {
    //----------------------------------------
    // set the stage

    const e = new EventLog();
    const methods = makeObservedMethods(e);

    const clientTransport = new TransportHttpClient({ methods, deviceId: 'testclient' });
    const serverTransport = new TransportHttpServerHandler({
        methods,
        deviceId: 'testserver',
    });

    let connBtoA: IConnection<typeof methods> = null as unknown as IConnection<typeof methods>;

    serverTransport.connections.onAdd((conn) => connBtoA = conn);

    const controller = new AbortController();

    const server = serve(serverTransport.handler, {
        hostname: '0.0.0.0',
        port: 1234,
        signal: controller.signal,
    });

    const connAtoB = clientTransport.addConnection('http://localhost:1234');

    await testConnectionNotify(t, connAtoB, e);
    await testConnectionRequestResponse(t, connAtoB, e);

    await testClosingConnection(t, connAtoB, connBtoA, clientTransport, serverTransport);

    serverTransport.close();
    clientTransport.close();
    controller.abort();
    await server;
});

Deno.test('connection behaviour: TransportHttp (w/ Express server)', async (t) => {
    //----------------------------------------
    // set the stage

    const e = new EventLog();
    const methods = makeObservedMethods(e);

    const clientTransport = new TransportHttpClient({ methods, deviceId: 'testclient' });
    const serverTransport = new TransportHttpServerHandler({
        methods,
        deviceId: 'testserver',
    });

    let connBtoA: IConnection<typeof methods> = null as unknown as IConnection<typeof methods>;

    serverTransport.connections.onAdd((conn) => connBtoA = conn);

    const app = opine();
    app.use(opineJson());
    app.all('*', function (req, res) {
        serverTransport.expressHandler(req, res);
    });
    const server = app.listen(
        1234,
    );

    const connAtoB = clientTransport.addConnection('http://localhost:1234');

    await testConnectionNotify(t, connAtoB, e);
    await testConnectionRequestResponse(t, connAtoB, e);

    await testClosingConnection(t, connAtoB, connBtoA, clientTransport, serverTransport);

    serverTransport.close();
    clientTransport.close();
    server.close();

    await sleep(10);
});
