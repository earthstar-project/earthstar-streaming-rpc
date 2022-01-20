import { makeId, makeLocalTransportPair, sleep, TransportHttpClient } from './mod.ts';
import { logMain as log } from './src/log.ts';

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

    const trans = new TransportHttpClient({
        deviceId: 'device:A',
        methods: methods,
    });
    const conn = trans.addConnection('https://localhost:7777');

    log('----------------------------------------');
    log('request-response');

    try {
        const three = await conn.request('add', 1, 2);
        log('response:', three);
    } catch (error) {
        log('eeeeeeeeeerror');
    }

    log('----------------------------------------');
    log('closing');

    trans.close();

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

    await sleep(50);
};
main();
