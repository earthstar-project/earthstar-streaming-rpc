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
        def.resolve = resolve;
        def.reject = reject;
    });
    return def as Deferred<T>;
};

/**
 * Construct a ReadableStream and return it along with the controller object.
 *
 * Normally you can't access the controller object from the outside;
 * this lets you do that so you can push things into the stream more easily.
 *
 * `controller.enqueue(...)`
 */
export interface ExposedReadableStream {
    stream: ReadableStream;
    controller: ReadableStreamDefaultController;
}
export const makeExposedStream = (
    source: UnderlyingSource = {},
): ExposedReadableStream => {
    let exposedController;
    const newSource: any = {
        start: (controller: ReadableStreamDefaultController) => {
            exposedController = controller;
            if (source.start) source.start(controller);
        },
    };
    if (source.pull) newSource.pull = source.pull;
    if (source.cancel) newSource.cancel = source.cancel;
    const stream = new ReadableStream(newSource, {
        highWaterMark: 0,
    });
    return {
        stream,
        controller: exposedController as any as ReadableStreamDefaultController,
    };
};

export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve, reject) => setTimeout(resolve, ms));

/** Return a random integer (inclusive of endpoints) */
export const randInt = (lo: number, hi: number): number =>
    lo + Math.floor(Math.random() * (hi - lo));

/** Make a random string id */
export const makeId = (): string => ('' + randInt(0, 999999999999999)).padStart(15, '0');

export const setImmediate2 = (fn: any) => {
    Promise.resolve().then(fn);
};
