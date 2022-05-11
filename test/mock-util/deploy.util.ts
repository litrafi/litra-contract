import { construcAndWait } from "../../scripts/lib/utils";
import { Nft, WBNB } from "../../typechain";

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
    const token = await construcAndWait('MockERC20', [tokenName, tokenName]);
    return token;
}