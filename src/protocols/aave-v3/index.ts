import axios from "axios";
import { api } from "@defillama/sdk";

import { keepFinite } from "../../utils/finite";
import poolAbi from "./abi/Pool.json";
import aaveStakedTokenDataProviderAbi from "./abi/DataProvider.json";
import cache from "../../utils/cache";
import { GHO, protocolDataProviders } from "./constant";

const getApy = async (chain: keyof typeof protocolDataProviders) => {
  const protocolDataProvider = protocolDataProviders[chain];
  const reserveTokens = (
    await api.abi.call({
      target: protocolDataProvider,
      abi: poolAbi.find((m: any) => m.name === "getAllReservesTokens"),
      chain,
    })
  ).output;

  const aTokens = (
    await api.abi.call({
      target: protocolDataProvider,
      abi: poolAbi.find((m: any) => m.name === "getAllATokens"),
      chain,
    })
  ).output;

  const poolsReserveData = (
    await api.abi.multiCall({
      calls: reserveTokens.map((p: any) => ({
        target: protocolDataProvider,
        params: p.tokenAddress,
      })),
      abi: poolAbi.find((m: any) => m.name === "getReserveData"),
      chain,
    })
  ).output.map((o: any) => o.output);

  const poolsReservesConfigurationData = (
    await api.abi.multiCall({
      calls: reserveTokens.map((p: any) => ({
        target: protocolDataProvider,
        params: p.tokenAddress,
      })),
      abi: poolAbi.find((m: any) => m.name === "getReserveConfigurationData"),
      chain,
    })
  ).output.map((o: any) => o.output);

  const totalSupply = (
    await api.abi.multiCall({
      chain,
      abi: "erc20:totalSupply",
      calls: aTokens.map((t: any) => ({
        target: t.tokenAddress,
      })),
    })
  ).output.map((o: any) => o.output);

  const underlyingBalances = (
    await api.abi.multiCall({
      chain,
      abi: "erc20:balanceOf",
      calls: aTokens.map((t: any, i: any) => ({
        target: reserveTokens[i].tokenAddress,
        params: [t.tokenAddress],
      })),
    })
  ).output.map((o: any) => o.output);

  const underlyingDecimals = (
    await api.abi.multiCall({
      chain,
      abi: "erc20:decimals",
      calls: aTokens.map((t: any) => ({
        target: t.tokenAddress,
      })),
    })
  ).output.map((o: any) => o.output);

  const priceKeys = reserveTokens
    .map((t: any) => `${chain}:${t.tokenAddress}`)
    .concat(`${chain}:${GHO}`)
    .join(",");
  const prices = (
    await axios.get(`https://coins.llama.fi/prices/current/${priceKeys}`)
  ).data.coins;

  const ghoSupply =
    (
      await api.abi.call({
        target: GHO,
        abi: "erc20:totalSupply",
      })
    ).output / 1e18;

  return reserveTokens.map((pool: any, i: any) => {
    const p = poolsReserveData[i];
    const price = prices[`${chain}:${pool.tokenAddress}`]?.price;

    const supply = totalSupply[i];
    let totalSupplyUsd = (supply / 10 ** underlyingDecimals[i]) * price;

    const currentSupply = underlyingBalances[i];
    let tvlUsd = (currentSupply / 10 ** underlyingDecimals[i]) * price;

    let totalBorrowUsd;
    if (pool.symbol === "GHO") {
      tvlUsd = 0;
      totalSupplyUsd = tvlUsd;
      totalBorrowUsd = ghoSupply * prices[`${chain}:${GHO}`]?.price;
    } else {
      totalBorrowUsd = totalSupplyUsd - tvlUsd;
    }

    const chainUrlParam =
      chain === "ethereum"
        ? "mainnet"
        : chain === "avax"
        ? "avalanche"
        : chain === "xdai"
        ? "gnosis"
        : chain === "bsc"
        ? "bnb"
        : chain;

    const url = `https://app.aave.com/reserve-overview/?underlyingAsset=${pool.tokenAddress.toLowerCase()}&marketName=proto_${chainUrlParam}_v3`;

    return {
      pool: `${aTokens[i].tokenAddress}-${
        chain === "avax" ? "avalanche" : chain
      }`.toLowerCase(),
      chain,
      project: "aave-v3",
      symbol: pool.symbol,
      tvlUsd,
      apyBase: (p.liquidityRate / 10 ** 27) * 100,
      underlyingTokens: [pool.tokenAddress],
      totalSupplyUsd,
      totalBorrowUsd,
      debtCeilingUsd: pool.symbol === "GHO" ? 1e8 : null,
      apyBaseBorrow: Number(p.variableBorrowRate) / 1e25,
      ltv: poolsReservesConfigurationData[i].ltv / 10000,
      url,
      borrowable: poolsReservesConfigurationData[i].borrowingEnabled,
      mintedCoin: pool.symbol === "GHO" ? "GHO" : null,
    };
  });
};

const stkGho = async () => {
  const convertStakedTokenApy = (rawApy: any) => {
    const rawApyStringified = rawApy.toString();
    const lastTwoDigits = rawApyStringified.slice(-2);
    const remainingDigits = rawApyStringified.slice(0, -2);
    const result = `${remainingDigits}.${lastTwoDigits}`;
    return Number(result);
  };

  const STKGHO = "0x1a88Df1cFe15Af22B3c4c783D4e6F7F9e0C1885d";
  const stkGhoTokenOracle = "0x3f12643d3f6f874d39c2a4c9f2cd6f2dbac877fc";
  const aaveStakedTokenDataProviderAddress =
    "0xb12e82DF057BF16ecFa89D7D089dc7E5C1Dc057B";

  const stkghoData = (
    await api.abi.call({
      target: aaveStakedTokenDataProviderAddress,
      abi: aaveStakedTokenDataProviderAbi.find(
        (m: any) => m.name === "getStakedAssetData"
      ),
      params: [STKGHO, stkGhoTokenOracle],
      chain: "ethereum",
    })
  ).output;

  const stkghoNativeApyRaw = stkghoData[6]; // 6th index of the tuple is the APY
  const stkghoNativeApy = convertStakedTokenApy(stkghoNativeApyRaw);

  const stkghoMeritApy = (
    await axios.get("https://apps.aavechan.com/api/merit/base-aprs")
  ).data.actionsAPR["ethereum-stkgho"];

  const stkghoApy = stkghoNativeApy + stkghoMeritApy;

  const stkghoSupply =
    (
      await api.abi.call({
        target: STKGHO,
        abi: "erc20:totalSupply",
      })
    ).output / 1e18;

  const ghoPrice = (
    await axios.get(`https://coins.llama.fi/prices/current/ethereum:${GHO}`)
  ).data.coins[`ethereum:${GHO}`].price;

  const pool = {
    pool: `${STKGHO}-ethereum`.toLowerCase(),
    chain: "Ethereum",
    project: "aave-v3",
    symbol: "GHO",
    tvlUsd: stkghoSupply * ghoPrice,
    apy: stkghoApy,
    url: "https://app.aave.com/staking",
  };

  return pool;
};

export const apy = async () => {
  try {
    const pools = await Promise.all(
      Object.keys(protocolDataProviders).map(async (chain) =>
        getApy(chain as keyof typeof protocolDataProviders)
      )
    );
    const stkghoPool = await stkGho();
    const formatedPools = pools
      .flat()
      .concat([stkghoPool])
      .filter((p) => keepFinite(p));
    cache.set("apy:aave-v3", formatedPools, 60 * 30);
    return formatedPools;
  } catch (e) {
    console.log(e);
  }
};
