import { clear } from "./mock-util/env.util"
import { deployAll } from "../scripts/deploy-all";

describe('Deploy all', () => {
    it('run script', async () => {
        clear();
        await deployAll()
    })
})