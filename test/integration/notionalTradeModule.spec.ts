import "module-alias/register";

import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";

import { Account, ForkedTokens } from "@utils/test/types";
import DeployHelper from "@utils/deploys";
import { ether } from "@utils/index";
import {
  cacheBeforeEach,
  getAccounts,
  getForkedTokens,
  getRandomAccount,
  getSystemFixture,
  getWaffleExpect,
  initializeForkedTokens,
} from "@utils/test/index";

import { SystemFixture } from "@utils/fixtures";
import {
  SetToken,
  DebtIssuanceModuleV2,
  INotionalProxy,
  ManagerIssuanceHookMock,
  NotionalTradeModule,
  WrappedfCash,
  WrappedfCashFactory,
} from "@utils/contracts";

import { IERC20 } from "@typechain/IERC20";
import { IERC20Metadata } from "@typechain/IERC20Metadata";
import { NBeaconProxy } from "@typechain/NBeaconProxy";
import { NBeaconProxy__factory } from "@typechain/factories/NBeaconProxy__factory";
import { NUpgradeableBeacon } from "@typechain/NUpgradeableBeacon";
import { NUpgradeableBeacon__factory } from "@typechain/factories/NUpgradeableBeacon__factory";
import { MAX_UINT_256 } from "@utils/constants";

const expect = getWaffleExpect();

/**
 * Tests the icETH rebalance flow.
 *
 * The icETH product is a composite product composed of:
 * 1. stETH
 * 2. WETH
 */
describe("Notional trade module integration [ @forked-mainnet ]", () => {
  const notionalProxyAddress = "0x1344a36a1b56144c3bc62e7757377d288fde0369";
  const cdaiAddress = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
  let notionalProxy: INotionalProxy;

  beforeEach(async () => {
    notionalProxy = (await ethers.getContractAt(
      "INotionalProxy",
      notionalProxyAddress,
    )) as INotionalProxy;
  });

  describe("Test notional proxy", async () => {
    // // cacheBeforeEach(initialize);
    // const daiCurrencyId = 2;
    // it("owner should work", async () => {
    //   const owner = await notionalProxy.owner();
    // });
    // it("max currency id should work", async () => {
    //   const maxCurrencyId = await notionalProxy.getMaxCurrencyId();
    //   expect(maxCurrencyId).to.eq(4);
    // });
    // it("getCurrencyId should work", async () => {
    //   const currencyId = await notionalProxy.getCurrencyId(cdaiAddress);
    //   expect(currencyId).to.eq(daiCurrencyId);
    // });
    // describe("When currencyId is valid", () => {
    //   [1, 2, 3, 4].forEach((currencyId) => {
    //     describe(`With currencyId: ${currencyId}`, () => {
    //       it("getCurrency should work", async () => {
    //         const { underlyingToken, assetToken } = await notionalProxy.getCurrency(currencyId);
    //         const underlyingContract = (await ethers.getContractAt(
    //           "IERC20Metadata",
    //           underlyingToken.tokenAddress,
    //         )) as IERC20Metadata;
    //         const tokenSymbol =
    //           underlyingToken.tokenAddress == constants.AddressZero
    //             ? "ETH"
    //             : await underlyingContract.symbol();
    //         console.log("Underlying token", {
    //           assetAddress: assetToken.tokenAddress,
    //           underlyingAddress: underlyingToken.tokenAddress,
    //           symbol: tokenSymbol,
    //         });
    //       });

    //       it("getDepositParameters should work", async () => {
    //         await notionalProxy.getDepositParameters(currencyId);
    //       });

    //       it("getInitializationParameters should work", async () => {
    //         await notionalProxy.getInitializationParameters(currencyId);
    //       });

    //       it("getRateStorage should work", async () => {
    //         await notionalProxy.getRateStorage(currencyId);
    //       });

    //       it("getCurrencyAndRates should work", async () => {
    //         await notionalProxy.getCurrencyAndRates(currencyId);
    //       });

    //       it("getActiveMarkets should work", async () => {
    //         const activeMarkets = await notionalProxy.getActiveMarkets(currencyId);
    //         expect(activeMarkets.length).to.be.gte(2);
    //       });

    //       describe("When the maturity is valid", () => {
    //         let maturity: number;
    //         let referenceTime: number;
    //         beforeEach(async () => {
    //           const secondsInQuarter = 3 * 30 * 24 * 60 * 60;
    //           const latestBlock = await ethers.provider.getBlock("latest");
    //           const blockTime = latestBlock.timestamp;
    //           referenceTime = blockTime - (blockTime % secondsInQuarter);
    //           const quarters = referenceTime / secondsInQuarter;
    //           maturity = referenceTime + secondsInQuarter;
    //         });
    //         it("getSettlementRate should work", async () => {
    //           const settlementRate = await notionalProxy.getSettlementRate(currencyId, maturity);
    //           expect(settlementRate.underlyingDecimals.gt(0)).to.be.true;
    //         });
    //         it("getMarket should work", async () => {
    //           const marketData = await notionalProxy.getMarket(currencyId, maturity, maturity);
    //           expect(marketData.maturity).to.eq(maturity);
    //         });
    //       });
    //     });
    //   });
    // });
    // describe("When currency id is invalid", () => {
    //   const invalidCurrencyId = 5;
    //   it("getActiveMarkets should revert correctly", async () => {
    //     await expect(notionalProxy.getActiveMarkets(invalidCurrencyId)).to.be.revertedWith(
    //       "Invalid currency id",
    //     );
    //   });
    // });
  });

  describe("Test WrappedfCash contract", () => {
    let owner: Account;
    let manager: Account;

    let deployer: DeployHelper;

    let setup: SystemFixture;
    let tokens: ForkedTokens;

    let weth: IERC20;
    let steth: IERC20;
    let debtIssuanceModule: DebtIssuanceModuleV2;
    let mockPreIssuanceHook: ManagerIssuanceHookMock;
    let notionalTradeModule: NotionalTradeModule;

    let setToken: SetToken;
    let issueQuantity: BigNumber;

    let wrappedfCashImplementation: WrappedfCash;
    let wrappedfCashBeacon: NUpgradeableBeacon;
    let wrappedfCashFactory: WrappedfCashFactory;

    beforeEach(async () => {
      [owner, manager] = await getAccounts();

      deployer = new DeployHelper(owner.wallet);

      setup = getSystemFixture(owner.address);
      await setup.initialize();

      // Setup ForkedTokens
      await initializeForkedTokens(deployer);
      tokens = getForkedTokens();
      weth = tokens.weth;
      steth = tokens.steth;

      // Deploy WrappedfCash
      wrappedfCashImplementation = await deployer.external.deployWrappedfCash(notionalProxyAddress);

      wrappedfCashBeacon = await new NUpgradeableBeacon__factory(owner.wallet).deploy(
        wrappedfCashImplementation.address,
      );

      wrappedfCashFactory = await deployer.external.deployWrappedfCashFactory(
        wrappedfCashBeacon.address,
      );

      // Deploy DebtIssuanceModuleV2
      debtIssuanceModule = await deployer.modules.deployDebtIssuanceModuleV2(
        setup.controller.address,
      );
      await setup.controller.addModule(debtIssuanceModule.address);

      // Deploy NotionalTradeModule
      notionalTradeModule = await deployer.modules.deployNotionalTradeModule(
        setup.controller.address,
      );
      await setup.controller.addModule(notionalTradeModule.address);

      // Deploy mock issuance hook to pass as arg in DebtIssuance module initialization
      mockPreIssuanceHook = await deployer.mocks.deployManagerIssuanceHookMock();

      // Create liquidity
      const ape = await getRandomAccount(); // The wallet adding initial liquidity
      await weth.transfer(ape.address, ether(50));
      await steth.transfer(ape.address, ether(50000));

      await initialize();
    });

    async function initialize() {
      // Create Set token
      setToken = await setup.createSetToken(
        [steth.address],
        [ether(2)],
        [debtIssuanceModule.address, notionalTradeModule.address],
        manager.address,
      );

      // Fund owner with stETH
      await tokens.steth.transfer(owner.address, ether(11000));

      // stETH has balance rounding errors that crash DebtIssuanceModuleV2 with:
      //  "Invalid transfer in. Results in undercollateralization"
      // > transfer quantity =              1000000000000000000
      // > stETH balanceOf after transfer =  999999999999999999
      // Transfer steth to set token to overcollaterize the position by exactly the rounding error
      // Transferring 2 results in steth.balanceOf(setToken) == 1
      await tokens.steth.transfer(setToken.address, 2);

      await steth.connect(owner.wallet).approve(debtIssuanceModule.address, MAX_UINT_256);

      // Initialize debIssuance module
      await debtIssuanceModule.connect(manager.wallet).initialize(
        setToken.address,
        ether(0.1),
        ether(0), // No issue fee
        ether(0), // No redeem fee
        owner.address,
        mockPreIssuanceHook.address,
      );

      // Issue
      issueQuantity = ether(1);

      await debtIssuanceModule
        .connect(owner.wallet)
        .issue(setToken.address, issueQuantity, owner.address);
    }

    describe("Test WrappedFCash contracts", () => {
      // DAI currencyId
      const currencyId = 2;
      let maturity: BigNumber;
      let wrappedFCashInstance: WrappedfCash;
      beforeEach(async () => {
        const activeMarkets = await notionalProxy.getActiveMarkets(currencyId);
        maturity = activeMarkets[0].maturity;
      });
      describe("Deploying WrappedfCash directly", () => {
        beforeEach(async () => {
          wrappedFCashInstance = await deployer.external.deployWrappedfCash(notionalProxyAddress);
        });
        it("initialization should work", async () => {
          const initializationData = wrappedfCashImplementation.interface.encodeFunctionData(
            "initialize",
            [currencyId, maturity],
          );
          await owner.wallet.sendTransaction({
            to: wrappedFCashInstance.address,
            data: initializationData,
          });
        });
      });

      describe("Deploying WrappedfCash with beacon proxy", () => {
        let proxyContract;
        it("deployment should work", async () => {
          const initializationData = wrappedfCashImplementation.interface.encodeFunctionData(
            "initialize",
            [currencyId, maturity],
          );
          proxyContract = await new NBeaconProxy__factory(owner.wallet).deploy(
            wrappedfCashBeacon.address,
            initializationData,
          );
          wrappedFCashInstance = wrappedfCashImplementation.attach(proxyContract.address);
        });
      });

      describe("WrappedFCashFactory", () => {
        it("Can create new wrappedFCash instance", async () => {
          await wrappedfCashFactory.deployWrapper(currencyId, maturity);
        });
        describe("When WrappedfCash is deployed", () => {
          beforeEach(async () => {
            const wrappeFCashAddress = await wrappedfCashFactory.callStatic.deployWrapper(
              currencyId,
              maturity,
            );
            await wrappedfCashFactory.deployWrapper(currencyId, maturity);
            wrappedFCashInstance = wrappedfCashImplementation.attach(wrappeFCashAddress);
          });

          it("getCurrencyId works correctly", async () => {
            const returnedCurrencyId = await wrappedFCashInstance.getCurrencyId();
            expect(returnedCurrencyId).to.eq(currencyId);
          });

          it("getAssetToken works", async () => {
            const [assetTokenAddress] = await wrappedFCashInstance.getAssetToken();
            expect(assetTokenAddress).to.eq(cdaiAddress);
          });

        });
      });
    });
  });
});
