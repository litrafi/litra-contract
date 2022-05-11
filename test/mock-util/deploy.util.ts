import { BigNumber } from "ethers";
import { E18 } from "../../scripts/lib/constant";
import { construcAndWait } from "../../scripts/lib/utils";
import { MockERC20, Nft, Ntoken, WBNB } from "../../typechain";

export async function deployMockNft(owner: string) {
    const nft = await construcAndWait<Nft>('Nft', ['Nft', 'NFT', 'NFT.uri']);
    await nft.mint(owner);
    return nft;
}

export async function deployMockWETH() {
    const weth = await construcAndWait<WBNB>('WBNB');
    return weth;
}

export async function deployERC20Token(tokenName: string) {
    const token = await construcAndWait<MockERC20>('MockERC20', [tokenName, tokenName]);
    return token;
}

export async function deployMockNtoken(deployer: string) {
    const SUPPLY = BigNumber.from(E18).mul(2);
    const tnft = await construcAndWait<Ntoken>(
        'Ntoken',
        ['Mock TNFT', 'MTNFT', SUPPLY, deployer]
    )
    return tnft;
}