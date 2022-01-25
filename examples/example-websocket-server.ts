import { serve } from 'https://deno.land/std@0.123.0/http/mod.ts';
import { makeId, sleep, TransportWebsocketServer } from '../mod.ts';

//import { logMain as log } from './src/log.ts';
const log = console.log;

const main = async () => {
    log('----------------------------------------');
    log('setting up basic variables');

    const deviceId = 'server:' + makeId();
    const methods = {
        shout: (s: string) => console.log(`!! ${s.toLocaleUpperCase()} !!`),
        hello: (name: string) => `hello ${name}!`,
        add: (x: number, y: number) => x + y,
    };
    const port = 8008;
    const path = '/earthstar-api/v2/ws';
    const serverUrl = `ws://localhost:${port}${path}`;
    log('|   deviceId:', deviceId);
    log('|   methods:', Object.keys(methods));
    log('|   port:', port);
    log('|   path:', path);
    log('|   serverUrl:', serverUrl);

    log('----------------------------------------');
    log('making TransportWebsocketServer');

    const transportServer = new TransportWebsocketServer({
        deviceId,
        methods,
        url: serverUrl,
    });
    serve(transportServer.reqHandler, { port });

    while (true) {
        const connections = transportServer.connections;
        log('----------------------------------------');
        log('|   server status:', transportServer.status.get());
        log(`|   ${connections.length} connections:`);
        for (const conn of connections) {
            log(`|   |   ${conn.status.get()} - ${conn.description}`);
        }

        /*
        for (let conn of transportServer.connections) {
            try {
                log(`|   notify: shouting to ${conn.description}`);
                await conn.notify('shout', `this is a notify from ${transportServer.deviceId}`);
                log(`|   request: add(10, 20) to ${conn.description}...`);
                let thirty = await conn.request('add', 10, 20);
                log(`|   ...response: ${thirty}`);
            } catch (error) {
                log('|   ...caught an error during notify or request:');
                log(error);
            }
        }
        */

        await sleep(2700);
    }
};
main();
