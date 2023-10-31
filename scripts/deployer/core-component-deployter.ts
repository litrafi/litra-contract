import { BatchProxyDeployer } from "./tokenize/batch-proxy.deployer";
import { NFTVaultDeployer } from "./tokenize/nft-vault.deployer";

export async function deployCoreComponent() {
    const valut = await new NFTVaultDeployer().getOrDeployInstance({})
    await new BatchProxyDeployer().getOrDeployInstance({ vault: valut.address })
}