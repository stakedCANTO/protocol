const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OptionToken", () => {
  let accounts;
  let stakedCanto;
  let blotr;
  let oBlotr;
  let turnstile;
  let admin;
  let randomUser;
  let treasury;
  let pauser;
  let velocimeterPair;
  const initialDiscount = 50; // 50 percent
  const nftID = 675;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [admin, randomUser, pauser, treasury] = accounts;

    // deploy our mock turnstile
    const Turnstile = await ethers.getContractFactory("TurnstileMock");
    turnstile = await Turnstile.deploy();

    // deploy our mock BLOTR token
    const BLOTRToken = await ethers.getContractFactory("BLOTRToken");
    blotr = await upgrades.deployProxy(BLOTRToken, [
      admin.address,
      turnstile.address,
    ]);
    await blotr.deployed();

    // deploy sCANTO
    const StakedCanto = await ethers.getContractFactory("StakedCanto");
    stakedCanto = await upgrades.deployProxy(StakedCanto, [
      admin.address,
      turnstile.address,
    ]);
    await stakedCanto.deployed();

    // deploy our mock velocimeter pair
    const VelocimeterPair = await ethers.getContractFactory("PairMock");
    velocimeterPair = await VelocimeterPair.deploy();

    const OptionToken = await ethers.getContractFactory("OptionToken");
    oBlotr = await OptionToken.deploy(
      "Blotr Option Token",
      "oBlotr",
      admin.address,
      stakedCanto.address,
      blotr.address,
      velocimeterPair.address,
      treasury.address,
      initialDiscount,
      turnstile.address,
      nftID
    );

    // grant pauser role
    await oBlotr.grantRole(await oBlotr.PAUSER_ROLE(), pauser.address);

    // grant admin minter role for testing with blotr and stakedCanto
    await blotr.grantRole(await blotr.MINTER_ROLE(), admin.address);
    await stakedCanto.grantRole(await stakedCanto.MINTER_ROLE(), admin.address);
  });

  describe("deploy", () => {
    it("Should assign the admin role", async () => {
      expect(
        await oBlotr.hasRole(await oBlotr.ADMIN_ROLE(), admin.address)
      ).to.equal(true);

      expect(
        await oBlotr.hasRole(await oBlotr.ADMIN_ROLE(), randomUser.address)
      ).to.equal(false);

      expect(
        await oBlotr.hasRole(await oBlotr.PAUSER_ROLE(), admin.address)
      ).to.equal(false);
    });

    it("Should have a total supply of 0", async () => {
      expect(await oBlotr.totalSupply()).to.equal(0);
    });

    it("Should have 18 decimals", async () => {
      expect(await oBlotr.decimals()).to.equal(18);
    });

    it("should set all state correctly", async () => {
      expect(await oBlotr.paymentToken()).to.equal(stakedCanto.address);
      expect(await oBlotr.underlyingToken()).to.equal(blotr.address);
      expect(await oBlotr.pair()).to.equal(velocimeterPair.address);
      expect(await oBlotr.treasury()).to.equal(treasury.address);
      expect(await oBlotr.discount()).to.equal(initialDiscount);
    });
  });

  describe("setPair", () => {
    it("Should allow the admin to set the pair", async () => {
      await oBlotr.setPair(randomUser.address);
      expect(await oBlotr.pair()).to.equal(randomUser.address);
    });

    it("Should not allow a non-admin to set the pair", async () => {
      await expect(
        oBlotr.connect(randomUser).setPair(randomUser.address)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
      await expect(
        oBlotr.connect(pauser).setPair(randomUser.address)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
    });
  });

  describe("setTreasury", () => {
    it("Should allow the admin to set the treasury", async () => {
      await oBlotr.setTreasury(randomUser.address);
      expect(await oBlotr.treasury()).to.equal(randomUser.address);
    });

    it("Should not allow a non-admin to set the treasury", async () => {
      await expect(
        oBlotr.connect(randomUser).setTreasury(randomUser.address)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
      await expect(
        oBlotr.connect(pauser).setTreasury(randomUser.address)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
    });
  });

  describe("setDiscount", () => {
    it("Should allow the admin to set the discount", async () => {
      await oBlotr.setDiscount(100);
      expect(await oBlotr.discount()).to.equal(100);
    });

    it("Should not allow a non-admin to set the discount", async () => {
      await expect(
        oBlotr.connect(randomUser).setDiscount(100)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
      await expect(oBlotr.connect(pauser).setDiscount(100)).to.be.revertedWith(
        "OptionToken_NoAdminRole"
      );
    });

    it("Should not allow a discount greater than 100", async () => {
      await expect(oBlotr.setDiscount(101)).to.be.revertedWith(
        "OptionToken_InvalidDiscount"
      );
    });

    it("Should not allow a discount equal to 0", async () => {
      await expect(oBlotr.setDiscount(0)).to.be.revertedWith(
        "OptionToken_InvalidDiscount"
      );
    });
  });

  describe("setTwapPoints", () => {
    it("Should allow the admin to change the number of points", async () => {
      await oBlotr.setTwapPoints(20);
      expect(await oBlotr.twapPoints()).to.equal(20);
    });

    it("Should not allow a non-admin to change the number of points", async () => {
      await expect(
        oBlotr.connect(randomUser).setTwapPoints(20)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
      await expect(oBlotr.connect(pauser).setTwapPoints(20)).to.be.revertedWith(
        "OptionToken_NoAdminRole"
      );
    });

    it("Should not allow a discount greater than 100", async () => {
      await expect(oBlotr.setTwapPoints(101)).to.be.revertedWith(
        "OptionToken_InvalidTwapPoints"
      );
    });

    it("Should not allow a discount equal to 0", async () => {
      await expect(oBlotr.setTwapPoints(0)).to.be.revertedWith(
        "OptionToken_InvalidTwapPoints"
      );
    });

    it("Calculations work regardless of points", async () => {
      const amountIn = ethers.utils.parseEther("100");
      const originalPrice = await oBlotr.getTimeWeightedAveragePrice(amountIn);

      await oBlotr.setTwapPoints(20);
      let newPrice = await oBlotr.getTimeWeightedAveragePrice(amountIn);
      expect(originalPrice).to.not.equal(newPrice);

      await oBlotr.setTwapPoints(1);
      newPrice = await oBlotr.getTimeWeightedAveragePrice(amountIn);
      expect(newPrice).to.equal(amountIn.div(6).mul(110).div(100));

      // doesn't overflow with 50 points and a large input
      await oBlotr.setTwapPoints(50);
      const whaleSize = ethers.utils.parseEther("100000000000000000000");
      newPrice = await oBlotr.getTimeWeightedAveragePrice(whaleSize);
    });
  });

  describe("Pause", () => {
    it("Should allow only the pauser to pause", async () => {
      await expect(oBlotr.pause()).to.be.revertedWith(
        "OptionToken_NoPauserRole"
      );
      await expect(oBlotr.connect(randomUser).pause()).to.be.revertedWith(
        "OptionToken_NoPauserRole"
      );
      await oBlotr.connect(pauser).pause();
      expect(await oBlotr.isPaused()).to.equal(true);
    });

    it("Should only allow the admin to unPause", async () => {
      await oBlotr.connect(pauser).pause();
      expect(await oBlotr.isPaused()).to.equal(true);
      await expect(oBlotr.connect(randomUser).unPause()).to.be.revertedWith(
        "OptionToken_NoAdminRole"
      );
      await expect(oBlotr.connect(pauser).unPause()).to.be.revertedWith(
        "OptionToken_NoAdminRole"
      );
      await oBlotr.connect(admin).unPause();
      expect(await oBlotr.isPaused()).to.equal(false);
    });
  });

  describe("Mint", () => {
    it("admin can mint oBlotr 1:1 with Blotr", async () => {
      await blotr.mint(admin.address, 100);
      await blotr.connect(admin).approve(oBlotr.address, 100);
      await oBlotr.connect(admin).mint(randomUser.address, 100);
      expect(await oBlotr.balanceOf(randomUser.address)).to.equal(100);
      expect(await blotr.balanceOf(oBlotr.address)).to.equal(100);
      expect(await oBlotr.totalSupply()).to.equal(100);
    });

    it("non admin can not mint", async () => {
      await blotr.mint(randomUser.address, 100);
      await blotr.connect(randomUser).approve(oBlotr.address, 100);
      await expect(
        oBlotr.connect(randomUser).mint(randomUser.address, 100)
      ).to.be.revertedWith("OptionToken_NoAdminRole");
      expect(await oBlotr.totalSupply()).to.equal(0);
    });
  });

  describe("Burn", () => {
    it("admin can burn oBlotr 1:1 for Blotr", async () => {
      await blotr.mint(admin.address, 100);
      await blotr.connect(admin).approve(oBlotr.address, 100);
      await oBlotr.connect(admin).mint(admin.address, 100);
      expect(await oBlotr.balanceOf(admin.address)).to.equal(100);
      expect(await blotr.balanceOf(oBlotr.address)).to.equal(100);

      await oBlotr.connect(admin).burn(50);
      expect(await oBlotr.balanceOf(admin.address)).to.equal(50);
      expect(await blotr.balanceOf(admin.address)).to.equal(50);
      expect(await blotr.balanceOf(oBlotr.address)).to.equal(50);
    });

    it("non admin can not burn", async () => {
      await blotr.mint(randomUser.address, 100);
      await blotr.connect(randomUser).approve(oBlotr.address, 100);
      await expect(oBlotr.connect(randomUser).burn(50)).to.be.revertedWith(
        "OptionToken_NoAdminRole"
      );
    });
  });

  describe("Exercise", () => {
    let initialBalance;

    beforeEach(async () => {
      initialBalance = ethers.utils.parseEther("100");
      await blotr.mint(admin.address, initialBalance);
      await blotr.connect(admin).approve(oBlotr.address, initialBalance);
      await oBlotr.connect(admin).mint(randomUser.address, initialBalance);
      expect(await oBlotr.balanceOf(randomUser.address)).to.equal(
        initialBalance
      );
    });

    it("fails when called with insufficient balance of oBlotr", async () => {
      expect(await oBlotr.balanceOf(randomUser.address)).to.equal(
        initialBalance
      );
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](
            initialBalance.add(1),
            120,
            randomUser.address
          )
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");

      expect(await oBlotr.balanceOf(admin.address)).to.equal(0);
      await expect(
        oBlotr
          .connect(admin)
          ["exercise(uint256,uint256,address)"](1, 120, randomUser.address)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("fails when called with insufficient approval / balance of sCANTO", async () => {
      expect(await oBlotr.balanceOf(randomUser.address)).to.equal(
        initialBalance
      );
      expect(await stakedCanto.balanceOf(randomUser.address)).to.equal(0);
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](100, 1000, randomUser.address)
      ).to.be.revertedWith("ERC20: insufficient allowance");

      // get strike price
      const oBlotrBalance = await oBlotr.balanceOf(randomUser.address);
      const strikePrice = await oBlotr.getDiscountedPrice(oBlotrBalance);
      // determine the amount of sCANTO we expect to pay
      const sCantoCost = strikePrice
        .mul(oBlotrBalance)
        .div(ethers.utils.parseEther("1"));

      await stakedCanto.connect(randomUser).approve(oBlotr.address, sCantoCost);
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](
            initialBalance,
            sCantoCost,
            randomUser.address
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("correctly issues BLOTR to caller and emits an event", async () => {
      // get strike price
      const oBlotrBalance = await oBlotr.balanceOf(randomUser.address);
      // determine the amount of sCANTO we expect to spend
      const sCantoCost = await oBlotr.getDiscountedPrice(oBlotrBalance);

      // mint stakedCanto to randomUser so they can exercise
      await stakedCanto.mint(randomUser.address, sCantoCost);
      await stakedCanto.connect(randomUser).approve(oBlotr.address, sCantoCost);

      // should fail if we set a lower maxPaymentAmount
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](
            oBlotrBalance,
            sCantoCost.sub(1),
            randomUser.address
          )
      ).to.be.revertedWith("OptionToken_SlippageTooHigh");

      // should fail if we set a deadline which is past.
      const blockTime = await ethers.provider
        .getBlock("latest")
        .then((block) => block.timestamp);
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address,uint256)"](
            oBlotrBalance,
            sCantoCost,
            randomUser.address,
            blockTime - 1
          )
      ).to.be.revertedWith("OptionToken_PastDeadline");

      // should work if we use our calculated amount
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](
            oBlotrBalance,
            sCantoCost,
            randomUser.address
          )
      )
        .to.emit(oBlotr, "Exercise")
        .withArgs(
          randomUser.address,
          randomUser.address,
          oBlotrBalance,
          sCantoCost
        );

      // check that the balances are correct
      expect(await oBlotr.balanceOf(randomUser.address)).to.equal(0);
      expect(await stakedCanto.balanceOf(randomUser.address)).to.equal(0);
      expect(await blotr.balanceOf(randomUser.address)).to.equal(oBlotrBalance);
    });

    it("reverts when paused", async () => {
      await oBlotr.connect(pauser).pause();
      expect(await oBlotr.isPaused()).to.equal(true);
      await expect(
        oBlotr
          .connect(randomUser)
          ["exercise(uint256,uint256,address)"](100, 120, randomUser.address)
      ).to.be.revertedWith("OptionToken_Paused");
    });
  });
});
