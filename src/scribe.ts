import { IPostman, IScribe, IScribeConstructorOpts } from "./types.ts";
import { Envelope } from "./types-envelope.ts";
import { makeId } from "./util.ts";

export class Scribe implements IScribe {
    _postmen: IPostman[] = [];
    id: string;
    isClosed: boolean = false;
    constructor(opts: IScribeConstructorOpts) {
        this.id = opts.id || makeId();
    }
    addPostman(postman: IPostman): void {
        if (this.isClosed) throw new Error("scribe is closed");
        this._postmen.push(postman);
    }

    async notify(method: string, ...args: any[]): Promise<void> {
        if (this.isClosed) throw new Error("scribe is closed");
        // TODO
    }
    async request(method: string, ...args: any[]): Promise<any> {
        if (this.isClosed) throw new Error("scribe is closed");
        // TODO
    }

    close(): void {
        if (this.isClosed) return;
        this.isClosed = true;
        for (let postman of this._postmen) {
            postman.close();
        }
    }
}
