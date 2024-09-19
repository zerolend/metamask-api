export const baseUrl =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/";

export const SECONDS_PER_YEAR = 31536000;

export const query = `
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

export const headers = {
  "Content-Type": "application/json",
};

export const chainUrlParam: any = {
  linea: "proto_linea_v3",
  ethereum: "proto_mainnet_lrt_v3",
  era: "proto_zksync_era_v3",
};

export const API_URLS = {
  ethereum: baseUrl + "zerolend-mainnet-lrt/1.0.0/gn",
  linea: baseUrl + "zerolend-linea/1.0.0/gn",
  era: baseUrl + "zerolend-zksync/1.0.0/gn",
  manta: baseUrl + "zerolend-m/1.0.0/gn",
  blast: baseUrl + "zerolend-blast/1.0.1/gn",
  ethereum_btc: baseUrl + "zerolend-mainnet-btc/1.0.0/gn",
  linea_croak: baseUrl + "zerolend-linea-croak/1.0.0/gn",
  linea_foxy: baseUrl + "zerolend-linea-foxy/1.0.0/gn",
  // xlayer: baseUrl + "zerolend-xlayer/1.0.0/gn",
  // era: 'https://api.studio.thegraph.com/query/49970/zerolend/version/latest',
};

export const oraclePriceABI = {
  inputs: [
    {
      internalType: "address",
      name: "asset",
      type: "address",
    },
  ],
  name: "getAssetPrice",
  outputs: [
    {
      internalType: "uint256",
      name: "",
      type: "uint256",
    },
  ],
  stateMutability: "view",
  type: "function",
};
