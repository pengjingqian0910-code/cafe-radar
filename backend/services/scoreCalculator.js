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

// 計算租金對分數的影響（精細分段：在 1000~2000 區間細分）
export function calculateRentScore(rent) {
  if (rent === undefined || rent === null) return 50; // 中性分
  const r = Number(rent);
  if (Number.isNaN(r)) return 50;

  // 精細分段：更貼近實務租金分佈（1000~2000）
  if (r <= 1200) return 100;
  if (r <= 1400) return 85;
  if (r <= 1600) return 70;
  if (r <= 1800) return 55;
  if (r <= 2000) return 40;
  return 0;
}

// 計算各項分數（含租金分數 rentScore，租金越高分越低）
function calculateScores(flowAccessibility, supplyDemandRatio, youbikeCount, rent = null) {
  const flowScore = Math.min(100, flowAccessibility / 1000);
  const supplyScore = Math.max(0, 100 - supplyDemandRatio * 50);
  const youbikeScore = Math.min(100, youbikeCount * 20);
  const rentScore = calculateRentScore(rent);
  
  return {
    flowScore: Number(flowScore.toFixed(1)),
    supplyScore: Number(supplyScore.toFixed(1)),
    youbikeScore: Number(youbikeScore.toFixed(1)),
    rentScore: Number(rentScore.toFixed(1)),
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
  } = siteData;
  
  // 計算基礎指標
  const flowAccessibility = calculateFlowAccessibility(
    daily_flow,
    mrt_distance,
    youbike_distance
  );
  
  const supplyDemandRatio = calculateSupplyDemandRatio(competitors, daily_flow);
  
  // 計算各項分數
  const rent = siteData.rent; // 可選，來自 shops 表或輸入
  
  const scores = calculateScores(
    flowAccessibility,
    supplyDemandRatio,
    youbike_count,
    rent
  );
  
  // 綜合分數（加權平均，包含 rentScore，權重：flow 0.40, supply 0.30, youbike 0.20, rent 0.10）
  const optimalScore = Number((
    scores.flowScore * 0.40 +
    scores.supplyScore * 0.30 +
    scores.youbikeScore * 0.20 +
    scores.rentScore * 0.10
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
    rent: (rent !== undefined && rent !== null && !Number.isNaN(Number(rent))) ? Number(rent) : null,
    optimalScore,
    recommendation,
  };
}