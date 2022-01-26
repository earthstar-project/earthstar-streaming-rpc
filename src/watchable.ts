type Thunk = () => void;
type CbOldNew<T> = (oldVal: T, newVal: T) => void;
type CbValue<T> = (value: T) => void;

export class Watchable<T> {
    value: T;
    // general onChange callbacks
    _cbs: Set<CbOldNew<T>> = new Set();
    // targeted callbacks (onChangeTo)
    _cbsByTarget: Map<any, Set<CbOldNew<T>>> = new Map();
    constructor(val: T) {
        this.value = val;
    }
    get(): T {
        return this.value;
    }
    set(newVal: T) {
        const oldVal = this.value;
        this.value = newVal;
        if (oldVal !== this.value) {
            this._cbs.forEach(cb => cb(oldVal, newVal));
            const cbsByTarget = this._cbsByTarget.get(newVal);
            if (cbsByTarget) {
                cbsByTarget.forEach(cb => cb(oldVal, newVal));
            }
        }
    }
    onChange(cb: CbOldNew<T>): Thunk {
        this._cbs.add(cb);
        return () => this._cbs.delete(cb);
    }
    onChangeTo(target: any, cb: CbOldNew<T>): Thunk {
        // this uses strict equality
        const cbsByTarget = this._cbsByTarget.get(target) ?? new Set<CbOldNew<T>>();
        cbsByTarget.add(cb);
        this._cbsByTarget.set(target, cbsByTarget);
        return () => {
            this._cbsByTarget.get(target)?.delete(cb);
        };
    }
}

export class WatchableSet<T> extends Set<T> {
    _addCbs: Set<CbValue<T>> = new Set();
    _deleteCbs: Set<CbValue<T>> = new Set();
    _changeCbs: Set<Thunk> = new Set();
    constructor(iterable: Iterable<T>) {
        super(iterable);
    }
    add(value: T) {
        let had = super.has(value);
        super.add(value);
        if (!had) {
            this._addCbs.forEach(cb => cb(value));
            this._changeCbs.forEach(cb => cb());
        }
        return this;
    }
    delete(value: T) {
        let had = super.has(value);
        super.delete(value);
        if (had) {
            this._deleteCbs.forEach(cb => cb(value));
            this._changeCbs.forEach(cb => cb());
        }
        return had;
    }
    clear() {
        for (let value of super.values()) {
            super.delete(value);
            this._deleteCbs.forEach(cb => cb(value));
        }
        this._changeCbs.forEach(cb => cb());
    }

    onAdd(cb: CbValue<T>) {
        this._addCbs.add(cb);
        return () => this._addCbs.delete(cb);
    }
    onDelete(cb: CbValue<T>) {
        this._deleteCbs.add(cb);
        return () => this._deleteCbs.delete(cb);
    }
    onChange(cb: Thunk) {
        this._changeCbs.add(cb);
        return () => this._changeCbs.delete(cb);
    }
}
