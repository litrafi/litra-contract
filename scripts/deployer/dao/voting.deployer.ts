import { BigNumber } from "ethers";
import { ACL, DAOFactory, EVMScriptRegistry, EVMScriptRegistryFactory, Kernel, Voting } from "../../../typechain";
import { ContractDeployer } from "../../lib/deployer";
import { construcAndWait, executeAndWait, getContractAt, getEventArgument, getSelfAddress } from "../../lib/utils";

type DeployArgs = {
    appId: string,
    token: string,
    supportRequiredPct: string | BigNumber, 
    minAcceptQuorumPct: string | BigNumber, 
    voteTime: string | number,
    minBalance: number,
    minTime: string | number,
    minBalanceLowerLimit: number,
    minBalanceUpperLimit: number,
    minTimeLowerLimit: string | number,
    minTimeUpperLimit: string | number
}

const ANY_ENTITY = "0x" + "f".repeat(40); // 0xffff...ffff
const KERNEL_APP_ADDR_NAMESPACE = '0xd6f028ca0e8edb4a8c9757ca4fdccab25fa1e0317da1188108f7d2dee14902fb';
const EVMSCRIPT_REGISTRY_APP_ID = '0xddbcfd564f642ab5627cf68b9b7d374fb4f8a36e941a75d89c87998cef03bd61';
const REGISTRY_ADD_EXECUTOR_ROLE = '0xc4e90f38eea8c4212a009ca7b8947943ba4d4a58d19b683417f65291d1cd9ed2';

export class VotingDeployer extends ContractDeployer<Voting, DeployArgs> {
    protected getContractName(): string {
        return 'Voting';
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const rootAddress = await getSelfAddress();
        const [dao, acl] = await this.newDao();
        console.log('Kernel deployed:', dao.address)
        console.log('ACL deployed:', acl.address)
        const votingBase = await construcAndWait<Voting>(this.getContractName(), []);
        const votingProxy = await this.installNewApp(
            dao,
            args.appId,
            votingBase.address
        );
        console.log('Voting deployed', votingProxy.address);
        const CREATE_VOTES_ROLE = await votingBase.CREATE_VOTES_ROLE();
        await executeAndWait(() => acl.createPermission(
            ANY_ENTITY,
            votingProxy.address,
            CREATE_VOTES_ROLE,
            rootAddress
        ))
        console.log('Granted voting permission to everybody');
        await executeAndWait(() => votingProxy.initialize(
            args.token,
            args.supportRequiredPct,
            args.minAcceptQuorumPct,
            args.voteTime,
            args.minBalance,
            args.minTime,
            args.minBalanceLowerLimit,
            args.minBalanceUpperLimit,
            args.minTimeLowerLimit,
            args.minTimeUpperLimit
        ));
        console.log('Voting is initialized')
        return votingProxy.address;
    }

    async newDao(): Promise<[Kernel, ACL]> {
        const kernelBase = await construcAndWait<Kernel>('Kernel', [true]);
        const aclBase = await construcAndWait<ACL>('ACL');
        const evmScriptRegistryFactory = await construcAndWait<EVMScriptRegistryFactory>('EVMScriptRegistryFactory');
        const daoFactory = await construcAndWait<DAOFactory>('DAOFactory', [
            kernelBase.address,
            aclBase.address,
            evmScriptRegistryFactory.address
        ]);
        const rootAddress = await getSelfAddress();
        const daoReceipt = await (await daoFactory.newDAO(rootAddress)).wait();
        const daoAddress = await getEventArgument(
            daoFactory,
            daoReceipt.transactionHash,
            "DeployDAO",
            "dao"
        );
        const kernel = await getContractAt<Kernel>('Kernel', daoAddress);
        const aclAddr = await kernel.acl();
        const APP_MANAGER_ROLE = await kernel.APP_MANAGER_ROLE();
        const acl = await getContractAt<ACL>('ACL', aclAddr);
        await acl.createPermission(
            rootAddress,
            kernel.address,
            APP_MANAGER_ROLE,
            rootAddress
        );
        // add second executor
        const registryAddr = await kernel.getApp(KERNEL_APP_ADDR_NAMESPACE, EVMSCRIPT_REGISTRY_APP_ID);
        await executeAndWait(()=> acl.createPermission(
            rootAddress,
            registryAddr,
            REGISTRY_ADD_EXECUTOR_ROLE,
            rootAddress
        ))
        const callsScript = await construcAndWait('CallsScript');
        const registry = await getContractAt<EVMScriptRegistry>('EVMScriptRegistry', registryAddr);
        await executeAndWait(() => registry.addScriptExecutor(callsScript.address));
        
        return [
            kernel,
            acl
        ]
    }

    async installNewApp(
        dao: Kernel,
        appId: string,
        baseAppAddress: string
    ) {
        const tx = await dao["newAppInstance(bytes32,address,bytes,bool)"](
          appId,
          baseAppAddress,
          "0x",
          false
        );
        const receipt = await tx.wait();
        const proxyAddress = await getEventArgument(
          dao,
          receipt.transactionHash,
          "NewAppProxy",
          "proxy"
        );
      
        return getContractAt<Voting>('Voting', proxyAddress);
      };
}