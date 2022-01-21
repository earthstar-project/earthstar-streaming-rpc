type Thunk = () => void;
type Cb<T> = (oldVal: T, newVal: T) => void;

export class Watchable<T> {
    value: T;
    // general onChange callbacks
    _cbs: Set<Cb<T>> = new Set();
    // targeted callbacks (onChangeTo)
    _cbsByTarget: Map<any, Set<Cb<T>>> = new Map();
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
            for (const cb of this._cbs) {
                cb(oldVal, this.value);
            }
            const cbsByTarget = this._cbsByTarget.get(newVal);
            if (cbsByTarget) {
                for (const cb of cbsByTarget) {
                    cb(oldVal, newVal);
                }
            }
        }
    }
    onChange(cb: Cb<T>): Thunk {
        this._cbs.add(cb);
        return () => this._cbs.delete(cb);
    }
    onChangeTo(target: any, cb: Cb<T>): Thunk {
        // this uses strict equality
        const cbsByTarget = this._cbsByTarget.get(target) ?? new Set<Cb<T>>();
        cbsByTarget.add(cb);
        this._cbsByTarget.set(target, cbsByTarget);
        return () => {
            this._cbsByTarget.get(target)?.delete(cb);
        };
    }
}
