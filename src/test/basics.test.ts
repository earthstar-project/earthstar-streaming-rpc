import { assert, assertEquals } from './asserts.ts';
import { makeLocalTransportPair, TransportExposedStreams } from '../transport-exposed-streams.ts';

import { EventLog } from './event-log.ts';

//================================================================================

Deno.test('constructors', async () => {
    let e = new EventLog();
    const methods = {
        shout: (s: string) => e.observe('shouted ' + s.toLocaleUpperCase()),
    };
    const { streamAtoB, streamBtoA, transA, transB } = makeLocalTransportPair(methods);
    const connAtoB = transA.connections[0];
    const connBtoA = transB.connections[0];

    e.note('notify...');
    await connAtoB.notify('shout', 'hello world');
    e.expect('shouted HELLO WORLD');
    e.note('...done with notify');

    e.assert();

    transA.close();
});
