import { assert, assertEquals } from './asserts.ts';
//import { makeLocalTransportPair, TransportExposedStreams } from '../transport-exposed-streams.ts';
import { makeLocalTransportPair, TransportLocal } from '../transport-local.ts';

import { sleep } from '../util.ts';
import { EventLog } from './event-log.ts';

//================================================================================

Deno.test('basics', async () => {
    const e = new EventLog();
    const methods = {
        add: (a: number, b: number) => a + b,
        addAsync: async (a: number, b: number) => {
            await sleep(10);
            return a + b;
        },
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
    const {
        transA,
        transB,
        thisConn: connAtoB,
        otherConn: connBtoA,
    } = makeLocalTransportPair(methods);

    //----------------------------------------
    // NOTIFY

    e.note('notify...');
    await connAtoB.notify('shout', 'hello world');
    e.expect('shout: HELLO WORLD');
    e.note('...done with notify');

    e.note('notify async...');
    await connAtoB.notify('shoutAsync', 'hello world');
    e.expect('shoutAsync: HELLO WORLD');
    e.note('...done with notify async');

    // When notify's method has an error, it should be swallowed and not returned to us
    // because notify is not supposed to return anything.
    // This will show as a console.warn but that's expected.
    try {
        await connAtoB.notify('alwaysError');
        assert(true, 'notify should not return errors');
    } catch (error) {
        assert(false, 'notify should not return errors');
    }

    //----------------------------------------
    // REQUEST-RESPONSE

    e.note('request-response...');
    const three = await connAtoB.request('add', 1, 2);
    assertEquals(three, 3, 'request-response returned the correct answer');
    e.note('...done with request-response');

    e.note('request-response async...');
    const three2 = await connAtoB.request('addAsync', 1, 2);
    assertEquals(three, 3, 'request-response async returned the correct answer');
    e.note('...done with request-response async');
    e.assertEventsMatch();

    //----------------------------------------
    // CLOSE

    assert(!transA.isClosed, 'transA is not closed yet');
    assert(!transB.isClosed, 'transB is not closed yet');
    assert(!connAtoB.isClosed, 'connAtoB is not closed yet');
    assert(!connBtoA.isClosed, 'connBtoA is not closed yet');

    // close one side of the connection, the other side closes, but not the transport
    connAtoB.close();
    assert(!transA.isClosed, 'transA is not closed yet');
    assert(!transB.isClosed, 'transB is not closed yet');
    assert(connAtoB.isClosed, 'connAtoB is closed');
    assert(connBtoA.isClosed, 'connBtoA is closed');

    transA.close();
    transB.close();
    assert(transA.isClosed, 'transA is closed');
    assert(transB.isClosed, 'transB is closed');
});
