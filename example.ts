import { makeId, TransportHttpClient } from './mod.ts';

const log = (...args: any[]) => console.log('[main]', ...args);

log('setting up basic variables');
const deviceId = makeId();
const methods = {
    hello: (name: string) => `hello ${name}!`,
    add: (x: number, y: number) => x + y,
};
const pubUrls = ['https://localhost:8077'];
log('    deviceId:', deviceId);
log('    methods:', methods);
log('    pubUrls:', pubUrls);

//----------------------------------------

log('instantiating transport');
const transport = new TransportHttpClient({
    deviceId,
    methods,
});
log('adding a connection for each pub url');
for (const url of pubUrls) {
    log('    ', url);
    const conn = transport.addConnection(url);
}

//----------------------------------------

log('calling methods on connections');
for (const conn of transport.connections) {
    log('--- conn:');
    log(conn);
    log('--- calling...');
    await conn.notify('hello', 'world');
    const three = await conn.request('add', 1, 2);
    log('--- result:', three);
}

//----------------------------------------

log('closing');
transport.close();
