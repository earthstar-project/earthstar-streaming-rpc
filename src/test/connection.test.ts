import { assert, assertEquals } from './asserts.ts';
import { IConnection, ITransport } from '../types.ts';
import { makeLocalTransportPair } from '../transport-local.ts';

import { sleep } from '../util.ts';
import { EventLog } from './event-log.ts';

//================================================================================

const makeObservedMethods = (e: EventLog) => {
    return {
        add: (a: number, b: number) => {
            e.observe(`$${a} + ${b} = ${a + b}`);
            return a + b;
        },
        addAsync: async (a: number, b: number) => {
            await sleep(10);
            e.observe(`async: $${a} + ${b} = ${a + b}`);
            await sleep(10);
            return a + b;
        },
        shout: (s: string) => {
            e.observe('shout: ' + s.toLocaleUpperCase());
        },
        shoutAsync: async (s: string) => {
            await sleep(10);
            e.observe('shoutAsync: ' + s.toLocaleUpperCase());
            await sleep(10);
        },
        alwaysError: (msg: string) => {
            e.observe(`alwaysError: ${msg}`);
            throw new Error(msg);
        },
    };
};

const testConnectionNotify = async (t: Deno.TestContext, conn: IConnection, e: EventLog) => {
    await t.step('notify', async () => {
        e.clear();
        e.note('about to shout');
        await conn.notify('shout', 'hello');
        e.expect('shout: \'HELLO\'');
        e.note('shouted');
        await conn.notify('shoutAsync', 'hello');
    });

    await t.step('notify eith error', async () => {
        // When notify's method has an error, it should be swallowed and not returned to us
        // because notify is not supposed to return anything.
        // This will show as a console.warn but that's expected.

        // error in the method call (no such method
        try {
            await conn.notify('nosuch');
            assert(true, 'notify should not return errors');
        } catch (error) {
            assert(false, 'notify should not return errors');
        }

        // error in the method
        try {
            await conn.notify('alwaysError');
            assert(true, 'notify should not return errors');
        } catch (error) {
            assert(false, 'notify should not return errors');
        }
    });
};

const testConnectionRequestResponse = async (
    t: Deno.TestContext,
    conn: IConnection,
    e: EventLog,
) => {
    await t.step('request-response', async () => {
        const three = await conn.request('add', 1, 2);
        assertEquals(three, 3, 'conn.request returns correct answer');
        const threeAsync = await conn.request('addAsync', 1, 2);
        assertEquals(threeAsync, 3, 'conn.request returns correct answer');
    });

    await t.step('request-response with error', async () => {
        // error in the method call (no such method)
        try {
            const three = await conn.request('nosuch');
            assert(false, 'should catch error from unknown method call');
        } catch (error) {
            assert(true, 'should catch error from unknown method call');
        }

        // error in the method
        try {
            const three = await conn.request('alwaysError');
            assert(false, 'should catch error from method call');
        } catch (error) {
            assert(true, 'should catch error from method call');
        }
    });
};

const testClosingConnection = async (
    t: Deno.TestContext,
    connAtoB: IConnection,
    connBtoA: IConnection,
    transA: ITransport,
    transB: ITransport,
) => {
    await t.step('closing things', () => {
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
};

Deno.test('connection behaviour: TransportLocal', async (t) => {
    //----------------------------------------
    // set the stage

    const e = new EventLog();
    const methods = makeObservedMethods(e);
    const {
        transA,
        transB,
        thisConn: connAtoB,
        otherConn: connBtoA,
    } = makeLocalTransportPair(methods);

    //----------------------------------------
    // run the tests

    await testConnectionNotify(t, connAtoB, e);
    await testConnectionRequestResponse(t, connAtoB, e);
    await testClosingConnection(t, connAtoB, connBtoA, transA, transB);
});
