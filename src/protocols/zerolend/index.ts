import axios from "axios";
import { Request, Response } from "express";
import { ethers } from "ethers";
import _ from "lodash";
import OracleABI from "./abi/Oracle.json";
import ATokenABI from "./abi/AToken.json";
import cache from "../../utils/cache";
import { formatChain } from "../../utils/formatChain";
import {
  SECONDS_PER_YEAR,
  chainUrlParam,
  API_URLS,
  getProviderUrlForChain,
} from "./constant";

const query = `
  query ReservesQuery {
    reserves(where: { name_not: "" }) {
      name
      borrowingEnabled
      aToken {
        id
        rewards {
          id
          emissionsPerSecond
          rewardToken
          rewardTokenDecimals
          rewardTokenSymbol
          distributionEnd
        }
        underlyingAssetAddress
        underlyingAssetDecimals
      }
      vToken {
        rewards {
          emissionsPerSecond
          rewardToken
          rewardTokenDecimals
          rewardTokenSymbol
          distributionEnd
        }
        pool {
          pool
        }
      }
      symbol
      liquidityRate
      variableBorrowRate
      baseLTVasCollateral
      isFrozen
    }
  }
`;

const headers = {
  "Content-Type": "application/json",
};

export const zeroPrice = async () => {
  const oracleAddress = "0x1cc993f2C8b6FbC43a9bafd2A44398E739733385";
  const earlyZeroAddress = "0x3db28e471fa398bf2527135a1c559665941ee7a3";
  const provider = new ethers.JsonRpcProvider(
    getProviderUrlForChain("ethereum")
  );
  const contract = new ethers.Contract(oracleAddress, OracleABI, provider);
  const _price = await contract.getAssetPrice(earlyZeroAddress);
  cache.set("price:early_zero", _price, 60 * 30);
};

const getPrices = async (addresses: any) => {
  const _prices = await axios.get(
    `https://coins.llama.fi/prices/current/${addresses.join(",").toLowerCase()}`
  );

  const zeroPrice = cache.get("price:early_zero");

  const earlyZero = {
    "era:0x9793eac2fecef55248efa039bec78e82ac01cb2f": {
      decimals: 18,
      symbol: "earlyZERO",
      price: Number(zeroPrice) / 1e8,
      timestamp: Date.now(),
      confidence: 0.99,
    },
    "linea:0x40a59a3f3b16d9e74c811d24d8b7969664cfe180": {
      decimals: 18,
      symbol: "earlyZERO",
      price: Number(zeroPrice) / 1e8,
      timestamp: Date.now(),
      confidence: 0.99,
    },
    "ethereum:0x3db28e471fa398bf2527135a1c559665941ee7a3": {
      decimals: 18,
      symbol: "earlyZERO",
      price: Number(zeroPrice) / 1e8,
      timestamp: Date.now(),
      confidence: 0.99,
    },
  };

  const prices = { ..._prices.data.coins, ...earlyZero };

  const pricesBySymbol = Object.entries(prices).reduce(
    (acc: any, [name, price]: any) => ({
      ...acc,
      [price.symbol.toLowerCase()]: price.price,
    }),
    {}
  );

  const pricesByAddress = Object.entries(prices).reduce(
    (acc: any, [name, price]: any) => ({
      ...acc,
      [name.split(":")[1]]: price.price,
    }),
    {}
  );

  return { pricesByAddress, pricesBySymbol };
};

// supply
const fetchTotalSupplyForChain = async (
  chainProviderUrl: any,
  reserves: any,
  aTokenAbi: any
) => {
  const provider = new ethers.JsonRpcProvider(chainProviderUrl);
  const totalSupplyPromises = reserves.map(async (reserve: any) => {
    const aTokenContract = new ethers.Contract(
      reserve.aToken.id,
      aTokenAbi,
      provider
    );
    const totalSupply = await aTokenContract.totalSupply();
    return totalSupply;
  });

  const totalSupplies = await Promise.all(totalSupplyPromises);
  return totalSupplies.map((supply) => supply.toString()); // Convert BigNumbers to strings
};

const getTotalSupplyForAllChains = async (data: any, aTokenAbi: any) => {
  const totalSupplyPromises = data.map(async ([chain, reserves]: any) => {
    const chainProviderUrl = getProviderUrlForChain(chain);
    return await fetchTotalSupplyForChain(
      chainProviderUrl,
      reserves,
      aTokenAbi
    );
  });
  const totalSupplies = await Promise.all(totalSupplyPromises);
  return totalSupplies.flat(); // Flatten the array of arrays into a single array
};

//underlying balance
const fetchUnderlyingBalancesForChain = async (
  chainProviderUrl: any,
  reserves: any,
  aTokenAbi: any
) => {
  const provider = new ethers.JsonRpcProvider(chainProviderUrl);
  // Create an array of balanceOf calls for each reserve's underlying asset
  const balanceOfPromises = reserves.map(async (reserve: any) => {
    const underlyingAssetContract = new ethers.Contract(
      reserve.aToken.underlyingAssetAddress,
      aTokenAbi,
      provider
    );
    const balance = await underlyingAssetContract.balanceOf(reserve.aToken.id);
    return balance.toString();
  });
  const underlyingBalances = await Promise.all(balanceOfPromises);
  return underlyingBalances;
};

const getUnderlyingBalancesForAllChains = async (data: any, aTokenAbi: any) => {
  const underlyingBalancePromises = data.map(async ([chain, reserves]: any) => {
    const chainProviderUrl = getProviderUrlForChain(chain);
    return await fetchUnderlyingBalancesForChain(
      chainProviderUrl,
      reserves,
      aTokenAbi
    );
  });

  const underlyingBalances = await Promise.all(underlyingBalancePromises);
  return underlyingBalances.flat(); // Flatten array of arrays into a single array
};

const fetchReserves = async (chain: string, url: string) => {
  try {
    const response = await axios.post(url, { query }, { headers });
    return [chain, response.data.data.reserves];
  } catch (error) {
    console.error(`Error fetching data from ${chain}:`, error);
    return [chain, []]; // Return empty array on error
  }
};

export const apy = async () => {
  let data = await Promise.all(
    Object.entries(API_URLS).map(async ([chain, url]) =>
      fetchReserves(chain, url)
    )
  );

  data = data.map(([chain, reserves]) => [
    chain,
    reserves.filter((p: any) => !p.isFrozen),
  ]);
  const [totalSupply, underlyingBalances] = await Promise.all([
    getTotalSupplyForAllChains(data, ATokenABI),
    getUnderlyingBalancesForAllChains(data, ATokenABI),
  ]);

  const underlyingTokens = _.flatten(
    data.map(([chain, reserves]) =>
      reserves.map(
        (pool: any) => `${chain}:${pool.aToken.underlyingAssetAddress}`
      )
    )
  );

  const rewardTokens = _.flatten(
    data.map(([chain, reserves]) =>
      reserves.flatMap((pool: any) =>
        pool.aToken.rewards.map((rew: any) => `${chain}:${rew.rewardToken}`)
      )
    )
  );

  const { pricesByAddress, pricesBySymbol } = await getPrices([
    ...underlyingTokens,
    ...rewardTokens,
  ]);

  const pools = data.map(([chain, markets], i) => {
    return markets.map((pool: any) => {
      const supply = totalSupply[i][markets.indexOf(pool)];
      const currentSupply = underlyingBalances[i][markets.indexOf(pool)];
      const decimals = 10 ** pool.aToken.underlyingAssetDecimals;

      const totalSupplyUsd =
        (supply / decimals) *
        (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
          pricesBySymbol[pool.symbol]);
      const tvlUsd =
        (currentSupply / decimals) *
        (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
          pricesBySymbol[pool.symbol]);

      const rewardPerYear = pool.aToken.rewards.reduce(
        (acc: any, rew: any) =>
          acc +
          (rew.emissionsPerSecond / 10 ** rew.rewardTokenDecimals) *
            SECONDS_PER_YEAR *
            (pricesByAddress[rew.rewardToken] ||
              pricesBySymbol[rew.rewardTokenSymbol] ||
              0),
        0
      );

      const rewardPerYearBorrow = pool.vToken.rewards.reduce(
        (acc: any, rew: any) =>
          acc +
          (rew.emissionsPerSecond / 10 ** rew.rewardTokenDecimals) *
            SECONDS_PER_YEAR *
            (pricesByAddress[rew.rewardToken] ||
              pricesBySymbol[rew.rewardTokenSymbol] ||
              0),
        0
      );

      let totalBorrowUsd = totalSupplyUsd - tvlUsd;
      totalBorrowUsd = Math.max(totalBorrowUsd, 0);

      const supplyRewardEnd = pool.aToken.rewards[0]?.distributionEnd;
      const borrowRewardEnd = pool.vToken.rewards[0]?.distributionEnd;

      return {
        pool: `${pool.aToken.id}-${chain}`.toLowerCase(),
        address: pool.vToken.pool.pool,
        chain: formatChain(chain),
        project: "zerolend",
        symbol: pool.symbol,
        tvlUsd,
        apyBase: (pool.liquidityRate / 10 ** 27) * 100,
        apyReward:
          supplyRewardEnd * 1000 > Date.now()
            ? (rewardPerYear / totalSupplyUsd) * 100
            : null,
        rewardTokens:
          supplyRewardEnd * 1000 > Date.now()
            ? pool.aToken.rewards.map((rew: any) => rew.rewardToken)
            : null,
        underlyingTokens: [pool.aToken.underlyingAssetAddress],
        totalSupplyUsd,
        totalBorrowUsd,
        apyBaseBorrow: Number(pool.variableBorrowRate) / 1e25,
        apyRewardBorrow:
          borrowRewardEnd * 1000 > Date.now()
            ? (rewardPerYearBorrow / totalBorrowUsd) * 100
            : null,
        ltv: Number(pool.baseLTVasCollateral) / 10000,
        url: `https://app.zerolend.xyz/reserve-overview/?underlyingAsset=${pool.aToken.underlyingAssetAddress}&marketName=${chainUrlParam[chain]}&utm_source=defillama&utm_medium=listing&utm_campaign=external`,
        borrowable: pool.borrowingEnabled,
      };
    });
  });
  const formatedPools = pools.flat().filter((p) => !!p.tvlUsd);
  // console.log(formatedPools);

  cache.set("pl:apy", formatedPools, 60 * 5); //5 mins cache
  return formatedPools;
};

export const getApy = async (req: Request, res: Response) => {
  try {
    const queryParams = req.query as { aToken?: string; vToken?: string };
    const cachePoolData: any = cache.get("pl:apy");

    if (!cachePoolData) {
      return res.json({ success: false, message: "No data available" });
    }

    const aToken = queryParams.aToken?.toLowerCase() || "";
    const vToken = queryParams.vToken?.toLowerCase() || "";

    const filteredData = cachePoolData.filter(
      (data: any) =>
        data.borrowable &&
        (data.symbol.toLowerCase().includes(aToken) ||
          data.symbol.toLowerCase().includes(vToken))
    );

    const groupedByChain = _.groupBy(filteredData, "chain");
    const finalData = _.pickBy(groupedByChain, (pools) => pools.length > 1);

    const response: any[] = [];

    _.forEach(finalData, (poolData, chain) => {
      for (let i = 0; i < poolData.length; i++) {
        const basePool = poolData[i];

        for (let j = i + 1; j < poolData.length; j++) {
          const comparePool = poolData[j];
          const isBaseToken = basePool.symbol.toLowerCase().includes(aToken);

          const temp = {
            project: basePool.project,
            chain: basePool.chain,
            ltv: isBaseToken ? basePool.ltv : comparePool.ltv,
            borrowApy: isBaseToken
              ? comparePool.apyBaseBorrow
              : basePool.apyBaseBorrow,
            aToken: isBaseToken ? basePool.symbol : comparePool.symbol,
            vToken: isBaseToken ? comparePool.symbol : basePool.symbol,
            route: isBaseToken
              ? `${basePool.symbol} -> ${comparePool.symbol}`
              : `${comparePool.symbol} -> ${basePool.symbol}`,
            poolAddres: isBaseToken ? comparePool.address : basePool.address,
          };

          response.push(temp);
        }
      }
    });

    console.log(response);

    res.json({
      success: true,
      reserves: _.isEmpty(response) ? {} : response,
    });
  } catch (error) {
    console.error("Error fetching APY data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//----------------- to do -----------------
// collateral asset //
// debt asset //stable conins
// amount
// chain

// get ltv for every pool

// if the ltv is >0 can be use for collateral
// if borrow apy>0

//net borrow apy - debt
//availbale -collateral
//ltv-collateral
//supply and borrow- collateral
