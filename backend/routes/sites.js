import express from 'express';
import {
  getSitesFromBigQuery,
  getMrtStationsFromBigQuery,
  getShopsFromBigQuery,
  getStationDetail,
  getStationsFromBigQuery,
  getStatistics,
  searchSites,
  clearCache,
  testConnection
} from '../services/bigquery.js';
import { calculateOptimalScore } from '../services/scoreCalculator.js';

const router = express.Router();

// ============================================================================
// 1. 取得推薦地點（支援進階篩選）
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const { 
      station, 
      minScore, 
      maxScore, 
      supplyDemandLevel,    // 新增：LOW, MEDIUM, HIGH
      scoreLevel,           // 新增：EXCELLENT, GOOD, FAIR, POOR
      flowLevel,            // 新增：HIGH, MEDIUM, LOW
      youbikeLevel,         // 新增：EXCELLENT, GOOD, FAIR, POOR
      distanceCategory,     // 新增：WALK, YOUBIKE, TRANSIT, FAR
      isRecommended,        // 新增：YES, NO
      zone,
      limit,
      offset
    } = req.query;
    
    // 如果有任何篩選條件，使用進階搜尋
    if (station || minScore || maxScore || supplyDemandLevel || scoreLevel || 
        flowLevel || youbikeLevel || distanceCategory || isRecommended || zone) {
      
      const result = await searchSites({
        station,
        minScore: minScore ? parseFloat(minScore) : undefined,
        maxScore: maxScore ? parseFloat(maxScore) : undefined,
        supplyDemandLevel,
        scoreLevel,
        flowLevel,
        youbikeLevel,
        distanceCategory,
        isRecommended,
        zone,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
      });
      
      return res.json({
        success: true,
        ...result
      });
    }
    
    // 沒有篩選條件，返回所有地點
    const sites = await getSitesFromBigQuery();
    
    res.json({
      success: true,
      data: sites,
      pagination: {
        total: sites.length,
        offset: 0,
        limit: sites.length,
        hasMore: false
      }
    });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sites',
      message: error.message
    });
  }
});

// ============================================================================
// 2. 取得 TOP N 推薦地點
// ============================================================================

router.get('/top', async (req, res) => {
  try {
    const { n = 10, station } = req.query;
    const limit = parseInt(n);
    
    const result = await searchSites({
      station,
      limit,
      offset: 0,
      isRecommended: 'YES'  // 只顯示推薦的地點
    });
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    console.error('Error fetching top sites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top sites',
      message: error.message
    });
  }
});

// ============================================================================
// 3. 取得捷運站資料（帶位置資訊）
// ============================================================================

router.get('/mrt-stations', async (req, res) => {
  try {
    const stations = await getMrtStationsFromBigQuery();
    
    res.json({
      success: true,
      data: stations,
      total: stations.length
    });
  } catch (error) {
    console.error('Error fetching MRT stations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MRT stations',
      message: error.message
    });
  }
});

// ============================================================================
// 4. 取得店家資料
// ============================================================================

router.get('/shops', async (req, res) => {
  try {
    const { type, category, limit } = req.query;
    
    const shops = await getShopsFromBigQuery({
      type,
      category,
      limit: limit ? parseInt(limit) : 1000
    });
    
    res.json({
      success: true,
      data: shops,
      total: shops.length,
      filters: { type, category }
    });
  } catch (error) {
    console.error('Error fetching shops:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shops',
      message: error.message
    });
  }
});

// ============================================================================
// 5. 取得特定捷運站詳細資訊
// ============================================================================

router.get('/station/:stationName', async (req, res) => {
  try {
    const { stationName } = req.params;
    
    const stationDetail = await getStationDetail(decodeURIComponent(stationName));
    
    if (!stationDetail) {
      return res.status(404).json({
        success: false,
        error: 'Station not found'
      });
    }
    
    res.json({
      success: true,
      data: stationDetail
    });
  } catch (error) {
    console.error('Error fetching station detail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch station detail',
      message: error.message
    });
  }
});

// ============================================================================
// 6. 取得捷運站列表（用於篩選器下拉選單）
// ============================================================================

router.get('/meta/stations', async (req, res) => {
  try {
    const stations = await getStationsFromBigQuery();
    
    res.json({
      success: true,
      data: stations
    });
  } catch (error) {
    console.error('Error fetching station list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stations',
      message: error.message
    });
  }
});

// ============================================================================
// 7. 取得統計資訊
// ============================================================================

router.get('/meta/stats', async (req, res) => {
  try {
    const stats = await getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// ============================================================================
// 8. 地圖整合資料（一次取得所有地圖需要的資料）
// ============================================================================

router.get('/map-data', async (req, res) => {
  try {
    const { 
      includeShops = 'false', 
      shopType, 
      shopCategory,
      onlyRecommended = 'false'
    } = req.query;
    
    // 平行取得資料
    const promises = [
      onlyRecommended === 'true' 
        ? searchSites({ isRecommended: 'YES', limit: 1000 }).then(r => r.data)
        : getSitesFromBigQuery(),
      getMrtStationsFromBigQuery()
    ];
    
    const [sites, mrtStations] = await Promise.all(promises);
    
    const mapData = {
      recommendedSites: sites,
      mrtStations: mrtStations,
    };
    
    // 如果需要店家資料
    if (includeShops === 'true') {
      const shops = await getShopsFromBigQuery({
        type: shopType,
        category: shopCategory,
        limit: 500  // 限制地圖上的店家數量
      });
      mapData.shops = shops;
    }
    
    res.json({
      success: true,
      data: mapData,
      counts: {
        sites: sites.length,
        stations: mrtStations.length,
        shops: mapData.shops ? mapData.shops.length : 0
      }
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch map data',
      message: error.message
    });
  }
});

// ============================================================================
// 9. 重新計算分數（保留原有功能）
// ============================================================================

router.post('/calculate', async (req, res) => {
  try {
    const { lat, lon, mrt_station, daily_flow, competitors, youbike_count } = req.body;
    
    // 驗證必要欄位
    if (!lat || !lon || !mrt_station || !daily_flow) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['lat', 'lon', 'mrt_station', 'daily_flow']
      });
    }
    
    const result = calculateOptimalScore({
      lat,
      lon,
      mrt_station,
      daily_flow,
      competitors: competitors || 0,
      youbike_count: youbike_count || 0,
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate score',
      message: error.message
    });
  }
});

// ============================================================================
// 10. 批次計算分數
// ============================================================================

router.post('/calculate/batch', async (req, res) => {
  try {
    const { sites } = req.body;
    
    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'sites must be a non-empty array'
      });
    }
    
    const results = sites.map(site => {
      try {
        return {
          ...site,
          ...calculateOptimalScore(site),
          success: true
        };
      } catch (error) {
        return {
          ...site,
          success: false,
          error: error.message
        };
      }
    });
    
    res.json({
      success: true,
      data: results,
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
  } catch (error) {
    console.error('Error in batch calculation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate batch scores',
      message: error.message
    });
  }
});

// ============================================================================
// 11. 清除快取
// ============================================================================

router.post('/clear-cache', (req, res) => {
  try {
    clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// ============================================================================
// 12. 測試 BigQuery 連接
// ============================================================================

router.get('/test-connection', async (req, res) => {
  try {
    const isConnected = await testConnection();
    
    res.json({
      success: isConnected,
      message: isConnected ? 'BigQuery connection successful' : 'BigQuery connection failed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      message: error.message
    });
  }
});

export default router;