const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("StakedCanto", () => {
  let accounts;
  let stakedCanto;
  let turnstile;
  let admin;
  let minter;
  let burner;
  let randomUser;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    [admin, minter, burner, randomUser] = accounts;
    const Turnstile = await ethers.getContractFactory("TurnstileMock");
    turnstile = await Turnstile.deploy();
    const StakedCanto = await ethers.getContractFactory("StakedCanto");
    stakedCanto = await upgrades.deployProxy(StakedCanto, [
      admin.address,
      turnstile.address,
    ]);
    await stakedCanto.deployed();

    // grant minter and burner roles
    await stakedCanto.grantRole(
      await stakedCanto.MINTER_ROLE(),
      minter.address
    );

    await stakedCanto.grantRole(
      await stakedCanto.BURNER_ROLE(),
      burner.address
    );
  });

  describe("deploy", () => {
    it("Should assign the admin role", async () => {
      expect(
        await stakedCanto.hasRole(await stakedCanto.ADMIN_ROLE(), admin.address)
      ).to.equal(true);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.ADMIN_ROLE(),
          minter.address
        )
      ).to.equal(false);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.ADMIN_ROLE(),
          burner.address
        )
      ).to.equal(false);
    });

    it("Should assign the minter role to the minter", async () => {
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.MINTER_ROLE(),
          minter.address
        )
      ).to.equal(true);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.MINTER_ROLE(),
          burner.address
        )
      ).to.equal(false);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.MINTER_ROLE(),
          admin.address
        )
      ).to.equal(false);
    });

    it("Should assign the burner role to the burner", async () => {
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.BURNER_ROLE(),
          burner.address
        )
      ).to.equal(true);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.BURNER_ROLE(),
          minter.address
        )
      ).to.equal(false);
      expect(
        await stakedCanto.hasRole(
          await stakedCanto.BURNER_ROLE(),
          admin.address
        )
      ).to.equal(false);
    });

    it("Should have a total supply of 0", async () => {
      expect(await stakedCanto.totalSupply()).to.equal(0);
    });

    it("should not allow initialize to be called again", async () => {
      await expect(
        stakedCanto.initialize(admin.address, turnstile.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("mint", () => {
    it("Should allow the minter to mint", async () => {
      await stakedCanto.connect(minter).mint(randomUser.address, 100);
      expect(await stakedCanto.balanceOf(randomUser.address)).to.equal(100);
    });

    it("Should not allow the burner to mint", async () => {
      await expect(
        stakedCanto.connect(burner).mint(randomUser.address, 100)
      ).to.be.revertedWith("StakedCanto: only minter");
    });

    it("Should not allow the admin to mint", async () => {
      await expect(
        stakedCanto.connect(admin).mint(randomUser.address, 100)
      ).to.be.revertedWith("StakedCanto: only minter");
    });

    it("Should emit an event when minting", async () => {
      await expect(stakedCanto.connect(minter).mint(randomUser.address, 100))
        .to.emit(stakedCanto, "Transfer")
        .withArgs(ethers.constants.AddressZero, randomUser.address, 100);
    });
  });

  describe("burn", () => {
    it("Should allow the burner to burn", async () => {
      await stakedCanto.connect(minter).mint(randomUser.address, 100);
      await stakedCanto.connect(burner).burn(randomUser.address, 100);
      expect(await stakedCanto.balanceOf(randomUser.address)).to.equal(0);
    });

    it("Should not allow the minter to burn", async () => {
      await expect(
        stakedCanto.connect(minter).burn(randomUser.address, 100)
      ).to.be.revertedWith("StakedCanto: only burner");
    });

    it("Should not allow the admin to burn", async () => {
      await expect(
        stakedCanto.connect(admin).burn(randomUser.address, 100)
      ).to.be.revertedWith("StakedCanto: only burner");
    });

    it("Should emit an event when burning", async () => {
      await stakedCanto.connect(minter).mint(randomUser.address, 100);
      await expect(stakedCanto.connect(burner).burn(randomUser.address, 100))
        .to.emit(stakedCanto, "Transfer")
        .withArgs(randomUser.address, ethers.constants.AddressZero, 100);
    });
  });
});
