import { join } from "path";

export function getDeployedRecordFilePath(network: string) {
    return join(
        __dirname,
        "scripts",
        "deployed",
        "deployed-contract",
        `${network}_deployed_contract_info.json`
    );
}