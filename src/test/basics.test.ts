import { assert, assertEquals } from './asserts.ts';
import { makeLocalTransportPair, TransportExposedStreams } from '../transport-exposed-streams.ts';

import { sleep } from '../util.ts';
import { EventLog } from './event-log.ts';

//================================================================================

Deno.test('constructors', async () => {
    const methods = {
        shout: (s: string) => e.observe('shout: ' + s.toLocaleUpperCase()),
        shoutAsync: async (s: string) => {
            await sleep(10);
            e.observe('shoutAsync: ' + s.toLocaleUpperCase());
            await sleep(10);
        },
        alwaysError: (msg: string) => {
            throw new Error(msg);
        },
    };
    const { streamAtoB, streamBtoA, transA, transB } = makeLocalTransportPair(methods);
    const connAtoB = transA.connections[0];
    const connBtoA = transB.connections[0];

    //----------------------------------------
    // notify

    const e = new EventLog();
    e.note('notify...');
    await connAtoB.notify('shout', 'hello world');
    e.expect('shout: HELLO WORLD');
    e.note('...done with notify');

    e.note('notify async...');
    await connAtoB.notify('shoutAsync', 'hello world');
    e.expect('shoutAsync: HELLO WORLD');
    e.note('...done with notify async');

    //----------------------------------------
    // closing

    assert(!transA.isClosed, 'transA is not closed yet');
    assert(!transB.isClosed, 'transB is not closed yet');
    assert(!connAtoB.isClosed, 'connAtoB is not closed yet');
    assert(!connBtoA.isClosed, 'connBtoA is not closed yet');

    transA.close();

    assert(transA.isClosed, 'transA is closed');
    assert(connAtoB.isClosed, 'connAtoB is closed');
    // closure takes a tick to propagate because we're using streams
    await sleep(100);
    assert(transB.isClosed, 'transB is closed');
    assert(connBtoA.isClosed, 'connBtoA is closed');
});
