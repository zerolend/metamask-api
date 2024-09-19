export const chains = {
  ethereum: {
    LendingPool: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
    ProtocolDataProvider: "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
    url: "ethereum",
  },
  polygon: {
    LendingPool: "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf",
    ProtocolDataProvider: "0x7551b5D2763519d4e37e8B81929D336De671d46d",
    url: "polygon",
  },
  avalanche: {
    LendingPool: "0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C",
    ProtocolDataProvider: "0x65285E9dfab318f57051ab2b139ccCf232945451",
    url: "avalanche",
  },
};

export const getProviderUrlForChain = (chain: string) => {
  switch (chain) {
    case "ethereum":
      return "https://eth-mainnet.g.alchemy.com/v2/BV9eIvVFkPy8sUMbI_vjAr3f3htxX6NS";
    case "polygon":
      return "https://polygon.llamarpc.com";
    case "avalanche":
      return "https://1rpc.io/avax/c";
    // Add other chain provider URLs here
  }
};
