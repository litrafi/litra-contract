import { task } from "hardhat/config";
import { encodeCallScript } from "../test/dao/dao.util";

task('create-test-vote')
.setAction(async (args, hre) => {
    const executionTarget = await hre.ethers.getContractAt('ExecutionTarget', '0xeaB3aF46BE9409692688a6D29909080A2Bea0bCf');
    const voting = await hre.ethers.getContractAt('Voting', '0xB636da02581FD8cC749e91306410415eFB7d4F55');
    const action = {
        to: executionTarget.address,
        data: executionTarget.interface.encodeFunctionData("execute"),
    };
    await voting["newVote(bytes,string)"](
        encodeCallScript([action]),
        "Test Vote"
    )
})

