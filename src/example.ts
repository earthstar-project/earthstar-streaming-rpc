import { makeId, TransportHttpClient } from "../mod.ts";

let log = console.log;

let deviceId = makeId();
let methods = {
    hello: (name: string) => {},
    add: (x: number, y: number) => x + y,
};
let pubUrls = ["https://example.com"];
log("deviceId:", deviceId);
log("pubUrls", pubUrls);

//----------------------------------------

log("setting up transport and adding connections");
let transport = new TransportHttpClient({
    deviceId,
    methods,
});
for (let url of pubUrls) {
    log("    ", url);
    let conn = transport.addConnection(url);
}

//----------------------------------------

log("calling methods on connections");
for (let conn of transport.connections) {
    log("--- conn:");
    log(conn);
    log("--- calling...");
    await conn.notify("hello", "world");
    let three = await conn.request("add", 1, 2);
    log("--- result:", three);
}

//----------------------------------------

log("closing");
transport.close();
