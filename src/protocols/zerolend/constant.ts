export const baseUrl =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/";

export const SECONDS_PER_YEAR = 31536000;

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
  // xlayer: baseUrl + "zerolend-xlayer/1.0.0/gn",
  // era: 'https://api.studio.thegraph.com/query/49970/zerolend/version/latest',
};

export const getProviderUrlForChain = (chain: string) => {
  switch (chain) {
    case "ethereum":
      return "https://eth-mainnet.g.alchemy.com/v2/BV9eIvVFkPy8sUMbI_vjAr3f3htxX6NS";
    case "linea":
      return "https://linea-mainnet.g.alchemy.com/v2/BV9eIvVFkPy8sUMbI_vjAr3f3htxX6NS";
    case "era":
      return "https://zksync-mainnet.g.alchemy.com/v2/BV9eIvVFkPy8sUMbI_vjAr3f3htxX6NS";
    case "manta":
      return "https://pacific-rpc.manta.network/http";
    case "blast":
      return "https://blast-mainnet.g.alchemy.com/v2/BV9eIvVFkPy8sUMbI_vjAr3f3htxX6NS";
    case "xlayer":
      return "https://rpc.xlayer.tech";
    // Add other chain provider URLs here
  }
};
