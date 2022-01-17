/*




let deviceId = makeId();
let methods = {
    add: (x, y) => x + y,
};

let transport = new TransportHttpClient({
    deviceId,
    methods
});
for (let url of pubUrls) {
    conn = transport.connectTo(url);
}

for (let conn of transport.connections) {
    let three = await conn.request('add', 1, 2);
}


conn.close()

transport.close()











*/
