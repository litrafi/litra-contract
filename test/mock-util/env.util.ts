import { DeployRecorder } from "../../scripts/lib/deploy-recorder";

export function clear() {
    DeployRecorder.getDeployRecorder().clearTestRecorder();
}

export function getNowRoughly() {
    return Math.floor(Date.now() / 1000)
}