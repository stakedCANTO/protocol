const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const {
  time,
  setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");

describe("Minter", () => {
  let accounts;
  let stakedCanto;
  let turnstile;
  let minter;
  let admin;
  let treasury;
  let startingTimeStamp;
  const initialYield = 500000;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [admin, treasury] = accounts;
    const Turnstile = await ethers.getContractFactory("TurnstileMock");
    turnstile = await Turnstile.deploy();
    const StakedCanto = await ethers.getContractFactory("StakedCanto");
    stakedCanto = await upgrades.deployProxy(StakedCanto, [
      admin.address,
      turnstile.address,
    ]);
    await stakedCanto.deployed();

    // deploy minter contract with 5% yield and 1:1 initial rate
    const Minter = await ethers.getContractFactory("Minter");
    minter = await Minter.deploy(
      stakedCanto.address,
      treasury.address,
      turnstile.address,
      ethers.constants.WeiPerEther,
      initialYield
    );
    startingTimeStamp = await minter.lastUpdated();

    // grant the minter the mint role
    await stakedCanto.grantRole(
      await stakedCanto.MINTER_ROLE(),
      minter.address
    );
  });

  it("deploys with correct vars", async () => {
    expect((await minter.initialExchangeRate()).toString()).to.equal(
      ethers.constants.WeiPerEther.toString()
    );
    expect((await minter.yield()).toString()).to.equal("500000");
    expect(await minter.sCANTO()).to.equal(stakedCanto.address);
    expect(await minter.treasury()).to.equal(treasury.address);
    expect((await minter.YEAR()).toString()).to.equal("31536000");
  });

  describe("setYield", () => {
    it("updates the exchange rate correctly over time", async () => {
      const currentExchangeRate = await minter.initialExchangeRate();
      // advance time one year from start, we should see a ~5% increase
      let expectedExchangeRate = currentExchangeRate.mul("105").div("100");
      await time.increaseTo(startingTimeStamp.add(31536000)); // increase one year
      expect((await minter.getCurrentExchangeRate()).toString()).to.equal(
        expectedExchangeRate.toString()
      );

      await time.increase(31536000); // increase one year
      expectedExchangeRate = currentExchangeRate.mul("110").div("100");
      expect((await minter.getCurrentExchangeRate()).toString()).to.equal(
        expectedExchangeRate.toString()
      );

      // if we now increase the yield to ~12% we should see roughly 22% yield
      await minter.setYield(1200000);
      await time.increase(31536000); // increase one year
      expectedExchangeRate = currentExchangeRate.mul("122").div("100");
      expect((await minter.getCurrentExchangeRate()).toString()).to.equal(
        expectedExchangeRate.toString()
      );
    });

    it("more frequent updates don't affect the exchange rate correctly over time", async () => {
      const currentExchangeRate = await minter.initialExchangeRate();
      // over one year, if we have 6 months of 6% and 6 months of 4% we should net 5% returns
      const expectedExchangeRate = currentExchangeRate.mul("105").div("100");
      await minter.setYield(600000);
      await time.increaseTo(startingTimeStamp.add(31536000 / 2)); // increase 6 months from start
      await minter.setYield(400000);
      await time.increase(31536000 / 2); // increase 6 months
      const diff = (await minter.getCurrentExchangeRate()).sub(
        expectedExchangeRate
      );
      expect(diff.lt("1000000000000")).to.be.true;
    });

    it("emits an event", async () => {
      await expect(minter.setYield(600000))
        .to.emit(minter, "YieldUpdated")
        .withArgs(initialYield, 600000, await minter.getCurrentExchangeRate());
    });

    it("reverts if not called by admin", async () => {
      await expect(
        minter.connect(accounts[1]).setYield(600000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setTreasury", () => {
    it("updates the treasury address", async () => {
      const newTreasury = accounts[1];
      await minter.setTreasury(newTreasury.address);
      expect(await minter.treasury()).to.equal(newTreasury.address);
    });

    it("emits an event", async () => {
      const originalAddress = await minter.treasury();
      const newTreasury = accounts[5];
      await expect(minter.setTreasury(newTreasury.address))
        .to.emit(minter, "TreasuryUpdated")
        .withArgs(originalAddress, newTreasury.address);
    });

    it("reverts if not called by admin", async () => {
      const newTreasury = accounts[1];
      await expect(
        minter.connect(accounts[1]).setTreasury(newTreasury.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("mint", () => {
    it("mints sCANTO at correct rate and sends proceeds to treasury", async () => {
      const user1Account = accounts[5];
      let minAmountToMint = "999999";
      const amountToSend = "1000000";
      const initialTreasuryBalance = await ethers.provider.getBalance(
        treasury.address
      );
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal("0");
      await minter.mint(user1Account.address, minAmountToMint, {
        value: amountToSend,
      });
      const expectedTreasuryBalance = initialTreasuryBalance.add(amountToSend);
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal(minAmountToMint);
      expect(
        (await ethers.provider.getBalance(treasury.address)).toString()
      ).to.equal(expectedTreasuryBalance.toString());

      // advance time to see the cost of minting increase.
      await time.increaseTo(startingTimeStamp.add(31536000)); // increase 1 year from start
      const user2Account = accounts[6];
      expect(
        (await stakedCanto.balanceOf(user2Account.address)).toString()
      ).to.equal("0");
      minAmountToMint = ethers.BigNumber.from(minAmountToMint)
        .mul(100)
        .div(105);
      await minter.mint(user2Account.address, minAmountToMint, {
        value: amountToSend,
      });
      expect(
        (await stakedCanto.balanceOf(user2Account.address)).toString()
      ).to.equal(minAmountToMint.toString());
    });

    it("mints sCANTO at correct rate and sends proceeds to treasury when initialExchange Rate is not 1:1", async () => {
      // deploy minter contract with 5% yield and 2:1 initial rate
      const Minter = await ethers.getContractFactory("Minter");
      minter = await Minter.deploy(
        stakedCanto.address,
        treasury.address,
        turnstile.address,
        ethers.constants.WeiPerEther.mul("2"),
        initialYield
      );
      startingTimeStamp = await minter.lastUpdated();

      // grant the minter the mint role
      await stakedCanto.grantRole(
        await stakedCanto.MINTER_ROLE(),
        minter.address
      );

      const user1Account = accounts[5];
      let minAmountToMint = "499999";
      const amountToSend = "1000000";
      const initialTreasuryBalance = await ethers.provider.getBalance(
        treasury.address
      );
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal("0");
      await minter.mint(user1Account.address, minAmountToMint, {
        value: amountToSend,
      });
      const expectedTreasuryBalance = initialTreasuryBalance.add(amountToSend);
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal(minAmountToMint);
      expect(
        (await ethers.provider.getBalance(treasury.address)).toString()
      ).to.equal(expectedTreasuryBalance.toString());

      // advance time to see the cost of minting increase.
      await time.increaseTo(startingTimeStamp.add(31536000)); // increase 1 year from start
      const user2Account = accounts[6];
      expect(
        (await stakedCanto.balanceOf(user2Account.address)).toString()
      ).to.equal("0");
      minAmountToMint = ethers.BigNumber.from(minAmountToMint)
        .mul(100)
        .div(105);
      await minter.mint(user2Account.address, minAmountToMint, {
        value: amountToSend,
      });
      expect(
        (await stakedCanto.balanceOf(user2Account.address)).toNumber()
      ).to.be.approximately(minAmountToMint.toNumber(), 1);
    });

    it("reverts if no CANTO sent", async () => {
      const user1Account = accounts[5];
      const minAmountToMint = "1000000";
      await expect(
        minter.mint(user1Account.address, minAmountToMint)
      ).to.be.revertedWith("StakedCantoMinter: must supply CANTO");
    });

    it("reverts if min sCANTO wont be met", async () => {
      const user1Account = accounts[5];
      const minAmountToMint = "1500000";
      const amountToSend = "1000000";
      await expect(
        minter.mint(user1Account.address, minAmountToMint, {
          value: amountToSend,
        })
      ).to.be.revertedWith("StakedCantoMinter: less than min");
    });

    it("can handle total supply of CANTO", async () => {
      const user1Account = accounts[5];
      const cantoTotalSupply = ethers.utils.parseEther("1000000000"); // 1 billion canto
      const cantoTotalSupplyPlusGas = cantoTotalSupply.add(
        ethers.utils.parseEther("1")
      );
      const expectedStakedCanto = cantoTotalSupply.sub(
        ethers.utils.parseEther("4")
      ); // rounding errors lead to a loss of ~4 CANTO if total supply is minted
      const initialTreasuryBalance = await ethers.provider.getBalance(
        treasury.address
      );
      await setBalance(user1Account.address, cantoTotalSupplyPlusGas);
      await minter
        .connect(user1Account)
        .mint(user1Account.address, expectedStakedCanto, {
          value: cantoTotalSupply,
        });

      const expectedTreasuryBalance =
        initialTreasuryBalance.add(cantoTotalSupply);

      expect(
        (await stakedCanto.balanceOf(user1Account.address)).gt(
          expectedStakedCanto
        )
      ).to.be.true;

      expect(
        (await ethers.provider.getBalance(treasury.address)).toString()
      ).to.equal(expectedTreasuryBalance.toString());
    });
  });

  describe("receive", () => {
    it("mints sCANTO when sent CANTO", async () => {
      const user1Account = accounts[5];
      const amountToSend = "1000000";
      const expectedAmount = ethers.BigNumber.from(amountToSend).sub(1);
      const initialTreasuryBalance = await ethers.provider.getBalance(
        treasury.address
      );
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal("0");
      await user1Account.sendTransaction({
        to: minter.address,
        value: amountToSend,
      });
      const expectedTreasuryBalance = initialTreasuryBalance.add(amountToSend);
      expect(
        (await stakedCanto.balanceOf(user1Account.address)).toString()
      ).to.equal(expectedAmount);

      expect(
        (await ethers.provider.getBalance(treasury.address)).toString()
      ).to.equal(expectedTreasuryBalance.toString());
    });
  });
});
