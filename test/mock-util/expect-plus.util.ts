import { expect } from "chai";
import { BigNumber } from "ethers";
import { getReadableAmount } from "./comparator.util";

export function expectCloseTo(bignum0: BigNumber, bignum1: BigNumber, deltaPricision: number = 5) {
    const num0 = getReadableAmount(bignum0);
    const num1 = getReadableAmount(bignum1);
    expect(num0).closeTo(num1, num1 / (10 ** deltaPricision));
}

export async function shouldThrow(p: Promise<any>, keyErrMsg: string) {
    const err = await p.catch(err => {
        expect(err.message).includes(keyErrMsg);
        return "err";
    })
    expect(err).eq("err");
}