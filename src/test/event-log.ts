import { assertEquals, equal as deepEqual } from './asserts.ts';

export class EventLog {
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