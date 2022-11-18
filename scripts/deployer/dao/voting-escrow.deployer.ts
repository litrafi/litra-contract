import { VotingEscrow } from "../../../typechain"
import { ContractDeployer } from "../../lib/deployer"

type DeployArgs = {
    token: string
}

export class VotingEscrowDeployer extends ContractDeployer<VotingEscrow, DeployArgs> {
    protected getContractName(): string {
        return 'VotingEscrow';
    }

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [args.token];
    }
}