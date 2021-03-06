import { makeId, sleep, TransportHttpClient, TransportHttpServer } from '../mod.ts';
import { logMain as log } from '../src/log.ts';

const main = async () => {
    log('----------------------------------------');

    log('setting up basic variables');
    const deviceId = makeId();
    const methods = {
        shout: (s: string) => console.log(`!! ${s.toLocaleUpperCase()} !!`),
        hello: (name: string) => `hello ${name}!`,
        add: (x: number, y: number) => x + y,
    };
    log('    deviceId:', deviceId);
    log('    methods:', methods);

    log('----------------------------------------');

    const port = 8008;
    const path = '/earthstar-api/v2/';
    const transServer = new TransportHttpServer({
        deviceId: 'device:server',
        methods,
        path: path,
    });

    log('----------------------------------------');

    const transClient = new TransportHttpClient({
        deviceId: 'device:client1',
        methods,
    });
    const connClientToServer = transClient.addConnection(`http://localhost:${port}${path}`);

    await sleep(3500);

    log('----------------------------------------');
    log('request-response from client to server');

    try {
        const three = await connClientToServer.request('add', 1, 2);
        log('response:', three);
    } catch (error) {
        log('eeeeeeeeeerror');
    }

    await sleep(3500);

    log('----------------------------------------');
    log('request-response from server to client');

    try {
        const connServerToClient = [...transServer.connections][0]; // a hack to get the connection
        const thirty = await connServerToClient.request('add', 10, 20);
        log('response:', thirty);
    } catch (error) {
        log('eeeeeeeeeerror');
    }

    await sleep(3500);

    log('----------------------------------------');

    log('closing client');
    transClient.close();

    log('closing server');
    transServer.close();

    log('----------------------------------------');

    /*
    log('making local pair of transports');
    const {
        thisConn: connAtoB,
        otherConn: connBtoA,
        transA,
        transB,
    } = makeLocalTransportPair(methods);
    //await sleep(10);

    log('----------------------------------------');

    log('notify');
    await connAtoB.notify('shout', 'hello');

    log('----------------------------------------');

    //log('request');
    //const result = await connAtoB.request('add', 1, 2);
    //log('result =', result);
    */

    /*
    log('calling methods on connections');
    for (const conn of transport.connections) {
        log('--- conn:');
        log(conn);
        log('--- notify hello world...');
        await conn.notify('hello', 'world');
        log('--- request add(1,2)...');
        const three = await conn.request('add', 1, 2);
        log('--- result of add:', three);
    }
    */

    log('----------------------------------------');

    /*
    log('closing transports');
    // closing one will close the other one too (via its connection, via its streams)
    transA.close();
    //transB.close();
    */

    log('----------------------------------------');
};
main();
