export type Fn = (...args: any[]) => any;
export type FnsBag = {
    [methodName: string]: Fn;
};
