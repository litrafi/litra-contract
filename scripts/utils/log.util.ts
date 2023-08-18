import { join } from 'path';
import { writeFileSync } from 'fs';

export class TaskLogger {
    logs: string[] = []
    logDir = join(__dirname, '../logs');

    async logDeployment(
        label: string,
        contract: {
            getAddress: () => Promise<string>
            waitForDeployment: () => Promise<any>
            deploymentTransaction: () => { hash: string, from: string }
        }
    ) {
        await contract.waitForDeployment();
        const {hash, from} = await contract.deploymentTransaction();
        const logStr = `Deploy ${label} on: ${await contract.getAddress()};Time: ${new Date().toString()};Deployer: ${from};tx: ${hash}`;
        console.log(logStr);
        this.logs.push(logStr)
    }

    log(str: string) {
        console.log(str);
        this.logs.push(str);
    }

    commit(chain: string) {
        const fileName = this.getFileName(chain)
        const filePath = join(this.logDir, fileName);
        
        writeFileSync(filePath, this.logs.join('\n'), { flag: 'w'})
    }

    private getFileName(chain: string) {
        const date = new Date();
        return `${chain}-${date.getFullYear()}-${date.getMonth()}-${date.getDay()}-${date.getHours()}-${date.getMinutes()}`
    }
}