import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import '@openzeppelin/hardhat-upgrades';
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-vyper";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "./tasks";

dotenv.config();

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const accounts = process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];
const config: HardhatUserConfig = {
  vyper: {
    compilers: [
      { version: '0.2.15' },
      { version: '0.2.7' },
      { version: '0.2.4' },
      { version: '0.2.8' },
      { version: '0.3.1' },
    ]
  },
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 700,
          },
        },
      },
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
        },
      },
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 800,
          },
          metadata: {
            // do not include the metadata hash, since this is machine dependent
            // and we want all generated code to be deterministic
            // https://docs.soliditylang.org/en/v0.7.6/metadata.html
            bytecodeHash: 'none',
          },
        },
      },
      {
        version: "0.4.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
      {
        version: "0.6.12",    // Fetch exact version from solc-bin (default: truffle's version)
        settings: {          // See the solidity docs for advice about optimization and evmVersion
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    mainnet: {
      url: "https://mainnet.infura.io/v3/e15030b2cb93458ea41651c02afee982",
      accounts
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/e15030b2cb93458ea41651c02afee982",
      accounts
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/e15030b2cb93458ea41651c02afee982",
      accounts
    },
    goerli: {
      url: "https://goerli.infura.io/v3/e15030b2cb93458ea41651c02afee982",
      accounts
    },
    sepolia: {
      url: 'https://rpc.sepolia.org',
      accounts
    },
    bnbTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts
    },
    polygon: {
      url: 'https://polygon-rpc.com',
      accounts
    },
    alpha: {
      url: 'https://angelbond.io/test-node/',
      accounts: ['0x9315888774de61ca42bf96e7c721a44243426ed14079dfadef75f5372cf604ca']
    }
  },
  // gasReporter: {
  //   enabled: process.env.REPORT_GAS !== undefined,
  //   currency: "USD",
  // },
  etherscan: {
    apiKey: {
      rinkeby: process.env.ETHERSCAN_API_KEY,
      ropsten: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGON_API_KEY
    }
  },
};

export default config;
