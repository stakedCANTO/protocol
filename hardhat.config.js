require("@nomiclabs/hardhat-waffle");
// require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-deploy");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    canto: {
      url: `https://velocimeter.tr.zone`,
      chainId: 7700,
    },
  },
  namedAccounts: {
    admin: {
      default: 0,
    },
    treasury: {
      default: 1,
    },
  },
};
