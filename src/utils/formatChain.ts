export const formatChain = (chain: string) => {
    if (chain && chain.toLowerCase() === 'xdai') return 'Gnosis';
    if (chain && chain.toLowerCase() === 'kcc') return 'KCC';
    if (chain && chain.toLowerCase() === 'okexchain') return 'OKExChain';
    if (chain && chain.toLowerCase() === 'bsc') return 'Binance';
    if (chain && chain.toLowerCase() === 'milkomeda') return 'Milkomeda C1';
    if (chain && chain.toLowerCase() === 'milkomeda_a1') return 'Milkomeda A1';
    if (chain && chain.toLowerCase() === 'boba_avax') return 'Boba_Avax';
    if (chain && chain.toLowerCase() === 'boba_bnb') return 'Boba_Bnb';
    if (
      chain &&
      (chain.toLowerCase() === 'zksync_era' ||
        chain.toLowerCase() === 'zksync era' ||
        chain.toLowerCase() === 'era')
    )
      return 'zkSync Era';
    if (chain && chain.toLowerCase() === 'polygon_zkevm') return 'Polygon zkEVM';
    if (chain && chain.toLowerCase() === 'real') return 're.al';
    return chain.charAt(0).toUpperCase() + chain.slice(1);
  };