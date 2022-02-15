import { FnsBag } from './types-bag.ts';
import { RpcError, RpcErrorNetworkProblem, RpcErrorUseAfterClose } from './errors.ts';
import { IConnection, ITransport, ITransportOpts, Thunk, TransportStatus } from './types.ts';
import { Watchable, WatchableSet } from './watchable.ts';
import { ensureEndsWith, fetchWithTimeout } from './util.ts';
import { Connection } from './connection.ts';

import { logPullState, logTransport as log } from './log.ts';

const TIMEOUT = 1000; // TODO: make this configurable

interface ClosedPullState {
    closed: true;
}

interface PullStateOptions<BagType extends FnsBag> {
    urlToFetch: string;
    setState: (
        state: ScheduledPullState<BagType> | InFlightPullState<BagType> | ClosedPullState,
    ) => void;
    connection: IConnection<BagType>;
}

class ScheduledPullState<BagType extends FnsBag> {
    closed = false as false;
    _timeoutId: number;
    _opts: PullStateOptions<BagType>;

    constructor(opts: PullStateOptions<BagType> & { ms?: number }) {
        this._opts = opts;

        this._timeoutId = setTimeout(() => {
            logPullState(
                `(SCHEDULED -> IN-FLIGHT) Began a pull!`,
            );
            this._opts.setState(new InFlightPullState(this._opts));
        }, opts.ms);

        //logPullState(`(SCHEDULED) Scheduled a pull in ${opts.ms}`);
    }

    reschedule(ms?: number) {
        clearTimeout(this._timeoutId);

        if (ms) {
            logPullState(
                `(SCHEDULED -> SCHEDULED) Rescheduled a pull in ${ms}ms'}`,
            );
            this._opts.setState(
                new ScheduledPullState({ ms, ...this._opts }),
            );
        } else {
            logPullState(
                `(SCHEDULED -> IN-FLIGHT) Rescheduled a pull to right now!`,
            );
            this._opts.setState(
                new InFlightPullState({ ...this._opts }),
            );
        }
    }

    close() {
        clearTimeout(this._timeoutId);
        this._opts.setState({
            closed: true,
        });
        logPullState(`(SCHEDULED -> CLOSED) Closed while waiting for the next pull!`);
    }
}

class InFlightPullState<BagType extends FnsBag> {
    _abortController: AbortController;
    _opts: PullStateOptions<BagType>;
    _timeoutTimer: number;
    closed = false as false;
    _closedInMeantime = false;

    constructor(opts: PullStateOptions<BagType>) {
        this._abortController = new AbortController();
        this._opts = opts;

        // Cancel the request after a timeout
        this._timeoutTimer = setTimeout(() => {
            if (!this._abortController.signal.aborted) {
                this._abortController.abort();
            }
        }, TIMEOUT);

        const QUICK_POLL = 10; // got good data, try again right away
        const SLOW_POLL = 1000; // got no data, slow down
        const ERROR_POLL = 3000; // got an error, back off

        fetch(opts.urlToFetch, { signal: this._abortController.signal }).then(async (response) => {
            logPullState('(IN-FLIGHT) Fetched successfully!');

            if (!response.ok) {
                throw new RpcErrorNetworkProblem('pull thread HTTP response was not ok');
            }

            const envs = await response.json();

            if (!Array.isArray(envs)) throw new RpcError('expected an array');
            // poll slower when there's nothing there

            const pollInMs = envs.length >= 1 ? QUICK_POLL : SLOW_POLL;

            logPullState('(IN-FLIGHT) Got this many envelopes:', envs.length);
            logPullState(`(IN-FLIGHT -> SCHEDULED) Scheduled next pull in ${pollInMs}ms`);
            this._opts.setState(new ScheduledPullState({ ...this._opts, ms: pollInMs }));

            // pass envelopes to the connection to handle one at a time
            this._opts.connection.status.set('OPEN');
            log(`got ${envs.length} envelopes`);
            for (const env of envs) {
                this._opts.connection.handleIncomingEnvelope(env);
            }
        }).catch((error) => {
            // This will happen if this state was closed
            // or timed out.
            if (
                error instanceof DOMException &&
                error.message === 'The signal has been aborted'
            ) {
                logPullState('(IN-FLIGHT) Request was cancelled.');
                return;
            }

            this._opts.connection.status.set('ERROR');

            // here we should reschedule if this wasn't closed in the meantime.

            logPullState('Got an error!:', error);
            if (!this._closedInMeantime) {
                logPullState(
                    `(IN-FLIGHT -> SCHEDULED) Scheduled next pull in ${ERROR_POLL}ms (due to error)`,
                );
                this._opts.setState(new ScheduledPullState({ ...this._opts, ms: ERROR_POLL }));
            }

            console.warn('> problem polling for envelopes:', error);
            // don't re-throw; swallow this error because there's nobody to catch it
        }).finally(() => {
            clearTimeout(this._timeoutTimer);
        });
    }

    close() {
        this._closedInMeantime = true;
        clearTimeout(this._timeoutTimer);
        this._abortController.abort();

        this._opts.setState({
            closed: true,
        });

        logPullState(`(IN-FLIGHT -> CLOSED) Closed!`);
    }
}

export class TransportHttpClient<BagType extends FnsBag> implements ITransport<BagType> {
    status: Watchable<TransportStatus> = new Watchable('OPEN' as TransportStatus);
    deviceId: string;
    methods: BagType;
    connections: WatchableSet<IConnection<BagType>> = new WatchableSet();
    _pullStates: Map<
        string,
        InFlightPullState<BagType> | ScheduledPullState<BagType> | ClosedPullState
    > = new Map();

    constructor(opts: ITransportOpts<BagType>) {
        log('constructor for device', opts.deviceId);
        this.deviceId = opts.deviceId;
        this.methods = opts.methods;
    }

    get isClosed() {
        return this.status.value === 'CLOSED';
    }

    onClose(cb: Thunk): Thunk {
        return this.status.onChangeTo('CLOSED', cb);
    }

    close(): void {
        if (this.isClosed) return;

        log('closing...');
        this.status.set('CLOSED');

        log('...closing connections...');
        for (const conn of this.connections) {
            conn.close();
        }

        this.connections.clear();
        log('...closed');
    }

    addConnection(url: string): Connection<BagType> {
        url = ensureEndsWith(url, '/');
        log('addConnection to url:', url);

        const conn = new Connection({
            description: url,
            transport: this,
            deviceId: this.deviceId,
            methods: this.methods,
            // PUSH
            sendEnvelope: async (conn, env) => {
                // send envelope in its own HTTP POST.
                // TODO: does this work right if it's called multiple times at once?
                // probably conn.status ends up wrong.

                if (conn.isClosed) throw new RpcErrorUseAfterClose('the connection is closed');
                log(`connection "${conn.description}" is sending an envelope:`, env);
                log('send...');

                conn.status.set('CONNECTING');
                const urlToPost = url + `from/${this.deviceId}`;
                log(`send... POSTing to ${urlToPost}`);

                const { request, cancel: cancelRequest, clearFetchTimeout } = fetchWithTimeout(
                    TIMEOUT,
                    urlToPost,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify([env]),
                    },
                );

                conn.onClose(() => {
                    clearFetchTimeout();
                    cancelRequest();
                });

                try {
                    const res = await request;

                    clearFetchTimeout();

                    if (this.isClosed) return;

                    if (!res.ok) {
                        log('send... POST was not ok...');
                        throw new RpcErrorNetworkProblem(
                            `a POST to ${urlToPost} resulted in http ${res.status}`,
                        );
                    } else {
                        log('send... success.');

                        // cancel current pull timers for this connection
                        // and pull again!

                        const pullState = this._pullStates.get(conn.description);

                        if (pullState && 'reschedule' in pullState) {
                            logPullState(
                                'Sent envelopes, expecting some back... let\'s reschedule!',
                            );
                            pullState.reschedule(0);
                        }

                        conn.status.set('OPEN');
                    }
                } catch (error) {
                    clearFetchTimeout();
                    // Don't throw if we're just cancelling the request
                    // Can't use DOMException here because Node doesn't have it.
                    // And need to support some node-fetch variant of this error too.
                    if (
                        error.message === 'The signal has been aborted' ||
                        error.message === 'The user aborted a request.'
                    ) {
                        return;
                    }

                    log('send... error.');
                    conn.status.set('ERROR');
                    //console.warn('> sendEnvelope error:', error);
                    // re-throw the error
                    throw error;
                }
            },
        });

        const newPullState = new InFlightPullState({
            connection: conn,
            setState: (state) => this._pullStates.set(conn.description, state),
            urlToFetch: url + `for/${this.deviceId}`,
        });

        this._pullStates.set(conn.description, newPullState);

        conn.onClose(() => {
            const pullState = this._pullStates.get(conn.description);

            if (pullState && pullState.closed === false) {
                pullState.close();
            }

            this.connections.delete(conn);
        });

        this.connections.add(conn);
        return conn;
    }
}
