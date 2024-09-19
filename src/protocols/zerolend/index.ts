import axios from "axios";
import { Request, Response } from "express";
import { api } from "@defillama/sdk";
import _ from "lodash";

import ATokenABI from "./abi/AToken.json";
import cache from "../../utils/cache";
import { formatChain } from "../../utils/formatChain";
import {
  SECONDS_PER_YEAR,
  chainUrlParam,
  API_URLS,
  query,
  headers,
  oraclePriceABI,
} from "./constant";

const getPrices = async (addresses: any) => {
  const _prices = await axios.get(
    `https://coins.llama.fi/prices/current/${addresses.join(",").toLowerCase()}`
  );

  const zeroPrice = (
    await api.abi.call({
      target: "0x1cc993f2C8b6FbC43a9bafd2A44398E739733385",
      abi: oraclePriceABI,
      params: ["0x3db28e471fa398bf2527135a1c559665941ee7a3"],
      chain: "ethereum",
    })
  ).output;

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
    (acc, [name, price]: any) => ({
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

const fetchReserves = async (chain: string, url: string) => {
  const _chain = chain.split("_");
  console.log(_chain, chain);

  try {
    const response = await axios.post(url, { query }, { headers });
    return [_chain[0], response.data.data.reserves];
  } catch (error) {
    console.error(`Error fetching data from ${chain}:`, error);
    return [_chain[0], []]; // Return empty array on error
  }
};

export const apy = async () => {
  try {
    let data = await Promise.all(
      Object.entries(API_URLS).map(async ([chain, url]) =>
        fetchReserves(chain, url)
      )
    );

    data = data.map(([chain, reserves]) => [
      chain,
      reserves.filter((p: any) => !p.isFrozen),
    ]);

    const totalSupply = await Promise.all(
      data.map(async ([chain, reserves]) =>
        (
          await api.abi.multiCall({
            chain: chain,
            abi: ATokenABI.find(({ name }) => name === "totalSupply"),
            calls: reserves.map((reserve: any) => ({
              target: reserve.aToken.id,
            })),
          })
        ).output.map(({ output }: any) => output)
      )
    );

    const underlyingBalances = await Promise.all(
      data.map(async ([chain, reserves]) =>
        (
          await api.abi.multiCall({
            chain: chain,
            abi: ATokenABI.find(({ name }) => name === "balanceOf"),
            calls: reserves.map((reserve: any, i: any) => ({
              target: reserve.aToken.underlyingAssetAddress,
              params: [reserve.aToken.id],
            })),
          })
        ).output.map(({ output }: any) => output)
      )
    );

    const underlyingTokens = data.map(([chain, reserves]) =>
      reserves.map(
        (pool: any) => `${chain}:${pool.aToken.underlyingAssetAddress}`
      )
    );

    const rewardTokens = data.map(([chain, reserves]) =>
      reserves.map((pool: any) =>
        pool.aToken.rewards.map((rew: any) => `${chain}:${rew.rewardToken}`)
      )
    );

    const { pricesByAddress, pricesBySymbol }: any = await getPrices(
      underlyingTokens.flat().concat(rewardTokens.flat(Infinity))
    );

    const pools = data.map(([chain, markets], i) => {
      const chainPools = markets.map((pool: any, idx: any) => {
        const supply = totalSupply[i][idx];
        const currentSupply = underlyingBalances[i][idx];
        const totalSupplyUsd =
          (supply / 10 ** pool.aToken.underlyingAssetDecimals) *
          (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
            pricesBySymbol[pool.symbol]);
        const tvlUsd =
          (currentSupply / 10 ** pool.aToken.underlyingAssetDecimals) *
          (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
            pricesBySymbol[pool.symbol]);
        const { rewards } = pool.aToken;

        const rewardPerYear = rewards.reduce(
          (acc: any, rew: any) =>
            acc +
            (rew.emissionsPerSecond / 10 ** rew.rewardTokenDecimals) *
              SECONDS_PER_YEAR *
              (pricesByAddress[rew.rewardToken] ||
                pricesBySymbol[rew.rewardTokenSymbol] ||
                0),
          0
        );

        const { rewards: rewardsBorrow } = pool.vToken;
        const rewardPerYearBorrow = rewardsBorrow.reduce(
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
        totalBorrowUsd = totalBorrowUsd < 0 ? 0 : totalBorrowUsd;

        const supplyRewardEnd = pool.aToken.rewards[0]?.distributionEnd;
        const borrowRewardEnd = pool.vToken.rewards[0]?.distributionEnd;

        return {
          pool: `${pool.aToken.id}-${chain}`.toLowerCase(),
          chain: formatChain(chain),
          address: pool.vToken.pool.pool,
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
              ? rewards.map((rew: any) => rew.rewardToken)
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
      return chainPools;
    });
    const formatedPools = pools.flat().filter((p: any) => !!p.tvlUsd);
    cache.set("apy:zerolend", formatedPools, 60 * 30); //5 mins cache
    return formatedPools;
    // return pools.flat().filter((p) => !!p.tvlUsd);}
  } catch (e) {
    console.log(e);
  }
};

// // supply
// const fetchTotalSupplyForChain = async (
//   chainProviderUrl: any,
//   reserves: any,
//   aTokenAbi: any
// ) => {
//   const provider = new ethers.JsonRpcProvider(chainProviderUrl);
//   const totalSupplyPromises = reserves.map(async (reserve: any) => {
//     const aTokenContract = new ethers.Contract(
//       reserve.aToken.id,
//       aTokenAbi,
//       provider
//     );
//     const totalSupply = await aTokenContract.totalSupply();
//     return totalSupply;
//   });

//   const totalSupplies = await Promise.all(totalSupplyPromises);
//   return totalSupplies.map((supply) => supply.toString()); // Convert BigNumbers to strings
// };

// const getTotalSupplyForAllChains = async (data: any, aTokenAbi: any) => {
//   const totalSupplyPromises = data.map(async ([chain, reserves]: any) => {
//     const chainProviderUrl = getProviderUrlForChain(chain);
//     return await fetchTotalSupplyForChain(
//       chainProviderUrl,
//       reserves,
//       aTokenAbi
//     );
//   });
//   const totalSupplies = await Promise.all(totalSupplyPromises);
//   return totalSupplies.flat(); // Flatten the array of arrays into a single array
// };

// //underlying balance
// const fetchUnderlyingBalancesForChain = async (
//   chainProviderUrl: any,
//   reserves: any,
//   aTokenAbi: any
// ) => {
//   const provider = new ethers.JsonRpcProvider(chainProviderUrl);
//   // Create an array of balanceOf calls for each reserve's underlying asset
//   const balanceOfPromises = reserves.map(async (reserve: any) => {
//     const underlyingAssetContract = new ethers.Contract(
//       reserve.aToken.underlyingAssetAddress,
//       aTokenAbi,
//       provider
//     );
//     const balance = await underlyingAssetContract.balanceOf(reserve.aToken.id);
//     return balance.toString();
//   });
//   const underlyingBalances = await Promise.all(balanceOfPromises);
//   return underlyingBalances;
// };

// const getUnderlyingBalancesForAllChains = async (data: any, aTokenAbi: any) => {
//   const underlyingBalancePromises = data.map(async ([chain, reserves]: any) => {
//     const chainProviderUrl = getProviderUrlForChain(chain);
//     return await fetchUnderlyingBalancesForChain(
//       chainProviderUrl,
//       reserves,
//       aTokenAbi
//     );
//   });

//   const underlyingBalances = await Promise.all(underlyingBalancePromises);
//   return underlyingBalances.flat(); // Flatten array of arrays into a single array
// };

// export const apy = async () => {
//   let data = await Promise.all(
//     Object.entries(API_URLS).map(async ([chain, url]) =>
//       fetchReserves(chain, url)
//     )
//   );

//   data = data.map(([chain, reserves]) => [
//     chain,
//     reserves.filter((p: any) => !p.isFrozen),
//   ]);
//   const [totalSupply, underlyingBalances] = await Promise.all([
//     getTotalSupplyForAllChains(data, ATokenABI),
//     getUnderlyingBalancesForAllChains(data, ATokenABI),
//   ]);

//   const underlyingTokens = _.flatten(
//     data.map(([chain, reserves]) =>
//       reserves.map(
//         (pool: any) => `${chain}:${pool.aToken.underlyingAssetAddress}`
//       )
//     )
//   );

//   const rewardTokens = _.flatten(
//     data.map(([chain, reserves]) =>
//       reserves.flatMap((pool: any) =>
//         pool.aToken.rewards.map((rew: any) => `${chain}:${rew.rewardToken}`)
//       )
//     )
//   );

//   const { pricesByAddress, pricesBySymbol } = await getPrices([
//     ...underlyingTokens,
//     ...rewardTokens,
//   ]);

//   const pools = data.map(([chain, markets], i) => {
//     return markets.map((pool: any) => {
//       const supply = totalSupply[i][markets.indexOf(pool)];
//       const currentSupply = underlyingBalances[i][markets.indexOf(pool)];
//       const decimals = 10 ** pool.aToken.underlyingAssetDecimals;

//       const totalSupplyUsd =
//         (supply / decimals) *
//         (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
//           pricesBySymbol[pool.symbol]);
//       const tvlUsd =
//         (currentSupply / decimals) *
//         (pricesByAddress[pool.aToken.underlyingAssetAddress] ||
//           pricesBySymbol[pool.symbol]);

//       const rewardPerYear = pool.aToken.rewards.reduce(
//         (acc: any, rew: any) =>
//           acc +
//           (rew.emissionsPerSecond / 10 ** rew.rewardTokenDecimals) *
//             SECONDS_PER_YEAR *
//             (pricesByAddress[rew.rewardToken] ||
//               pricesBySymbol[rew.rewardTokenSymbol] ||
//               0),
//         0
//       );

//       const rewardPerYearBorrow = pool.vToken.rewards.reduce(
//         (acc: any, rew: any) =>
//           acc +
//           (rew.emissionsPerSecond / 10 ** rew.rewardTokenDecimals) *
//             SECONDS_PER_YEAR *
//             (pricesByAddress[rew.rewardToken] ||
//               pricesBySymbol[rew.rewardTokenSymbol] ||
//               0),
//         0
//       );

//       let totalBorrowUsd = totalSupplyUsd - tvlUsd;
//       totalBorrowUsd = Math.max(totalBorrowUsd, 0);

//       const supplyRewardEnd = pool.aToken.rewards[0]?.distributionEnd;
//       const borrowRewardEnd = pool.vToken.rewards[0]?.distributionEnd;

//       return {
//         pool: `${pool.aToken.id}-${chain}`.toLowerCase(),
//         address: pool.vToken.pool.pool,
//         chain: formatChain(chain),
//         project: "zerolend",
//         symbol: pool.symbol,
//         tvlUsd,
//         apyBase: (pool.liquidityRate / 10 ** 27) * 100,
//         apyReward:
//           supplyRewardEnd * 1000 > Date.now()
//             ? (rewardPerYear / totalSupplyUsd) * 100
//             : null,
//         rewardTokens:
//           supplyRewardEnd * 1000 > Date.now()
//             ? pool.aToken.rewards.map((rew: any) => rew.rewardToken)
//             : null,
//         underlyingToken: pool.aToken.underlyingAssetAddress,
//         totalSupplyUsd,
//         totalBorrowUsd,
//         apyBaseBorrow: Number(pool.variableBorrowRate) / 1e25,
//         apyRewardBorrow:
//           borrowRewardEnd * 1000 > Date.now()
//             ? (rewardPerYearBorrow / totalBorrowUsd) * 100
//             : null,
//         ltv: Number(pool.baseLTVasCollateral) / 10000,
//         url: `https://app.zerolend.xyz/reserve-overview/?underlyingAsset=${pool.aToken.underlyingAssetAddress}&marketName=${chainUrlParam[chain]}&utm_source=defillama&utm_medium=listing&utm_campaign=external`,
//         borrowable: pool.borrowingEnabled,
//       };
//     });
//   });
//   const formatedPools = pools.flat().filter((p) => !!p.tvlUsd);
//   // console.log(formatedPools);

//   cache.set("pl:apy", formatedPools, 60 * 5); //5 mins cache
//   return formatedPools;
// };
