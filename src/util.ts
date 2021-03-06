import { RpcErrorTimeout } from './errors.ts';

export function fetchWithTimeout(
    timeout: number,
    ...args: Parameters<typeof fetch>
) {
    const controller = new AbortController();

    const [input, init] = args;

    const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    }, timeout);

    const request = fetch(input as string, {
        ...init as unknown as any,
        signal: controller.signal,
    }).then(
        (res) => {
            clearTimeout(timeoutId);
            return res;
        },
    );

    const cancel = () => {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
            controller.abort();
        }
    };

    const clearFetchTimeout = () => {
        clearTimeout(timeoutId);
    };

    return { request, cancel, clearFetchTimeout };
}

export const withTimeout = async <T>(ms: number, prom: Promise<T>): Promise<T> => {
    let timeout = 0;
    const rejectAfterMs = new Promise((res, rej) => {
        timeout = setTimeout(() => rej(new RpcErrorTimeout()), ms);
    });

    const result = await Promise.race([rejectAfterMs, prom]) as Promise<T>;
    clearTimeout(timeout);
    return result;
};

export const ensureEndsWith = (s: string, suffix: string) => {
    if (s.endsWith(suffix)) return s;
    return s + suffix;
};

export const ensureDoesNotEndWith = (s: string, suffix: string) => {
    if (s.endsWith(suffix)) return s.slice(0, -1);
    return s;
};

/**
 * A Deferred is a Promise and its resolve and reject methods.
 *
 * Normally you can't resolve or reject a Promise from the outside;
 * this lets you do that.
 */
export interface Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}

export const makeDeferred = <T>(): Deferred<T> => {
    const def: any = {};
    def.promise = new Promise<T>((resolve, reject) => {
        def.resolve = (arg: T) => {
            try {
                resolve(arg);
            } catch (err) {
                console.error(err);
            }
        };
        def.reject = (arg: any) => {
            try {
                reject(arg);
            } catch (err) {
                console.error(err);
            }
        };
    });
    return def as Deferred<T>;
};

// /**
//  * Construct a ReadableStream and return it along with the controller object.
//  *
//  * Normally you can't access the controller object from the outside;
//  * this lets you do that so you can push things into the stream more easily.
//  *
//  * `controller.enqueue(...)`
//  */
// export interface ExposedReadableStream {
//     stream: ReadableStream;
//     controller: ReadableStreamDefaultController;
// }
// export const makeExposedStream = (
//     source: UnderlyingSource = {},
// ): ExposedReadableStream => {
//     let exposedController;
//     const newSource: any = {
//         start: (controller: ReadableStreamDefaultController) => {
//             exposedController = controller;
//             if (source.start) source.start(controller);
//         },
//     };
//     if (source.pull) newSource.pull = source.pull;
//     if (source.cancel) newSource.cancel = source.cancel;
//     const stream = new ReadableStream(newSource, {
//         highWaterMark: 0,
//     });
//     return {
//         stream,
//         controller: exposedController as any as ReadableStreamDefaultController,
//     };
// };

export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/** Return a random integer (inclusive of endpoints) */
export const randInt = (lo: number, hi: number): number =>
    lo + Math.floor(Math.random() * (hi - lo));

/** Make a random string id */
export const makeId = (): string => ('' + randInt(0, 999999999999999)).padStart(15, '0');

export const setImmediate2 = (fn: any) => {
    Promise.resolve().then(fn);
};
