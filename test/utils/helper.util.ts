import { expect, AssertionError } from "chai";
import { BaseContract, ContractEventName, ContractTransactionResponse, ContractTransactionReceipt } from 'ethers';

export function objectValuesShouldBe(val: any, expectVal: any) {
    for (const key in expectVal) {
        try {
            expect(val[key]).deep.eq(expectVal[key]);
        } catch {
            throw new AssertionError(`expected ${val} to have property ${key} equals ${expectVal[key]}.`)
        }
    }
}

export async function getEventArgs<T extends BaseContract>(
    contract: T,
    res: ContractTransactionResponse,
    eventName: ContractEventName,
    index = 0
) {
    const recipent = await res.wait();
    if(!recipent) {
        return;
    }
    const events = await contract.queryFilter(
        eventName,
        recipent.blockNumber
    )
    const event = events.filter(event => event.transactionHash === recipent.hash);
    if(!event || !event[index]) {
        return;
    }
    return (event[index] as any).args;
}

export async function getEventSpecifiedArg<T extends BaseContract>(
    contract: T,
    res: ContractTransactionResponse,
    eventName: ContractEventName,
    argName: string,
    index = 0
) {
    const eventArgs = await getEventArgs(contract, res, eventName, index);
    if(!eventArgs) {
        return;
    }
    return eventArgs[argName];
}

export class Iterator {
    private index: number = 0;

    constructor(private readonly arr: any[]) {}

    next() {
        if(this.index + 1 == this.arr.length) {
            throw new Error('Iterator end');
        }
        const index = this.index;
        this.index ++
        return this.arr[index];
    }
}