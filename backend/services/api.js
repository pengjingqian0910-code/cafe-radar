// src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================================================
// 🔧 通用請求函數（加入超時控制）
// ============================================================================

async function fetchWithTimeout(url, options = {}, timeout = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('請求超時，請稍後再試');
    }
    
    throw error;
  }
}

// ============================================================================
// 📍 地點相關 API
// ============================================================================

export async function getSites(filters = {}) {
  try {
    console.log('📤 [API] 發送篩選請求:', filters);
    
    const queryParams = new URLSearchParams();
    
    // 只加入有值的參數
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const url = `${API_BASE_URL}/sites?${queryParams}`;
    console.log('🔗 [API] 請求 URL:', url);
    
    const response = await fetchWithTimeout(url, {}, 10000);
    const data = await response.json();
    
    console.log('✅ [API] 篩選結果:', data.data?.length || 0, '個地點');
    return data;
  } catch (error) {
    console.error('❌ [API] 篩選請求失敗:', error);
    throw error;
  }
}

// ============================================================================
// 🚇 捷運站相關 API
// ============================================================================

export async function getStations() {
  try {
    console.log('📤 [API] 取得捷運站列表');
    
    // 修正：使用正確的端點
    const response = await fetchWithTimeout(`${API_BASE_URL}/sites/mrt-stations`, {}, 10000);
    const data = await response.json();
    
    // 適配不同的回應格式
    const stations = data.data || data || [];
    
    console.log('✅ [API] 捷運站:', stations.length, '個');
    return stations;
  } catch (error) {
    console.error('❌ [API] 取得捷運站失敗:', error);
    return [];
  }
}

// ============================================================================
// 🗺️ 地圖整合 API
// ============================================================================

export async function getMapData(options = {}) {
  try {
    console.log('📤 [API] 取得地圖資料:', options);
    
    // 方案 1: 嘗試使用整合端點
    try {
      const queryParams = new URLSearchParams();
      
      if (options.includeShops) queryParams.append('includeShops', 'true');
      if (options.shopType) queryParams.append('shopType', options.shopType);
      if (options.onlyRecommended !== undefined) {
        queryParams.append('onlyRecommended', options.onlyRecommended);
      }
      
      const url = `${API_BASE_URL}/map?${queryParams}`;
      console.log('🔗 [API] 嘗試整合端點:', url);
      
      const response = await fetchWithTimeout(url, {}, 15000);
      const data = await response.json();
      
      console.log('✅ [API] 使用整合端點成功');
      return data;
    } catch (mapError) {
      console.warn('⚠️ [API] 整合端點不可用，使用分離請求');
      
      // 方案 2: 分別請求各項資料
      const [sitesData, stationsData, shopsData] = await Promise.all([
        // 取得推薦地點
        getSites(options.onlyRecommended ? { isRecommended: '推薦' } : {}),
        
        // 取得捷運站
        getStations(),
        
        // 取得店家（如果需要）
        options.includeShops 
          ? getShops({ type: options.shopType, limit: 1000 })
          : Promise.resolve([])
      ]);
      
      // 組合資料
      const combinedData = {
        recommendedSites: sitesData.data || sitesData || [],
        mrtStations: stationsData || [],
        shops: shopsData || []
      };
      
      console.log('✅ [API] 地圖資料（分離請求）:', {
        sites: combinedData.recommendedSites.length,
        stations: combinedData.mrtStations.length,
        shops: combinedData.shops.length,
      });
      
      return combinedData;
    }
  } catch (error) {
    console.error('❌ [API] 取得地圖資料失敗:', error);
    throw error;
  }
}

// ============================================================================
// 🏪 店家相關 API
// ============================================================================

export async function getShops(options = {}) {
  try {
    const { type, category, limit = 1000 } = options;
    
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());
    
    const url = params.toString()
      ? `${API_BASE_URL}/sites/shops?${params.toString()}`
      : `${API_BASE_URL}/sites/shops`;
    
    console.log('📤 [API] 取得店家:', url);
    
    const response = await fetchWithTimeout(url, {}, 10000);
    const data = await response.json();
    
    const shops = data.data || data || [];
    console.log('✅ [API] 店家:', shops.length, '個');
    
    return shops;
  } catch (error) {
    console.error('❌ [API] 取得店家失敗:', error);
    return [];
  }
}

// ============================================================================
// 🤖 AI 相關 API
// ============================================================================

export async function getAIExplaination(site) {
  try {
    console.log('📤 [API] 請求 AI 分析:', site.mrt_station, site.zone_label);
    console.log('⏱️ [API] AI 生成可能需要 10-30 秒，請耐心等待...');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/ai/explain`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(site),
      },
      60000 // 60 秒超時
    );
    
    const data = await response.json();
    
    console.log('✅ [API] AI 分析完成');
    console.log('📝 [API] 回應長度:', data.explaination?.length || 0, '字元');
    
    return data.explaination || '無法生成分析';
  } catch (error) {
    console.error('❌ [API] AI 分析請求失敗:', error);
    
    if (error.message.includes('超時')) {
      throw new Error('AI 分析時間過長，請稍後再試');
    } else if (error.message.includes('Failed to fetch')) {
      throw new Error('無法連接到伺服器，請確認後端是否啟動');
    } else {
      throw error;
    }
  }
}

export async function compareLocations(sites) {
  try {
    console.log('📤 [API] 請求地點比較:', sites.length, '個地點');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/ai/compare`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sites }),
      },
      60000
    );
    
    const data = await response.json();
    
    console.log('✅ [API] 地點比較完成');
    return data.comparison;
  } catch (error) {
    console.error('❌ [API] 地點比較失敗:', error);
    throw error;
  }
}

export async function getActionPlan(site, options = {}) {
  try {
    console.log('📤 [API] 請求行動計劃');
    
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/ai/action-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ site, options }),
      },
      60000
    );
    
    const data = await response.json();
    
    console.log('✅ [API] 行動計劃完成');
    return data.plan;
  } catch (error) {
    console.error('❌ [API] 行動計劃失敗:', error);
    throw error;
  }
}

// ============================================================================
// 📊 統計相關 API
// ============================================================================

export async function getStatistics(filters = {}) {
  try {
    console.log('📤 [API] 取得統計資訊');
    
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const url = `${API_BASE_URL}/statistics?${queryParams}`;
    const response = await fetchWithTimeout(url, {}, 10000);
    const data = await response.json();
    
    console.log('✅ [API] 統計資訊:', data);
    return data;
  } catch (error) {
    console.error('❌ [API] 取得統計失敗:', error);
    throw error;
  }
}

// ============================================================================
// 🔧 工具函數
// ============================================================================

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function testConnection() {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/sites`, {}, 5000);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export default {
  getSites,
  getStations,
  getMapData,
  getShops,
  getAIExplaination,
  compareLocations,
  getActionPlan,
  getStatistics,
  testConnection,
  getApiBaseUrl,
};