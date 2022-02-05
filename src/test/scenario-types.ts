import { FnsBag } from '../types-bag.ts';
import { IConnection, ITransport } from '../types.ts';

export interface ITransportScenario<BagType extends FnsBag> {
    name: string;
    connAtoB: IConnection<BagType>;
    connBtoA: IConnection<BagType>;
    clientTransport: ITransport<BagType>;
    serverTransport: ITransport<BagType>;
    teardown: () => Promise<void>;
}
