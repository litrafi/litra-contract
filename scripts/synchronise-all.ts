import { AuctionSynchroniser } from "./synchroniser/auction.syncrhoniser";
import { DashboardSynchroniser } from "./synchroniser/dashboard.synchroniser";
import { LendSynchroniser } from "./synchroniser/lend.synchroniser";
import { OptionSynchroniser } from "./synchroniser/option.synchroniser";
import { TokenizeSynchroniser } from "./synchroniser/tokenize.synchroniser";

async function synchroniseAll() {
    await new TokenizeSynchroniser().sychornise();
    await new OptionSynchroniser().sychornise();
    await new LendSynchroniser().sychornise();
    await new AuctionSynchroniser().sychornise();
    await new DashboardSynchroniser().sychornise();
}

synchroniseAll();