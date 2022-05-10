export class ContractNotDeployedError extends Error{
    constructor(contractName: string) {
        super(`${contractName} has not been deployed !`);
    }
}