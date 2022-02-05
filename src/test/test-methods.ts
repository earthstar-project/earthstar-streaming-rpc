import { EventLog } from './event-log.ts';
import { sleep } from '../util.ts';

export const makeObservedMethods = (e: EventLog) => {
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
