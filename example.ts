import { makeId, TransportHttpClient } from "./mod.ts";

const log = console.log;

const deviceId = makeId();
const methods = {
    hello: (name: string) => `hello ${name}!`,
    add: (x: number, y: number) => x + y,
};
const pubUrls = ["https://example.com"];
log("deviceId:", deviceId);
log("pubUrls", pubUrls);

//----------------------------------------

log("setting up transport and adding connections");
const transport = new TransportHttpClient({
    deviceId,
    methods,
});
for (const url of pubUrls) {
    log("    ", url);
    const conn = transport.addConnection(url);
}

//----------------------------------------

log("calling methods on connections");
for (const conn of transport.connections) {
    log("--- conn:");
    log(conn);
    log("--- calling...");
    await conn.notify("hello", "world");
    const three = await conn.request("add", 1, 2);
    log("--- result:", three);
}

//----------------------------------------

log("closing");
transport.close();
