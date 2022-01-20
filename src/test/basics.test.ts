import { assert, assertEquals, equal as deepEqual } from './asserts.ts';
import { makeLocalTransportPair, TransportExposedStreams } from '../transportExposedStreams.ts';

//================================================================================

class EventLog {
    observed: any[] = []
    expected: any[] = []
    constructor() {}
    expect(x: any) { this.expected.push(x); }
    observe(x: any) { this.observed.push(x); }
    note(x: any) { this.expected.push(x); this.observed.push(x); }
    assert(s: string = 'eventLog matches') {
        if (!deepEqual(this.observed, this.expected)) {
            console.log('event log does not match:');
            console.log('observed:', this.observed);
            console.log('expected:', this.expected);
        }
        assertEquals(this.observed, this.expected, s);
    }
}

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
