import { FeeManager, NFTVault } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"
import { construcAndWait, getContractAt } from "../../lib/utils";

type DeployArgs = {
    vault: string,
    oAdmin: string,
    pAdmin: string,
    eAdmin: string
}

export class FeeManagerDeployer extends ContractDeployer<FeeManager, DeployArgs> {
    protected getContractName(): string {
        return 'FeeManager';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [
            args.vault,
            args.oAdmin,
            args.pAdmin,
            args.eAdmin
        ];
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const feeManager = await construcAndWait<FeeManager>('FeeManager', [
            args.vault,
            args.oAdmin,
            args.pAdmin,
            args.eAdmin
        ])
        const vaultContract = await getContractAt<NFTVault>('NFTVault', args.vault);
        await vaultContract.setFeeManager(feeManager.address);

        return feeManager.address;
    }
}