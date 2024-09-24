import { Request, Response } from "express";
import cache from "../utils/cache";
import _ from "lodash";

export const getApy = async (req: Request, res: Response) => {
  try {
    const queryParams = req.query as { aToken?: string; vToken?: string };
    const zerolendPoolData: any = cache.get("apy:zerolend") || [];
    // const aaveV2PoolData: any = cache.get("apy:aave-v2") || [];
    const aaveV3PoolData: any = cache.get("apy:aave-v3") || [];

    const pools = [...zerolendPoolData, ...aaveV3PoolData];

    if (!pools) {
      return res.json({ success: false, message: "No data available" });
    }

    const aToken = queryParams.aToken?.toLowerCase() || "";
    const vToken = queryParams.vToken?.toLowerCase() || "";

    const filteredData = pools.filter(
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

        for (let j = 0; j < poolData.length; j++) {
          const comparePool = poolData[j];
          const isAToken = basePool.symbol.toLowerCase().includes(aToken);
          const isVToken = comparePool.symbol.toLowerCase().includes(vToken);
          if (isAToken && isVToken) {
            const temp = {
              project: basePool.project,
              chain: basePool.chain,
              ltv: isAToken ? basePool.ltv : comparePool.ltv,
              borrowApy: isAToken
                ? comparePool.apyBaseBorrow
                : basePool.apyBaseBorrow,
              aToken: isAToken ? basePool.symbol : comparePool.symbol,
              vToken: isAToken ? comparePool.symbol : basePool.symbol,
              aToken_price: isAToken ? basePool.price : comparePool.price,
              vToken_price: isAToken ? comparePool.price : basePool.price,
              route: isAToken
                ? `${basePool.symbol} -> ${comparePool.symbol}`
                : `${comparePool.symbol} -> ${basePool.symbol}`,
              poolAddres: isAToken ? comparePool.address : basePool.address,
              debtAddress: isAToken
                ? comparePool.underlyingTokens[0]
                : basePool.underlyingTokens[0],
              collateralAddress: isAToken
                ? basePool.underlyingTokens[0]
                : comparePool.underlyingTokens[0],
            };
            response.push(temp);
          }
        }
      }
    });

    res.json({
      success: true,
      reserves: _.isEmpty(response) ? {} : response,
    });
  } catch (error) {
    console.error("Error fetching APY data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
