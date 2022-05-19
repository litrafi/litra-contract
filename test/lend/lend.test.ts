import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { LendBookDeployer } from "../../scripts/deployer/lend/lend-book.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { LendSynchroniser } from "../../scripts/synchroniser/lend.synchroniser";
import { LendBook, Ntoken } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNtoken } from "../mock-util/deploy.util";
import { clear, currentTime, fastForward } from "../mock-util/env.util";
import { shouldThrow } from "../mock-util/expect-plus.util";

enum LendPeriod {
    ONE_WEEK,
    TWO_WEEK,
    ONE_MONTH,
    ONE_QUARTER,
    HALF_YEAR
}

enum LendStatus {
    ACTIVE,
    BORROWED,
    OVERDUE,
    CLOSED
}

describe('Lend', () => {
    let borrower: SignerWithAddress;
    let lender: SignerWithAddress;

    let lendBookContract: LendBook & Contract;
    let tnftContract: Ntoken & Contract;

    beforeEach(async () => {
        clear();

        const users = await ethers.getSigners();
        borrower = users[0];
        lender = users[1];

        await new LendSynchroniser().sychornise();

        lendBookContract = await new LendBookDeployer().getInstance();
        tnftContract = await deployMockNtoken(borrower.address);
    })

    it('Create lend', async () => {
        const PLEDGED_AMOUNT = BigNumber.from(E18).mul(2);
        const BORROW_AMOUNT = BigNumber.from(E18);
        const INTEREST_AMOUNT = BigNumber.from(E18).div(100);
        const LEND_PERIOD = LendPeriod.ONE_WEEK;
        // create lend
        const comparator = new BalanceComparator(borrower.address);
        await comparator.setBeforeBalance(tnftContract.address);

        await tnftContract.approve(lendBookContract.address, PLEDGED_AMOUNT);
        await lendBookContract.createLend(
            tnftContract.address,
            PLEDGED_AMOUNT,
            BORROW_AMOUNT,
            INTEREST_AMOUNT,
            LEND_PERIOD
        )
        // check assets change
        await comparator.setAfterBalance(tnftContract.address);
        const diff = comparator.compare(tnftContract.address);
        expect(diff).eq(PLEDGED_AMOUNT);
        // check lend list
        let list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.BORROWED);
        expect(list.length).eq(0);
        list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.ACTIVE);
        expect(list.length).eq(1);
        // check lend info 
        const lend = list[0];
        expect(lend.lendId).eq(0);
        expect(lend.borrower).eq(borrower.address);
        expect(lend.tnft).eq(tnftContract.address);
        expect(lend.pledgedAmount).eq(PLEDGED_AMOUNT);
        expect(lend.borrowAmount).eq(BORROW_AMOUNT);
        expect(lend.lendPeriod).eq(LEND_PERIOD);
        expect(lend.interest).eq(INTEREST_AMOUNT);
        expect(lend.lender).eq(ZERO);
        expect(lend.lendTime).eq(BigNumber.from(0));
        expect(lend.status).eq(LendStatus.ACTIVE);
        // check statistic data
        const totalTnfts = await lendBookContract.totalTnfts();
        const totalInterests = await lendBookContract.totalInterests();
        expect(totalTnfts).eq(PLEDGED_AMOUNT);
        expect(totalInterests).eq(INTEREST_AMOUNT);
    })

    it('Cancel lend',async () => {
        const PLEDGED_AMOUNT = BigNumber.from(E18).mul(2);
        const BORROW_AMOUNT = BigNumber.from(E18);
        const INTEREST_AMOUNT = BigNumber.from(E18).div(10);
        const LEND_PERIOD = LendPeriod.ONE_WEEK;
        // create lend
        await tnftContract.approve(lendBookContract.address, PLEDGED_AMOUNT);
        await lendBookContract.createLend(
            tnftContract.address,
            PLEDGED_AMOUNT,
            BORROW_AMOUNT,
            INTEREST_AMOUNT,
            LEND_PERIOD
        )
        // cancel lend
        const comaprator = new BalanceComparator(borrower.address);
        await comaprator.setBeforeBalance(tnftContract.address);
        // cancel by wrong user
        await shouldThrow(
            lendBookContract
                .connect(lender)
                .cancelLend(0),
            "Forbidden"
        )
        // cancel
        await lendBookContract.cancelLend(0);
        // check assets change
        await comaprator.setAfterBalance(tnftContract.address);
        const diff = comaprator.compare(tnftContract.address);
        expect(diff).eq(PLEDGED_AMOUNT);
        // check lend list
        const list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.CLOSED);
        expect(list.length).eq(1);
        // check lend info
        const lend = list[0];
        expect(lend.status).eq(LendStatus.CLOSED);
        // check statistic data
        const totalTnfts = await lendBookContract.totalTnfts();
        const totalInterests = await lendBookContract.totalInterests();
        expect(totalTnfts).eq(BigNumber.from(0));
        expect(totalInterests).eq(BigNumber.from(0));
        // cancel on wrong status
        await shouldThrow(
            lendBookContract.cancelLend(0),
            "Invalid lend"
        );
    })

    it('Lend', async () => {
        const PLEDGED_AMOUNT = BigNumber.from(E18).mul(2);
        const BORROW_AMOUNT = BigNumber.from(E18);
        const INTEREST_AMOUNT = BigNumber.from(E18).div(10);
        const LEND_PERIOD = LendPeriod.ONE_WEEK;
        // create lend
        await tnftContract.approve(lendBookContract.address, PLEDGED_AMOUNT);
        await lendBookContract.createLend(
            tnftContract.address,
            PLEDGED_AMOUNT,
            BORROW_AMOUNT,
            INTEREST_AMOUNT,
            LEND_PERIOD
        )
        // lend
        const borrowerComparator = new BalanceComparator(borrower.address);
        await borrowerComparator.setBeforeBalance(ZERO);
        // lend with wrong offer
        await shouldThrow(
            lendBookContract
                .connect(lender)
                .lend(0),
            "Wrong offer"
        )
        // lend
        const received = BORROW_AMOUNT.sub(INTEREST_AMOUNT);
        await lendBookContract
            .connect(lender)
            .lend(0, { value: received });
        // check assets chage
        await borrowerComparator.setAfterBalance(ZERO);
        const diff = await borrowerComparator.compare(ZERO);
        expect(diff).eq(received);
        // check lend list
        const list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.BORROWED);
        expect(list.length).eq(1);
        // check lend info
        const lend = list[0];
        expect(lend.status).eq(LendStatus.BORROWED);
        expect(lend.lender).eq(lender.address);
        // lend on wrong status
        shouldThrow(
            lendBookContract
                .connect(lender)
                .lend(0),
            "Invalid lend"
        )
    })

    it('Pay debt', async () => {
        const PLEDGED_AMOUNT = BigNumber.from(E18).mul(2);
        const BORROW_AMOUNT = BigNumber.from(E18);
        const INTEREST_AMOUNT = BigNumber.from(E18).div(10);
        const LEND_PERIOD = LendPeriod.ONE_WEEK;
        // create lend
        await tnftContract.approve(lendBookContract.address, PLEDGED_AMOUNT);
        await lendBookContract.createLend(
            tnftContract.address,
            PLEDGED_AMOUNT,
            BORROW_AMOUNT,
            INTEREST_AMOUNT,
            LEND_PERIOD
        )
        // lend
        await lendBookContract
            .connect(lender)
            .lend(0, { value: BORROW_AMOUNT.sub(INTEREST_AMOUNT) });
        // pay debt
        // repay by wrong user
        await shouldThrow(
            lendBookContract
                .connect(lender)
                .payBack(0, { value: BORROW_AMOUNT }),
            "Forbidden"
        )
        // repay with wrong offer
        await shouldThrow(
            lendBookContract
                .connect(borrower)
                .payBack(0),
            "Wrong offer"
        )
        // pay debt
        const borrowerComparator = new BalanceComparator(borrower.address);
        const lenderComparator = new BalanceComparator(lender.address);
        await borrowerComparator.setBeforeBalance(tnftContract.address);
        await lenderComparator.setBeforeBalance(ZERO);
        await lendBookContract.payBack(0, { value: BORROW_AMOUNT })
        // check assets change
        await borrowerComparator.setAfterBalance(tnftContract.address);
        await lenderComparator.setAfterBalance(ZERO);
        let diff = await borrowerComparator.compare(tnftContract.address);
        expect(diff).eq(PLEDGED_AMOUNT);
        diff = await lenderComparator.compare(ZERO);
        expect(diff).eq(BORROW_AMOUNT);
        // check lend list
        const list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.CLOSED);
        expect(list.length).eq(1);
        // check lend info
        const lend = list[0];
        expect(lend.status).eq(LendStatus.CLOSED);
        // pay debt on wrong status
        await shouldThrow(
            lendBookContract.payBack(0, { value: BORROW_AMOUNT }),
            "Invalid lend"
        )
    })

    it('Overdue', async () => {
        const PLEDGED_AMOUNT = BigNumber.from(E18).mul(2);
        const BORROW_AMOUNT = BigNumber.from(E18);
        const INTEREST_AMOUNT = BigNumber.from(E18).div(10);
        const LEND_PERIOD = LendPeriod.ONE_WEEK;
        const LEND_PERIOD_SECONDS = 3600 * 24 * 7;
        // create lend
        await tnftContract.approve(lendBookContract.address, PLEDGED_AMOUNT);
        await lendBookContract.createLend(
            tnftContract.address,
            PLEDGED_AMOUNT,
            BORROW_AMOUNT,
            INTEREST_AMOUNT,
            LEND_PERIOD
        )
        // lend
        await lendBookContract
            .connect(lender)
            .lend(0, { value: BORROW_AMOUNT.sub(INTEREST_AMOUNT) });
        await fastForward(LEND_PERIOD_SECONDS);
        // check lend info
        const list = await lendBookContract.getLendsInfoByFilter(true, LendStatus.OVERDUE);
        expect(list.length).eq(1);
        // check lend info
        const lend = list[0];
        expect(lend.status).eq(LendStatus.OVERDUE);
    })
})