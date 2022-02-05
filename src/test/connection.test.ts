import { assert, assertEquals } from './asserts.ts';
import { makeObservedMethods } from './test-methods.ts';
import { EventLog } from './event-log.ts';
import { scenarios } from './scenarios.ts';
import { ITransportScenario } from './scenario-types.ts';

//================================================================================

async function testConnectionNotify(
    t: Deno.TestContext,
    scenario: ITransportScenario<ReturnType<typeof makeObservedMethods>>,
    e: EventLog,
) {
    await t.step({
        name: 'notify',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            e.clear();
            e.note('about to shout');
            await scenario.connAtoB.notify('shout', 'hello');
            e.expect('shout: \'HELLO\'');
            e.note('shouted');
            await scenario.connAtoB.notify('shoutAsync', 'hello');
        },
    });

    await t.step({
        name: 'notify eith error',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            // When notify's method has an error, it should be swallowed and not returned to us
            // because notify is not supposed to return anything.
            // This will show as a console.warn but that's expected.

            // error in the method call (no such method
            try {
                await scenario.connAtoB.notify(
                    'nosuch' as unknown as keyof typeof makeObservedMethods,
                );
                assert(true, 'notify should not return errors');
            } catch {
                assert(false, 'notify should not return errors');
            }

            // error in the method
            try {
                await scenario.connAtoB.notify('alwaysError', 'Error!');
                assert(true, 'notify should not return errors');
            } catch {
                assert(false, 'notify should not return errors');
            }
        },
    });
}

async function testConnectionRequestResponse(
    t: Deno.TestContext,
    scenario: ITransportScenario<ReturnType<typeof makeObservedMethods>>,
    e: EventLog,
) {
    await t.step({
        name: 'request-response',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            const three = await scenario.connAtoB.request('add', 1, 2);
            assertEquals(three, 3, 'conn.request returns correct answer');
            const threeAsync = await scenario.connAtoB.request('addAsync', 1, 2);
            assertEquals(threeAsync, 3, 'conn.request returns correct answer');
        },
    });

    await t.step({
        name: 'request-response with error',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async () => {
            // error in the method call (no such method)
            try {
                const three = await scenario.connAtoB.request(
                    'nosuch' as unknown as keyof typeof makeObservedMethods,
                );
                assert(false, 'should catch error from unknown method call');
            } catch (error) {
                assert(true, 'should catch error from unknown method call');
            }

            // error in the method
            try {
                const three = await scenario.connAtoB.request('alwaysError', 'Error!');
                assert(false, 'should catch error from method call');
            } catch (error) {
                assert(true, 'should catch error from method call');
            }
        },
    });
}

async function testClosingConnection(
    t: Deno.TestContext,
    scenario: ITransportScenario<ReturnType<typeof makeObservedMethods>>,
) {
    await t.step({
        name: 'closing things',
        // There may be async ops on the client and server
        sanitizeOps: false,
        sanitizeResources: false,
        fn: () => {
            assert(!scenario.clientTransport.isClosed, 'clientTransport is not closed yet');
            assert(!scenario.serverTransport.isClosed, 'serverTransport is not closed yet');
            assert(!scenario.connAtoB.isClosed, 'connAtoB is not closed yet');
            assert(!scenario.connBtoA.isClosed, 'connBtoA is not closed yet');

            // close one side of the connection, the other side closes, but not the transport
            scenario.connAtoB.close();
            assert(!scenario.clientTransport.isClosed, 'clientTransport is not closed yet');
            assert(!scenario.serverTransport.isClosed, 'serverTransport is not closed yet');
            assert(scenario.connAtoB.isClosed, 'connAtoB is closed');

            //TODO: We need a way to close connections remotely?
            //assert(connBtoA.isClosed, 'connBtoA is closed');

            scenario.clientTransport.close();
            scenario.serverTransport.close();
            assert(scenario.clientTransport.isClosed, 'clientTransport is closed');
            assert(scenario.serverTransport.isClosed, 'serverTransport is closed');
        },
    });
}

Deno.test('connection behaviour', async (t) => {
    const eventLog = new EventLog();
    const methods = makeObservedMethods(eventLog);

    for await (const Scenario of scenarios) {
        const scenarioInst = new Scenario(methods);

        await testConnectionNotify(t, scenarioInst, eventLog);
        await testConnectionRequestResponse(t, scenarioInst, eventLog);
        await testClosingConnection(t, scenarioInst);
        await scenarioInst.teardown();
    }
});
