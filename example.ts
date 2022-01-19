import { makeId, TransportHttpClient } from './mod.ts';
import { sleep } from './src/util.ts';
import { logMain as log } from './src/log.ts';
import { makeLocalTransportPair } from './src/transportExposedStreams.ts';

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

    log('making local pair of transports');
    const { streamAtoB, streamBtoA, transA, transB } = makeLocalTransportPair(methods);
    const connAtoB = transA.connections[0];
    const connBtoA = transB.connections[0];
    //await sleep(10);

    log('----------------------------------------');

    log('notify');
    await connAtoB.notify('shout', 'hello');

    log('----------------------------------------');

    //log('request');
    //const result = await connAtoB.request('add', 1, 2);
    //log('result =', result);

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

    log('closing transports');
    // closing one will close the other one too (via its connection, via its streams)
    transA.close();
    //transB.close();

    log('----------------------------------------');

    await sleep(50);
};
main();
