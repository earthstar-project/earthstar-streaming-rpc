type Thunk = () => void;
type SubscriptionFn<T> = (val: T, oldVal: T) => void;

export class Atom<T> {
    val: T;
    _subscriptions: Set<SubscriptionFn<T>>;
    constructor(v: T) {
        this.val = v;
        this._subscriptions = new Set();
    }
    subscribe(fn: SubscriptionFn<T>): Thunk {
        this._subscriptions.add(fn);
        return () => this._subscriptions.delete(fn);
    }
    set(newVal: T) {
        const oldVal = this.val;
        this.val = newVal;
        this._subscriptions.forEach((fn) => fn(newVal, oldVal));
    }
    get(): T {
        return this.val;
    }
}

export class AtomList<T> {
    arr: T[];
    _subscriptions: Set<SubscriptionFn<T[]>>;
    constructor(v: T[]) {
        this.arr = v;
        this._subscriptions = new Set();
    }
    //---------------------------------------------
    // SPECIAL
    subscribe(fn: SubscriptionFn<T[]>): Thunk {
        this._subscriptions.add(fn);
        return () => this._subscriptions.delete(fn);
    }
    get array(): T[] {
        return this.arr;
    }
    toJSON(): T[] {
        return this.arr;
    }
    //---------------------------------------------
    // SPECIAL BUT STANDARD
    get length(): number {
        return this.arr.length;
    }
    [Symbol.iterator]() {
        return this.arr;
    }
    //---------------------------------------------
    // READS
    get(ii: number): T | undefined {
        return this.arr[ii];
    }
    map(fn: (item: T) => T): AtomList<T> {
        return new AtomList(this.arr.map(fn));
    }
    filter(fn: (item: T) => boolean): AtomList<T> {
        return new AtomList(this.arr.filter(fn));
    }
    forEach(fn: (item: T) => void): void {
        this.arr.forEach(fn);
    }
    slice(start: number | undefined, end: number | undefined): AtomList<T> {
        return new AtomList(this.arr.slice(start, end));
    }
    //---------------------------------------------
    // WRITES
    _change(oldVal: T[], newVal: T[]): void {
        this.arr = newVal;
        this._subscriptions.forEach((fn) => fn(newVal, oldVal));
    }
    set(ii: number, val: T): void {
        const oldVal = this.arr;
        this.arr[ii] = val;
        this._change(oldVal, this.arr);
    }
    push(item: T): void {
        const oldVal = this.arr;
        this.arr.push(item);
        this._change(oldVal, this.arr);
    }
    pop(): T | undefined {
        const oldVal = this.arr;
        const result = this.arr.pop();
        this._change(oldVal, this.arr);
        return result;
    }
    shift(item: T): void {
        const oldVal = this.arr;
        this.arr.push(item);
        this._change(oldVal, this.arr);
    }
    unshift(): T | undefined {
        const oldVal = this.arr;
        const result = this.arr.pop();
        this._change(oldVal, this.arr);
        return result;
    }
}
