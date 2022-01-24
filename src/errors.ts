/* istanbul ignore next */
export class RpcError extends Error {
    constructor(message?: string) {
        super(message || '');
        this.name = 'RpcError';
    }
}

/* istanbul ignore next */
export class RpcErrorUseAfterClose extends RpcError {
    constructor(message?: string) {
        super(message || 'A connection or transport was used after being closed.');
        this.name = 'RpcErrorUseAfterClose';
    }
}

/* istanbul ignore next */
export class RpcErrorUnknownMethod extends RpcError {
    constructor(message?: string) {
        super(message || 'No method was found with the given name.');
        this.name = 'RpcErrorUnknownMethod';
    }
}

/* istanbul ignore next */
export class RpcErrorTimeout extends RpcError {
    constructor(message?: string) {
        super(message || 'A timeout occurred.');
        this.name = 'RpcErrorTimeout';
    }
}

/* istanbul ignore next */
export class RpcErrorNetworkProblem extends RpcError {
    constructor(message?: string) {
        super(message || 'A network problem occurred.');
        this.name = 'RpcErrorNetworkProblem';
    }
}

/* istanbul ignore next */
export class RpcErrorFromMethod extends RpcError {
    constructor(message?: string) {
        super(message || 'The method threw an error.');
        this.name = 'RpcErrorFromMethod';
    }
}
