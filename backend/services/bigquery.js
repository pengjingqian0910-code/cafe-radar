import { BigQuery } from '@google-cloud/bigquery';
import { calculateRentScore } from './scoreCalculator.js';

// 初始化 BigQuery 客戶端
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE,
});

const DATASET_ID = 'cafe_analysis';

// 快取配置
let cachedSites = null;
let cachedMrtStations = null;
let cachedShops = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘

// ============================================================================
// 1. 取得分析地點資料 (main_analysis)
// ============================================================================

export async function getSitesFromBigQuery() {
  // 檢查快取
  if (cachedSites && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('✓ Returning cached sites data');
    return cachedSites;
  }
  
  const query = `
    SELECT 
      -- 生成唯一 ID
      CONCAT(mrt_station, '_', zone_label) as point_id,
      
      -- 基本資訊
      mrt_station,
      zone_label,
      zone_start_m,
      base_flow,
      
      -- 距離與衰減
      distance_decay,
      distance_category,
      distance_score,
      
      -- 人流分析
      flow_accessibility,
      flow_score,
      flow_level,
      youbike_bonus,
      
      -- 供需分析
      cafe_count,
      total_competitors,
      supply_demand_ratio,
      supply_demand_level,
      competition_score,
      
      -- YouBike 分析
      youbike_count,
      youbike_score,
      youbike_level,
      
      -- 綜合評分
      optimal_score,
      score_level,
      is_recommended
      
    FROM 
      \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.main_analysis\`
    ORDER BY 
      optimal_score DESC
  `;
  
  try {
    console.log('🔍 Querying BigQuery for analysis sites...');
    const [rows] = await bigquery.query(query);
    
    // 後處理：生成前端需要的欄位
    let processedRows = rows.map(row => ({
      ...row,
      
      // 生成推薦狀態（根據分數和推薦欄位）
      recommendation: generateRecommendation(row),
      
      // 生成供需狀態
      supply_demand_status: generateSupplyDemandStatus(row),
      
      // 生成可達性類型
      access_type: generateAccessType(row)
    }));

    // 嘗試把租金資訊以站為單位補回來（使用 shops 資料的站內 median rent）
    try {
      const shops = await getShopsFromBigQuery({ limit: 10000 });
      const stationRents = new Map();
      for (const s of shops) {
        if (!s.station) continue;
        const r = s.rent !== null && s.rent !== undefined ? Number(s.rent) : null;
        if (r === null || Number.isNaN(r)) continue;
        if (!stationRents.has(s.station)) stationRents.set(s.station, []);
        stationRents.get(s.station).push(r);
      }

      const median = arr => {
        arr.sort((a, b) => a - b);
        const m = Math.floor(arr.length / 2);
        return (arr.length % 2 === 1) ? arr[m] : (arr[m - 1] + arr[m]) / 2;
      };

      processedRows = processedRows.map(r => {
        const rents = stationRents.get(r.mrt_station) || [];
        const rentVal = rents.length ? median(rents) : null;
        return {
          ...r,
          rent: (rentVal !== null ? Number(rentVal) : null),
          rent_score: (rentVal !== null ? calculateRentScore(rentVal) : null),
          rent_source: rents.length ? 'station_median' : null
        };
      });
    } catch (err) {
      console.warn('⚠️ Failed to attach rents to sites:', err.message);
    }
    
    // 更新快取
    cachedSites = processedRows;
    cacheTimestamp = Date.now();
    
    console.log(`✅ Successfully fetched ${processedRows.length} analysis sites`);
    return processedRows;
  } catch (error) {
    console.error('❌ BigQuery Error (main_analysis):', error.message);
    
    // 如果快取存在，返回快取
    if (cachedSites) {
      console.warn('⚠️ Returning stale cache due to query error');
      return cachedSites;
    }
    
    throw error;
  }
}

// ============================================================================
// 輔助函數：生成推薦狀態
// ============================================================================

function generateRecommendation(row) {
  const score = row.optimal_score || 0;
  const isRecommended = row.is_recommended;
  
  // 處理多種可能的推薦值
  const isRecommendedYes = 
    isRecommended === '推薦' || 
    isRecommended === 'YES' || 
    isRecommended === 'Yes' || 
    isRecommended === 'yes' ||
    isRecommended === true;
  
  // 如果明確標記為不推薦
  if (isRecommended === '不推薦' || isRecommended === 'NO' || isRecommended === false) {
    return '❌ 不推薦';
  }
  
  // 根據分數決定
  if (score >= 85) {
    return '⭐⭐⭐ 強烈推薦';
  } else if (score >= 70) {
    return '⭐⭐ 推薦';
  } else if (score >= 60) {
    return '⭐ 謹慎考慮';
  } else {
    return '❌ 不推薦';
  }
}

// ============================================================================
// 輔助函數：生成供需狀態
// ============================================================================

function generateSupplyDemandStatus(row) {
  const level = row.supply_demand_level;
  const ratio = row.supply_demand_ratio;
  
  // 處理中文標籤
  if (level) {
    if (level.includes('供給不足') || level === '低競爭' || level === 'LOW') {
      return '🟢 供給不足';
    } else if (level.includes('適度') || level === '中等競爭' || level === 'MEDIUM') {
      return '🟡 適度競爭';
    } else if (level.includes('接近飽和') || level === '高競爭' || level === 'HIGH') {
      return '🟠 接近飽和';
    } else if (level.includes('過度') || level.includes('飽和')) {
      return '🔴 過度飽和';
    }
  }
  
  // 根據供需比決定
  if (ratio !== undefined && ratio !== null) {
    if (ratio < 0.3) {
      return '🟢 供給不足';
    } else if (ratio < 0.6) {
      return '🟡 適度競爭';
    } else if (ratio < 0.9) {
      return '🟠 接近飽和';
    } else {
      return '🔴 過度飽和';
    }
  }
  
  return '❓ 資料不足';
}

// ============================================================================
// 輔助函數：生成可達性類型
// ============================================================================

function generateAccessType(row) {
  const category = row.distance_category;
  const zoneStart = row.zone_start_m;
  
  // 處理中文標籤
  if (category) {
    if (category.includes('近距離') || category.includes('<500') || category === 'WALK') {
      return '🚶 步行可達';
    } else if (category.includes('中距離') || category.includes('500') || category === 'YOUBIKE') {
      return '🚴 YouBike 推薦';
    } else if (category.includes('遠距離') || category === 'TRANSIT') {
      return '🚌 需要轉乘';
    } else if (category.includes('極遠') || category === 'FAR') {
      return '🚫 距離過遠';
    }
  }
  
  // 根據距離決定
  if (zoneStart !== undefined && zoneStart !== null) {
    if (zoneStart < 500) {
      return '🚶 步行可達';
    } else if (zoneStart < 1500) {
      return '🚴 YouBike 推薦';
    } else if (zoneStart < 2500) {
      return '🚌 需要轉乘';
    } else {
      return '🚫 距離過遠';
    }
  }
  
  return '❓ 資料不足';
}

// ============================================================================
// 2. 取得捷運站資料 (mrt_locations)
// ============================================================================

export async function getMrtStationsFromBigQuery() {
  if (cachedMrtStations && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('✓ Returning cached MRT stations data');
    return cachedMrtStations;
  }
  
  const query = `
    SELECT 
      station_name,
      lat,
      lon,
      daily_flow
    FROM 
      \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.mrt_locations\`
    ORDER BY 
      daily_flow DESC
  `;
  
  try {
    console.log('🚇 Querying BigQuery for MRT stations...');
    const [rows] = await bigquery.query(query);
    
    cachedMrtStations = rows;
    
    console.log(`✅ Successfully fetched ${rows.length} MRT stations`);
    return rows;
  } catch (error) {
    console.error('❌ BigQuery Error (mrt_locations):', error.message);
    
    if (cachedMrtStations) {
      return cachedMrtStations;
    }
    
    throw error;
  }
}

// ============================================================================
// 3. 取得店家資料 (shops_locations)
// ============================================================================

export async function getShopsFromBigQuery(filters = {}) {
  const { type, category, limit = 1000 } = filters;
  
  // 構建 WHERE 條件（安全性提示：目前為簡單字串拼接，若有外部輸入可考慮使用參數化查詢）
  const whereConditions = [];
  if (type) whereConditions.push(`type = '${type}'`);
  if (category) whereConditions.push(`category = '${category}'`);
  const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // 資料來源改為 nov_2024.shops（包含 rent 欄位），明確選欄並做型別轉換
  const query = `
    SELECT 
      station,
      shop_type,
      shop_name,
      SAFE_CAST(disrtance AS FLOAT64) as disrtance,
      SAFE_CAST(distance AS FLOAT64) as distance,
      address,
      SAFE_CAST(latitude AS FLOAT64) as latitude,
      SAFE_CAST(longtitude AS FLOAT64) as longtitude,
      SAFE_CAST(longitude AS FLOAT64) as longitude,
      status,
      SAFE_CAST(rent AS FLOAT64) as rent
    FROM 
      \`${process.env.GCP_PROJECT_ID}.nov_2024.shops\`
    ${whereClause}
    LIMIT ${limit}
  `;
  
  try {
    console.log(`🏪 Querying BigQuery for shops... (type: ${type || 'all'}, category: ${category || 'all'}, limit: ${limit})`);
    const [rows] = await bigquery.query(query);
    
    // 後處理：標準化欄位名稱、處理 typo、如果 rent 為 null 則嘗試從 status 中擷取數字
    const processed = rows.map(r => {
      // 優先使用正確欄位 distance，若沒有則使用 disrtance
      const distance = (r.distance !== null && r.distance !== undefined) ? Number(r.distance) : ((r.disrtance !== null && r.disrtance !== undefined) ? Number(r.disrtance) : null);
      // 優先使用 longitude，若沒有則使用 longtitude
      const longitude = (r.longitude !== null && r.longitude !== undefined) ? Number(r.longitude) : ((r.longtitude !== null && r.longtitude !== undefined) ? Number(r.longtitude) : null);
      // parse rent (primary: rent column; fallback: extract from status if exists)
      let rent = (r.rent !== null && r.rent !== undefined) ? Number(r.rent) : null;
      if ((rent === null || Number.isNaN(rent)) && r.status) {
        const m = String(r.status).match(/(\d+(?:\.\d+)?)/);
        if (m) rent = Number(m[1]);
      }
      return {
        station: r.station || null,
        shop_type: r.shop_type || null,
        shop_name: r.shop_name || null,
        distance: distance,
        address: r.address || null,
        latitude: (r.latitude !== null && r.latitude !== undefined) ? Number(r.latitude) : null,
        longitude: longitude,
        status: r.status || null,
        rent: (rent !== undefined && rent !== null && !Number.isNaN(rent)) ? Number(rent) : null
      };
    });
    
    // 更新快取
    cachedShops = processed;
    cacheTimestamp = Date.now();
    
    console.log(`✅ Successfully fetched ${processed.length} shops (normalized)`);
    return processed;
  } catch (error) {
    console.error('❌ BigQuery Error (nov_2024.shops):', error.message);
    if (cachedShops) {
      console.warn('⚠️ Returning stale cache due to query error');
      return cachedShops;
    }
    throw error;
  }
}

// ============================================================================
// 4. 取得特定捷運站的詳細分析
// ============================================================================

export async function getStationDetail(stationName) {
  const query = `
    WITH station_info AS (
      SELECT 
        station_name,
        lat as station_lat,
        lon as station_lon,
        daily_flow
      FROM 
        \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.mrt_locations\`
      WHERE 
        station_name = '${stationName}'
    ),
    
    station_analysis AS (
      SELECT 
        zone_label,
        zone_start_m,
        optimal_score,
        score_level,
        flow_accessibility,
        flow_score,
        flow_level,
        supply_demand_ratio,
        supply_demand_level,
        competition_score,
        cafe_count,
        total_competitors,
        youbike_count,
        youbike_score,
        youbike_level,
        distance_score,
        distance_category,
        is_recommended
      FROM 
        \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.main_analysis\`
      WHERE 
        mrt_station = '${stationName}'
      ORDER BY 
        optimal_score DESC
    )
    
    SELECT 
      s.station_name,
      s.station_lat,
      s.station_lon,
      s.daily_flow,
      ARRAY_AGG(STRUCT(
        a.zone_label,
        a.zone_start_m,
        a.optimal_score,
        a.score_level,
        a.flow_accessibility,
        a.flow_score,
        a.flow_level,
        a.supply_demand_ratio,
        a.supply_demand_level,
        a.competition_score,
        a.cafe_count,
        a.total_competitors,
        a.youbike_count,
        a.youbike_score,
        a.youbike_level,
        a.distance_score,
        a.distance_category,
        a.is_recommended
      ) ORDER BY a.optimal_score DESC) as analysis_zones
    FROM 
      station_info s
    LEFT JOIN 
      station_analysis a ON TRUE
    GROUP BY 
      s.station_name, s.station_lat, s.station_lon, s.daily_flow
  `;
  
  try {
    console.log(`🔍 Querying detailed info for station: ${stationName}`);
    const [rows] = await bigquery.query(query);
    
    if (rows.length === 0) {
      return null;
    }
    
    // 後處理每個區間
    const result = rows[0];
    if (result.analysis_zones) {
      result.analysis_zones = result.analysis_zones.map(zone => ({
        ...zone,
        recommendation: generateRecommendation(zone),
        supply_demand_status: generateSupplyDemandStatus(zone),
        access_type: generateAccessType(zone)
      }));
    }
    
    console.log(`✅ Successfully fetched station detail`);
    return result;
  } catch (error) {
    console.error('❌ BigQuery Error (station detail):', error.message);
    throw error;
  }
}

// ============================================================================
// 5. 取得所有捷運站列表（用於篩選器）
// ============================================================================

export async function getStationsFromBigQuery() {
  try {
    const query = `
      SELECT DISTINCT 
        station_name,
        daily_flow
      FROM 
        \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.mrt_locations\`
      ORDER BY 
        daily_flow DESC
    `;
    
    const [rows] = await bigquery.query(query);
    
    return rows.map(row => ({
      name: row.station_name,
      daily_flow: row.daily_flow
    }));
  } catch (error) {
    console.error('❌ Error fetching stations:', error.message);
    throw error;
  }
}

// ============================================================================
// 6. 取得統計資訊
// ============================================================================

export async function getStatistics() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_locations,
        AVG(optimal_score) as avg_score,
        MAX(optimal_score) as max_score,
        MIN(optimal_score) as min_score,
        AVG(supply_demand_ratio) as avg_supply_demand_ratio,
        SUM(cafe_count) as total_cafes,
        COUNT(DISTINCT mrt_station) as total_stations,
        
        -- 推薦統計（處理中文）
        COUNTIF(is_recommended = '推薦' OR is_recommended = 'YES') as recommended_count,
        COUNTIF(is_recommended = '不推薦' OR is_recommended = 'NO') as not_recommended_count,
        
        -- 等級分布（處理中文）
        COUNTIF(score_level LIKE '%優秀%' OR score_level = 'EXCELLENT') as excellent_count,
        COUNTIF(score_level LIKE '%良好%' OR score_level = 'GOOD') as good_count,
        COUNTIF(score_level LIKE '%普通%' OR score_level = 'FAIR') as fair_count,
        COUNTIF(score_level LIKE '%差%' OR score_level = 'POOR') as poor_count,
        
        -- 供需分布（處理中文）
        COUNTIF(supply_demand_level LIKE '%供給不足%' OR supply_demand_level = 'LOW') as low_competition_count,
        COUNTIF(supply_demand_level LIKE '%適度%' OR supply_demand_level = 'MEDIUM') as medium_competition_count,
        COUNTIF(supply_demand_level LIKE '%飽和%' OR supply_demand_level = 'HIGH') as high_competition_count
        
      FROM 
        \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.main_analysis\`
    `;
    
    const [rows] = await bigquery.query(query);
    return rows[0];
  } catch (error) {
    console.error('❌ Error fetching statistics:', error.message);
    throw error;
  }
}

// ============================================================================
// 7. 進階搜尋
// ============================================================================

export async function searchSites(filters = {}) {
  // 支援駝峰式和底線式兩種格式
  const station = filters.station || filters.mrt_station;
  const minScore = filters.minScore || filters.min_score;
  const maxScore = filters.maxScore || filters.max_score;
  const supplyDemandLevel = filters.supplyDemandLevel || filters.supply_demand_level;
  const scoreLevel = filters.scoreLevel || filters.score_level;
  const flowLevel = filters.flowLevel || filters.flow_level;
  const youbikeLevel = filters.youbikeLevel || filters.youbike_level;
  const distanceCategory = filters.distanceCategory || filters.distance_category;
  const isRecommended = filters.isRecommended || filters.is_recommended;
  const zone = filters.zone || filters.zone_label;
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  
  let whereConditions = [];
  
  if (station) {
    whereConditions.push(`mrt_station = '${station}'`);
  }
  
  if (minScore !== undefined && minScore !== null) {
    whereConditions.push(`optimal_score >= ${minScore}`);
  }
  
  if (maxScore !== undefined && maxScore !== null) {
    whereConditions.push(`optimal_score <= ${maxScore}`);
  }
  
  if (zone) {
    whereConditions.push(`zone_label = '${zone}'`);
  }
  
  // 處理中文和英文的等級標籤（模糊匹配）
  if (supplyDemandLevel) {
    whereConditions.push(`(supply_demand_level LIKE '%${supplyDemandLevel}%')`);
  }
  
  if (scoreLevel) {
    whereConditions.push(`(score_level LIKE '%${scoreLevel}%')`);
  }
  
  if (flowLevel) {
    whereConditions.push(`(flow_level LIKE '%${flowLevel}%')`);
  }
  
  if (youbikeLevel) {
    whereConditions.push(`(youbike_level LIKE '%${youbikeLevel}%')`);
  }
  
  if (distanceCategory) {
    whereConditions.push(`(distance_category LIKE '%${distanceCategory}%')`);
  }
  
  if (isRecommended) {
    whereConditions.push(`(is_recommended LIKE '%${isRecommended}%')`);
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';
  
  // 除錯日誌
  console.log('🔍 [BigQuery] Search filters:', {
    station,
    minScore,
    maxScore,
    scoreLevel,
    supplyDemandLevel,
    flowLevel,
    youbikeLevel,
    distanceCategory,
    isRecommended
  });
  console.log('📝 [BigQuery] WHERE conditions:', whereConditions);
  console.log('🔎 [BigQuery] WHERE clause:', whereClause);
  
  const query = `
    SELECT 
      CONCAT(mrt_station, '_', zone_label) as point_id,
      mrt_station,
      zone_label,
      zone_start_m,
      base_flow,
      distance_decay,
      distance_category,
      distance_score,
      flow_accessibility,
      flow_score,
      flow_level,
      youbike_bonus,
      cafe_count,
      total_competitors,
      supply_demand_ratio,
      supply_demand_level,
      competition_score,
      youbike_count,
      youbike_score,
      youbike_level,
      optimal_score,
      score_level,
      is_recommended
    FROM 
      \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.main_analysis\`
    ${whereClause}
    ORDER BY 
      optimal_score DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  
  try {
    const [rows] = await bigquery.query(query);
    
    // 後處理
    const processedRows = rows.map(row => ({
      ...row,
      recommendation: generateRecommendation(row),
      supply_demand_status: generateSupplyDemandStatus(row),
      access_type: generateAccessType(row)
    }));
    
    // 取得總數
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.main_analysis\`
      ${whereClause}
    `;
    const [countRows] = await bigquery.query(countQuery);
    const total = countRows[0].total;
    
    return {
      data: processedRows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  } catch (error) {
    console.error('❌ Error searching sites:', error.message);
    throw error;
  }
}

// ============================================================================
// 8. 清除快取
// ============================================================================

export function clearCache() {
  cachedSites = null;
  cachedMrtStations = null;
  cachedShops = null;
  cacheTimestamp = null;
  console.log('✓ Cache cleared');
}

// ============================================================================
// 9. 測試連接
// ============================================================================

export async function testConnection() {
  try {
    const query = 'SELECT 1 as test';
    await bigquery.query(query);
    console.log('✅ BigQuery connection successful');
    return true;
  } catch (error) {
    console.error('❌ BigQuery connection failed:', error.message);
    return false;
  }
}