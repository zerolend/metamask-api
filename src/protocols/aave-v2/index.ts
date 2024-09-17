import axios from "axios";
import { ethers } from "ethers";
import { MulticallWrapper } from "ethers-multicall-provider";
import LendingPoolABI from "./abi/LendinPool.json";
import ProtocolDataProvider from "./abi/ProtocolDataProvider.json";
import { chains } from "./constant";
import { getProviderUrlForChain } from "./constant";

type Chain = "ethereum"; //| "polygon" | "avalanche";

const getReserve = async (address: string, abi: any, provider: any) => {
  const multicallProvider = MulticallWrapper.wrap(provider);
  // const contract = new ethers.Contract(address, abi, provider);
  const contract = new ethers.Contract(address, abi, multicallProvider);
  const reserveList = await contract.getReservesList();

  const reserveData = await Promise.all(
    reserveList.map((w: string) => contract.getReserveData(w))
  );
  return { reserveList, reserveData };
};

const getReserveData = async (
  contractAddress: string,
  abi: any,
  chain: any,
  addresses: any
) => {
  const chainProviderUrl = getProviderUrlForChain(chain);
  const provider = new ethers.JsonRpcProvider(chainProviderUrl);
  const multicallProvider = MulticallWrapper.wrap(provider);

  const contract = new ethers.Contract(contractAddress, abi, multicallProvider);
  const data = await Promise.all(
    addresses.map((w: string) => contract.getReserveData(w))
  );
  return { data };
};

export const getApy = async () => {
  const pools = await Promise.all(
    Object.keys(chains).map(async (chain: Chain) => {
      const addresses = chains[chain];
      const chainProviderUrl = getProviderUrlForChain(addresses.url);
      console.log(chainProviderUrl);
      const provider = new ethers.JsonRpcProvider(chainProviderUrl);
      const { reserveList, reserveData } = await getReserve(
        addresses.LendingPool,
        LendingPoolABI,
        provider
      );

      console.log(reserveData);

      //     const [liquidityRes, decimalsRes, symbolsRes] = await Promise.all(
      //       ["erc20:balanceOf", "erc20:decimals", "erc20:symbol"].map((method) =>
      //         sdk.api.abi.multiCall({
      //           abi: method,
      //           calls: reservesList.map((t, i) => ({
      //             target: t,
      //             params:
      //               method === "erc20:balanceOf"
      //                 ? reserveData[i].aTokenAddress
      //                 : null,
      //           })),
      //           chain: sdkChain,
      //           permitFailure: true,
      //         })
      //       )
      //     );
      //     const liquidity = liquidityRes.output.map((o) => o.output);
      //     const decimals = decimalsRes.output.map((o) => o.output);
      //     let symbols = symbolsRes.output.map((o) => o.output);
      //     // maker symbol is null
      //     const mkrIdx = symbols.findIndex((s) => s === null);
      //     symbols[mkrIdx] = "MKR";
      //     const totalBorrow = (
      //       await sdk.api.abi.multiCall({
      //         abi: "erc20:totalSupply",
      //         calls: reserveData.map((p) => ({
      //           target: p.variableDebtTokenAddress,
      //         })),
      //         chain: sdkChain,
      //       })
      //     ).output.map((o) => o.output);
      //     const reserveConfigurationData = (
      //       await sdk.api.abi.multiCall({
      //         calls: reservesList.map((t) => ({
      //           target: addresses.ProtocolDataProvider,
      //           params: t,
      //         })),
      //         chain: sdkChain,
      //         abi: abiProtocolDataProvider.find(
      //           (n) => n.name === "getReserveConfigurationData"
      //         ),
      //       })
      //     ).output.map((o) => o.output);
      //     const pricesArray = reservesList.map((t) => `${sdkChain}:${t}`);
      //     const prices = (
      //       await axios.get(`https://coins.llama.fi/prices/current/${pricesArray}`)
      //     ).data.coins;
      //     return reservesList.map((t, i) => {
      //       const config = reserveConfigurationData[i];
      //       if (!config.isActive) return null;
      //       const price = prices[`${sdkChain}:${t}`]?.price;
      //       const tvlUsd = (liquidity[i] / 10 ** decimals[i]) * price;
      //       const totalBorrowUsd = (totalBorrow[i] / 10 ** decimals[i]) * price;
      //       const totalSupplyUsd = tvlUsd + totalBorrowUsd;
      //       const apyBase = reserveData[i].currentLiquidityRate / 1e25;
      //       const apyBaseBorrow = reserveData[i].currentVariableBorrowRate / 1e25;
      //       const ltv = config.ltv / 1e4;
      //       const borrowable = config.borrowingEnabled;
      //       const frozen = config.isFrozen;
      //       const url = `https://app.aave.com/reserve-overview/?underlyingAsset=${t.toLowerCase()}&marketName=proto_${
      //         chains[chain].url
      //       }`;
      //       return {
      //         pool: `${reserveData[i].aTokenAddress}-${chain}`.toLowerCase(),
      //         symbol: symbols[i],
      //         project: "aave-v2",
      //         chain,
      //         tvlUsd,
      //         apyBase,
      //         underlyingTokens: [t],
      //         url,
      //         // borrow fields
      //         totalSupplyUsd,
      //         totalBorrowUsd,
      //         apyBaseBorrow,
      //         ltv,
      //         borrowable,
      //         poolMeta: frozen ? "frozen" : null,
      //       };
      //     });
    })
  );
  // return pools.flat().filter((p) => utils.keepFinite(p));
};

// const getApy1 = async () => {
//   const pools = await Promise.all(
//     Object.keys(chains).map(async (chain) => {
//       const addresses = chains[chain];
//       const sdkChain = chain === "avalanche" ? "avax" : chain;

//       const reservesList = (
//         await sdk.api.abi.call({
//           target: addresses.LendingPool,
//           abi: abiLendingPool.find((m) => m.name === "getReservesList"),
//           chain: sdkChain,
//         })
//       ).output;

//       const reserveData = (
//         await sdk.api.abi.multiCall({
//           calls: reservesList.map((i) => ({
//             target: addresses.LendingPool,
//             params: [i],
//           })),
//           abi: abiLendingPool.find((m) => m.name === "getReserveData"),
//           chain: sdkChain,
//         })
//       ).output.map((o) => o.output);

//       const [liquidityRes, decimalsRes, symbolsRes] = await Promise.all(
//         ["erc20:balanceOf", "erc20:decimals", "erc20:symbol"].map((method) =>
//           sdk.api.abi.multiCall({
//             abi: method,
//             calls: reservesList.map((t, i) => ({
//               target: t,
//               params:
//                 method === "erc20:balanceOf"
//                   ? reserveData[i].aTokenAddress
//                   : null,
//             })),
//             chain: sdkChain,
//             permitFailure: true,
//           })
//         )
//       );

//       const liquidity = liquidityRes.output.map((o) => o.output);
//       const decimals = decimalsRes.output.map((o) => o.output);
//       let symbols = symbolsRes.output.map((o) => o.output);
//       // maker symbol is null
//       const mkrIdx = symbols.findIndex((s) => s === null);
//       symbols[mkrIdx] = "MKR";

//       const totalBorrow = (
//         await sdk.api.abi.multiCall({
//           abi: "erc20:totalSupply",
//           calls: reserveData.map((p) => ({
//             target: p.variableDebtTokenAddress,
//           })),
//           chain: sdkChain,
//         })
//       ).output.map((o) => o.output);

//       const reserveConfigurationData = (
//         await sdk.api.abi.multiCall({
//           calls: reservesList.map((t) => ({
//             target: addresses.ProtocolDataProvider,
//             params: t,
//           })),
//           chain: sdkChain,
//           abi: abiProtocolDataProvider.find(
//             (n) => n.name === "getReserveConfigurationData"
//           ),
//         })
//       ).output.map((o) => o.output);

//       const pricesArray = reservesList.map((t) => `${sdkChain}:${t}`);
//       const prices = (
//         await axios.get(`https://coins.llama.fi/prices/current/${pricesArray}`)
//       ).data.coins;

//       return reservesList.map((t, i) => {
//         const config = reserveConfigurationData[i];
//         if (!config.isActive) return null;

//         const price = prices[`${sdkChain}:${t}`]?.price;

//         const tvlUsd = (liquidity[i] / 10 ** decimals[i]) * price;
//         const totalBorrowUsd = (totalBorrow[i] / 10 ** decimals[i]) * price;
//         const totalSupplyUsd = tvlUsd + totalBorrowUsd;

//         const apyBase = reserveData[i].currentLiquidityRate / 1e25;
//         const apyBaseBorrow = reserveData[i].currentVariableBorrowRate / 1e25;

//         const ltv = config.ltv / 1e4;
//         const borrowable = config.borrowingEnabled;
//         const frozen = config.isFrozen;

//         const url = `https://app.aave.com/reserve-overview/?underlyingAsset=${t.toLowerCase()}&marketName=proto_${
//           chains[chain].url
//         }`;

//         return {
//           pool: `${reserveData[i].aTokenAddress}-${chain}`.toLowerCase(),
//           symbol: symbols[i],
//           project: "aave-v2",
//           chain,
//           tvlUsd,
//           apyBase,
//           underlyingTokens: [t],
//           url,
//           // borrow fields
//           totalSupplyUsd,
//           totalBorrowUsd,
//           apyBaseBorrow,
//           ltv,
//           borrowable,
//           poolMeta: frozen ? "frozen" : null,
//         };
//       });
//     })
//   );
//   return pools.flat().filter((p) => utils.keepFinite(p));
// };
