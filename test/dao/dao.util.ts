import { defaultAbiCoder } from "ethers/lib/utils";

export function encodeCallScript(
    actions: { to: string; data: string }[]
): string {
  return actions.reduce((script: string, { to, data }) => {
    const address = defaultAbiCoder.encode(["address"], [to]);
    const dataLength = defaultAbiCoder.encode(
      ["uint256"],
      [(data.length - 2) / 2]
    );

    return script + address.slice(26) + dataLength.slice(58) + data.slice(2);
  }, "0x00000001");
};