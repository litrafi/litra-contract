import { AmmSynchroniser } from "./synchroniser/amm.synchroniser";
import { LendSynchroniser } from "./synchroniser/lend.synchroniser";
import { OptionSynchroniser } from "./synchroniser/option.synchroniser";
import { OrderSynchroniser } from "./synchroniser/order.synchroniser";
import { TokenizeSynchroniser } from "./synchroniser/tokenize.synchroniser";

async function synchroniseAll() {
    await new TokenizeSynchroniser().sychornise();
    await new AmmSynchroniser().sychornise();
    await new OrderSynchroniser().sychornise();
    await new OptionSynchroniser().sychornise();
    await new LendSynchroniser().sychornise();
}

synchroniseAll();