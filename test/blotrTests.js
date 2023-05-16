const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BLOTRToken", () => {
  let accounts;
  let blotrToken;
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
    const BLOTRToken = await ethers.getContractFactory("BLOTRToken");
    blotrToken = await upgrades.deployProxy(BLOTRToken, [
      admin.address,
      turnstile.address,
    ]);
    await blotrToken.deployed();

    // grant minter and burner roles
    await blotrToken.grantRole(await blotrToken.MINTER_ROLE(), minter.address);

    await blotrToken.grantRole(await blotrToken.BURNER_ROLE(), burner.address);
  });

  describe("deploy", () => {
    it("Should assign the admin role", async () => {
      expect(
        await blotrToken.hasRole(await blotrToken.ADMIN_ROLE(), admin.address)
      ).to.equal(true);
      expect(
        await blotrToken.hasRole(await blotrToken.ADMIN_ROLE(), minter.address)
      ).to.equal(false);
      expect(
        await blotrToken.hasRole(await blotrToken.ADMIN_ROLE(), burner.address)
      ).to.equal(false);
    });

    it("Should assign the minter role to the minter", async () => {
      expect(
        await blotrToken.hasRole(await blotrToken.MINTER_ROLE(), minter.address)
      ).to.equal(true);
      expect(
        await blotrToken.hasRole(await blotrToken.MINTER_ROLE(), burner.address)
      ).to.equal(false);
      expect(
        await blotrToken.hasRole(await blotrToken.MINTER_ROLE(), admin.address)
      ).to.equal(false);
    });

    it("Should assign the burner role to the burner", async () => {
      expect(
        await blotrToken.hasRole(await blotrToken.BURNER_ROLE(), burner.address)
      ).to.equal(true);
      expect(
        await blotrToken.hasRole(await blotrToken.BURNER_ROLE(), minter.address)
      ).to.equal(false);
      expect(
        await blotrToken.hasRole(await blotrToken.BURNER_ROLE(), admin.address)
      ).to.equal(false);
    });

    it("Should have a total supply of 0", async () => {
      expect(await blotrToken.totalSupply()).to.equal(0);
    });

    it("should not allow initialize to be called again", async () => {
      await expect(
        blotrToken.initialize(admin.address, turnstile.address)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("mint", () => {
    it("Should allow the minter to mint", async () => {
      await blotrToken.connect(minter).mint(randomUser.address, 100);
      expect(await blotrToken.balanceOf(randomUser.address)).to.equal(100);
    });

    it("Should not allow the burner to mint", async () => {
      await expect(
        blotrToken.connect(burner).mint(randomUser.address, 100)
      ).to.be.revertedWith("BLOTR: only minter");
    });

    it("Should not allow the admin to mint", async () => {
      await expect(
        blotrToken.connect(admin).mint(randomUser.address, 100)
      ).to.be.revertedWith("BLOTR: only minter");
    });

    it("Should emit an event when minting", async () => {
      await expect(blotrToken.connect(minter).mint(randomUser.address, 100))
        .to.emit(blotrToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, randomUser.address, 100);
    });
  });

  describe("burn", () => {
    it("Should allow the burner to burn", async () => {
      await blotrToken.connect(minter).mint(randomUser.address, 100);
      await blotrToken.connect(burner).burn(randomUser.address, 100);
      expect(await blotrToken.balanceOf(randomUser.address)).to.equal(0);
    });

    it("Should not allow the minter to burn", async () => {
      await expect(
        blotrToken.connect(minter).burn(randomUser.address, 100)
      ).to.be.revertedWith("BLOTR: only burner");
    });

    it("Should not allow the admin to burn", async () => {
      await expect(
        blotrToken.connect(admin).burn(randomUser.address, 100)
      ).to.be.revertedWith("BLOTR: only burner");
    });

    it("Should emit an event when burning", async () => {
      await blotrToken.connect(minter).mint(randomUser.address, 100);
      await expect(blotrToken.connect(burner).burn(randomUser.address, 100))
        .to.emit(blotrToken, "Transfer")
        .withArgs(randomUser.address, ethers.constants.AddressZero, 100);
    });
  });
});
