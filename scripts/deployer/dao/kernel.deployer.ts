import { ACL, DAOFactory, EVMScriptRegistryFactory, Kernel } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer"
import { construcAndWait, getContractAt, getEventArgument, getSelfAddress } from "../../lib/utils";

export class KernelDeployer extends ContractDeployer<Kernel, {}> {
    protected getContractName(): string {
        return 'Kernel';
    }
    
    protected async _deploy(): Promise<string> {
        const admin = await getSelfAddress();
        const kernelBase = await construcAndWait<Kernel>('Kernel', [true]);
        const aclBase = await construcAndWait<ACL>('ACL');
        const evmScriptRegistryFactory = await construcAndWait<EVMScriptRegistryFactory>('EVMScriptRegistryFactory');
        const daoFactory = await construcAndWait<DAOFactory>('DAOFactory', [
            kernelBase.address,
            aclBase.address,
            evmScriptRegistryFactory.address
        ]);
        const daoReceipt = await (await daoFactory.newDAO(admin)).wait();
        const daoAddress = await getEventArgument(
            daoFactory,
            daoReceipt,
            "DeployDAO",
            "dao"
        );
        const kernel = await getContractAt<Kernel>('Kernel', daoAddress);
        const aclAddr = await kernel.acl();
        const APP_MANAGER_ROLE = await kernel.APP_MANAGER_ROLE();
        const acl = await getContractAt<ACL>('ACL', aclAddr);
        await acl.createPermission(
            admin,
            kernel.address,
            APP_MANAGER_ROLE,
            admin
        );

        return kernel.address;
    }
}