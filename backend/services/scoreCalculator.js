// 計算距離衰減係數
function calculateDecayCoefficient(distance) {
  if (distance <= 500) return 1.0;
  if (distance <= 1000) return 0.7;
  if (distance <= 1500) return 0.4;
  if (distance <= 2000) return 0.2;
  return 0.05;
}

// 計算 YouBike 衰減係數
function calculateYouBikeDecay(youbikeDistance, mrtDistance) {
  if (youbikeDistance <= 200 && mrtDistance <= 2500) return 0.8;
  if (youbikeDistance <= 200 && mrtDistance <= 3000) return 0.6;
  if (youbikeDistance <= 200 && mrtDistance <= 4000) return 0.4;
  return 0.0;
}

// 計算人流可達性
export function calculateFlowAccessibility(dailyFlow, mrtDistance, youbikeDistance = 999) {
  const walkDecay = calculateDecayCoefficient(mrtDistance);
  const bikeDecay = calculateYouBikeDecay(youbikeDistance, mrtDistance);
  const combinedDecay = Math.max(walkDecay, bikeDecay);
  
  return Math.round(dailyFlow * combinedDecay);
}

// 計算供需比
export function calculateSupplyDemandRatio(competitors, dailyFlow) {
  if (dailyFlow === 0) return 999;
  return Number((competitors / (dailyFlow / 10000)).toFixed(2));
}

// 計算各項分數
function calculateScores(flowAccessibility, supplyDemandRatio, youbikeCount, facilityCount = 5) {
  const flowScore = Math.min(100, flowAccessibility / 1000);
  const supplyScore = Math.max(0, 100 - supplyDemandRatio * 50);
  const youbikeScore = Math.min(100, youbikeCount * 20);
  const facilityScore = Math.min(100, facilityCount * 10);
  
  return {
    flowScore: Number(flowScore.toFixed(1)),
    supplyScore: Number(supplyScore.toFixed(1)),
    youbikeScore: Number(youbikeScore.toFixed(1)),
    facilityScore: Number(facilityScore.toFixed(1)),
  };
}

// 計算綜合分數
export function calculateOptimalScore(siteData) {
  const {
    lat,
    lon,
    mrt_station,
    daily_flow,
    mrt_distance,
    youbike_distance,
    competitors,
    youbike_count,
    facility_count = 5,
  } = siteData;
  
  // 計算基礎指標
  const flowAccessibility = calculateFlowAccessibility(
    daily_flow,
    mrt_distance,
    youbike_distance
  );
  
  const supplyDemandRatio = calculateSupplyDemandRatio(competitors, daily_flow);
  
  // 計算各項分數
  const scores = calculateScores(
    flowAccessibility,
    supplyDemandRatio,
    youbike_count,
    facility_count
  );
  
  // 綜合分數（加權平均）
  const optimalScore = Number((
    scores.flowScore * 0.40 +
    scores.supplyScore * 0.30 +
    scores.youbikeScore * 0.20 +
    scores.facilityScore * 0.10
  ).toFixed(1));
  
  // 推薦等級
  let recommendation;
  if (optimalScore >= 85 && supplyDemandRatio < 0.5) {
    recommendation = '⭐⭐⭐ 強烈推薦';
  } else if (optimalScore >= 70 && supplyDemandRatio < 0.7) {
    recommendation = '⭐⭐ 推薦';
  } else if (optimalScore >= 60) {
    recommendation = '⭐ 謹慎考慮';
  } else {
    recommendation = '❌ 不推薦';
  }
  
  // 供需狀況
  let supplyDemandStatus;
  if (supplyDemandRatio < 0.5) {
    supplyDemandStatus = '🟢 供給不足';
  } else if (supplyDemandRatio < 0.7) {
    supplyDemandStatus = '🟡 適度競爭';
  } else if (supplyDemandRatio < 1.0) {
    supplyDemandStatus = '🟠 接近飽和';
  } else {
    supplyDemandStatus = '🔴 市場飽和';
  }
  
  return {
    flowAccessibility,
    supplyDemandRatio,
    supplyDemandStatus,
    ...scores,
    optimalScore,
    recommendation,
  };
}