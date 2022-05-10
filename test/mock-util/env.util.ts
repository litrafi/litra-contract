import { DeployRecorder } from "../../scripts/lib/deploy-recorder";

export function clear() {
    DeployRecorder.getDeployRecorder().clearTestRecorder();
}