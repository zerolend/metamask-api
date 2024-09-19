export const keepFinite = (p: any) => {
  if (
    !["apyBase", "apyReward", "apy"]
      .map((f) => Number.isFinite(p[f]))
      .includes(true)
  )
    return false;

  return Number.isFinite(p["tvlUsd"]);
};
