import { makeId, sleep, TransportHttpClient } from '../mod.ts';

//import { logMain as log } from './src/log.ts';
const log = console.log;

const main = async () => {
    log('----------------------------------------');
    log('setting up basic variables');
    const deviceId = 'client:' + makeId();
    const methods = {
        shout: (s: string) => console.log(`!! ${s.toLocaleUpperCase()} !!`),
        hello: (name: string) => `hello ${name}!`,
        add: (x: number, y: number) => x + y,
    };
    const port = 8008;
    const path = '/earthstar-api/v2/';
    const serverUrl = `http://localhost:${port}${path}`;
    log('|   deviceId:', deviceId);
    log('|   methods:', Object.keys(methods));
    log('|   port:', port);
    log('|   path:', path);
    log('|   serverUrl:', serverUrl);

    log('----------------------------------------');
    log('making TransportHttpClient and Connection');

    const transportClient = new TransportHttpClient({
        deviceId,
        methods,
    });
    transportClient.connections.onAdd((conn) => {
        log(`onAdd connection: ${conn.description}`);
    });
    transportClient.connections.onDelete((conn) => {
        log(`onDelete connection: ${conn.description}`);
    });
    transportClient.connections.onChange(() => {
        log(`onChange connections`);
    });

    const conn = transportClient.addConnection(serverUrl);

    while (true) {
        log('----------------------------------------');
        log('calling from client to server');
        try {
            log('|   connection status:', conn.status.get());
            log('|   notify: shouting to server...');
            await conn.notify('shout', `this is a notify from ${transportClient.deviceId}`);
            log('|   request: add(1, 2)...');
            const three = await conn.request('add', 1, 2);
            log('|   ...response:', three);
        } catch (error) {
            log('|   ...caught an error during notify or request:');
            log(error);
        }
        await sleep(3000);
    }
};
main();
