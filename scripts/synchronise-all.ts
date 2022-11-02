import { NftVaultDeployer } from "./deployer/tokenize/nft-vault.deployer";

async function synchroniseAll() {
    await new NftVaultDeployer().deploy({});
}

synchroniseAll();