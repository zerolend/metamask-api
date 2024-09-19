import axios from "axios";
import LendingPoolABI from "./abi/LendinPool.json";
import ProtocolDataProvider from "./abi/ProtocolDataProvider.json";
import { chains } from "./constant";
import { keepFinite } from "../../utils/finite";
import { api } from "@defillama/sdk";
import cache from "../../utils/cache";

export const apy = async () => {
  try {
    const pools = await Promise.all(
      Object.keys(chains).map(async (chain) => {
        const chainKey = chain as keyof typeof chains;

        const addresses = chains[chainKey];
        const sdkChain = chain === "avalanche" ? "avax" : chain;
        const reservesList = (
          await api.abi.call({
            target: addresses.LendingPool,
            abi: LendingPoolABI.find((m) => m.name === "getReservesList"),
            chain: sdkChain,
          })
        ).output;

        const reserveData = (
          await api.abi.multiCall({
            calls: reservesList.map((i: string) => ({
              target: addresses.LendingPool,
              params: [i],
            })),
            abi: LendingPoolABI.find((m) => m.name === "getReserveData"),
            chain: sdkChain,
          })
        ).output.map((o: any) => o.output);

        const [liquidityRes, decimalsRes, symbolsRes] = await Promise.all(
          ["erc20:balanceOf", "erc20:decimals", "erc20:symbol"].map((method) =>
            api.abi.multiCall({
              abi: method,
              calls: reservesList.map((t: any, i: any) => ({
                target: t,
                params:
                  method === "erc20:balanceOf"
                    ? reserveData[i].aTokenAddress
                    : null,
              })),
              chain: sdkChain,
              permitFailure: true,
            })
          )
        );

        const liquidity = liquidityRes.output.map((o: any) => o.output);
        const decimals = decimalsRes.output.map((o: any) => o.output);
        let symbols = symbolsRes.output.map((o: any) => o.output);
        // maker symbol is null
        const mkrIdx = symbols.findIndex((s: any) => s === null);
        symbols[mkrIdx] = "MKR";

        const totalBorrow = (
          await api.abi.multiCall({
            abi: "erc20:totalSupply",
            calls: reserveData.map((p: any) => ({
              target: p.variableDebtTokenAddress,
            })),
            chain: sdkChain,
          })
        ).output.map((o: any) => o.output);

        const reserveConfigurationData = (
          await api.abi.multiCall({
            calls: reservesList.map((t: any) => ({
              target: addresses.ProtocolDataProvider,
              params: t,
            })),
            chain: sdkChain,
            abi: ProtocolDataProvider.find(
              (n) => n.name === "getReserveConfigurationData"
            ),
          })
        ).output.map((o: any) => o.output);

        const pricesArray = reservesList.map((t: any) => `${sdkChain}:${t}`);
        const prices = (
          await axios.get(
            `https://coins.llama.fi/prices/current/${pricesArray}`
          )
        ).data.coins;

        return reservesList.map((t: any, i: any) => {
          const config = reserveConfigurationData[i];
          if (!config.isActive) return null;

          const price = prices[`${sdkChain}:${t}`]?.price;

          const tvlUsd = (liquidity[i] / 10 ** decimals[i]) * price;
          const totalBorrowUsd = (totalBorrow[i] / 10 ** decimals[i]) * price;
          const totalSupplyUsd = tvlUsd + totalBorrowUsd;

          const apyBase = reserveData[i].currentLiquidityRate / 1e25;
          const apyBaseBorrow = reserveData[i].currentVariableBorrowRate / 1e25;

          const ltv = config.ltv / 1e4;
          const borrowable = config.borrowingEnabled;
          const frozen = config.isFrozen;

          const url = `https://app.aave.com/reserve-overview/?underlyingAsset=${t.toLowerCase()}&marketName=proto_${
            chains[chainKey].url
          }`;

          return {
            pool: `${reserveData[i].aTokenAddress}-${chain}`.toLowerCase(),
            symbol: symbols[i],
            address: chains[chain as keyof typeof chains].LendingPool,
            project: "aave-v2",
            chain: chain.toLowerCase(),
            tvlUsd,
            apyBase,
            underlyingTokens: [t],
            url,
            // borrow fields
            totalSupplyUsd,
            totalBorrowUsd,
            apyBaseBorrow,
            ltv,
            borrowable,
            poolMeta: frozen ? "frozen" : null,
          };
        });
      })
    );
    const formatedPools = pools.flat().filter((p) => keepFinite(p));
    cache.set("apy:aave-v2", formatedPools, 60 * 30); //5 mins cache
    return formatedPools;
  } catch (e) {
    console.log(e);
  }
};
