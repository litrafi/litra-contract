import { construcAndWait } from "../../scripts/lib/utils";
import { Nft } from "../../typechain";

export async function deployMockNft(owner: string) {
    const nft = await construcAndWait<Nft>('Nft', ['Nft', 'NFT', 'NFT.uri']);
    await nft.mint(owner);
    return nft;
}