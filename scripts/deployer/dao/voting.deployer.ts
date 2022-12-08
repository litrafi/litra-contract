import { BigNumber } from "ethers";
import { ACL, DAOFactory, EVMScriptRegistryFactory, Kernel, Voting } from "../../../typechain";
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