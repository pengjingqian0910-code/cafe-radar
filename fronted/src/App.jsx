import { useState, useEffect } from 'react';
import Map from './components/Map';
import FilterPanel from './components/FilterPanel';
import SiteCard from './components/SiteCard';
import AIExplaination from './components/AIExplaination';
import { getMapData, getSites, getAIExplaination } from '../../backend/src/services/api';
import './App.css';

function App() {
  // 地圖資料
  const [mapData, setMapData] = useState({
    sites: [],
    stations: [],
    shops: []
  });

  const [filteredSites, setFilteredSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiExplaination, setAIExplaination] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false); // AI 載入狀態

  // 篩選條件（新版結構）
  const [filters, setFilters] = useState({
    station: '',
    minScore: 60,
    maxScore: 100,
    scoreLevel: '',
    supplyDemandLevel: '',
    flowLevel: '',
    youbikeLevel: '',
    distanceCategory: '',
    isRecommended: ''
  });

  // 初始載入：使用 getMapData 一次取得所有資料
  useEffect(() => {
    loadInitialData();
  }, []);

  // 當篩選條件改變時，重新查詢
  useEffect(() => {
    if (mapData.sites.length > 0) {
      applyFilters();
    }
  }, [filters, mapData.sites]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      console.log('🔄 載入初始資料...');

      // 一次取得所有資料（推薦地點 + 捷運站 + 店家）
      const data = await getMapData({
        includeShops: true,
        shopType: 'cafe',
        onlyRecommended: false
      });

      console.log(' 成功載入資料:', {
        sites: data.recommendedSites?.length || 0,
        stations: data.mrtStations?.length || 0,
        shops: data.shops?.length || 0
      });

      setMapData({
        sites: data.recommendedSites || [],
        stations: data.mrtStations || [],
        shops: data.shops || []
      });

      setFilteredSites(data.recommendedSites || []);

    } catch (error) {
      console.error('載入資料失敗:', error);
      alert('無法載入資料，請確認後端是否啟動');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    try {
      console.log('🔍 套用篩選:', filters);

      // 建立篩選參數（只包含有值的參數）
      const filterParams = {};

      if (filters.station) filterParams.station = filters.station;
      if (filters.minScore) filterParams.minScore = filters.minScore;
      if (filters.maxScore) filterParams.maxScore = filters.maxScore;
      if (filters.scoreLevel) filterParams.scoreLevel = filters.scoreLevel;
      if (filters.supplyDemandLevel) filterParams.supplyDemandLevel = filters.supplyDemandLevel;
      if (filters.flowLevel) filterParams.flowLevel = filters.flowLevel;
      if (filters.youbikeLevel) filterParams.youbikeLevel = filters.youbikeLevel;
      if (filters.distanceCategory) filterParams.distanceCategory = filters.distanceCategory;
      if (filters.isRecommended) filterParams.isRecommended = filters.isRecommended;

      console.log(' 發送篩選參數:', filterParams);

      // 如果有篩選條件，呼叫後端 API
      if (Object.keys(filterParams).length > 0) {
        const result = await getSites(filterParams);
        console.log(' 篩選結果:', result.data?.length || 0, '個地點');
        setFilteredSites(result.data || []);
      } else {
        // 沒有篩選條件，顯示所有地點
        console.log('ℹ 沒有篩選條件，顯示所有地點');
        setFilteredSites(mapData.sites);
      }

    } catch (error) {
      console.error(' 篩選失敗:', error);
      // 如果 API 失敗，退回前端篩選
      console.log(' API 篩選失敗，使用前端篩選');
      applyFrontendFilters();
    }
  };

  // 備用方案：前端篩選（當 API 失敗時）
  const applyFrontendFilters = () => {
    let filtered = [...mapData.sites];

    // 捷運站篩選
    if (filters.station) {
      filtered = filtered.filter(site => site.mrt_station === filters.station);
    }

    // 分數範圍篩選
    if (filters.minScore) {
      filtered = filtered.filter(site => site.optimal_score >= filters.minScore);
    }
    if (filters.maxScore) {
      filtered = filtered.filter(site => site.optimal_score <= filters.maxScore);
    }

    // 分數等級篩選
    if (filters.scoreLevel) {
      filtered = filtered.filter(site =>
        site.score_level && site.score_level.includes(filters.scoreLevel)
      );
    }

    // 供需等級篩選
    if (filters.supplyDemandLevel) {
      filtered = filtered.filter(site =>
        site.supply_demand_level && site.supply_demand_level.includes(filters.supplyDemandLevel)
      );
    }

    // 人流等級篩選
    if (filters.flowLevel) {
      filtered = filtered.filter(site =>
        site.flow_level && site.flow_level.includes(filters.flowLevel)
      );
    }

    // YouBike 等級篩選
    if (filters.youbikeLevel) {
      filtered = filtered.filter(site =>
        site.youbike_level && site.youbike_level.includes(filters.youbikeLevel)
      );
    }

    // 距離類別篩選
    if (filters.distanceCategory) {
      filtered = filtered.filter(site =>
        site.distance_category && site.distance_category.includes(filters.distanceCategory)
      );
    }

    // 推薦狀態篩選
    if (filters.isRecommended) {
      filtered = filtered.filter(site =>
        site.is_recommended && site.is_recommended.includes(filters.isRecommended)
      );
    }

    // 排序
    filtered.sort((a, b) => (b.optimal_score || 0) - (a.optimal_score || 0));

    console.log(' 前端篩選完成:', filtered.length, '個地點');
    setFilteredSites(filtered);
  };

  const handleSiteClick = (site) => {
    console.log(' 選中地點:', site.mrt_station, site.zone_label);
    setSelectedSite(site);
  };

  const handleAIAnalysis = async (site) => {
    // 檢查 site 是否存在
    if (!site) {
      console.error('❌ 沒有選中地點');
      alert('請先選擇一個地點');
      return;
    }

    try {
      console.log(' 開始 AI 分析:', site.mrt_station, site.zone_label);

      // 立即打開 Modal，顯示載入狀態
      setShowAIModal(true);
      setSelectedSite(site);
      setAIExplaination(''); // 清空舊的分析
      setAiLoading(true); // 設定載入狀態

      // 請求 AI 分析（這會需要時間）
      const explaination = await getAIExplaination(site);

      console.log(' AI 分析完成');
      setAIExplaination(explaination);
      setAiLoading(false);

    } catch (error) {
      console.error(' 取得 AI 分析失敗:', error);

      setAiLoading(false);

      // 顯示友善的錯誤訊息
      let errorMessage = '抱歉，AI 分析暫時無法使用。請稍後再試。\n\n';

      if (error.message?.includes('API key')) {
        errorMessage += ' AI 服務設定問題（API Key）\n請聯絡系統管理員。';
      } else if (error.message?.includes('超時')) {
        errorMessage += ' AI 分析時間過長\n請稍後再試，或選擇其他地點。';
      } else if (error.message?.includes('連接')) {
        errorMessage += ' 無法連接到伺服器\n請確認後端服務是否正常運作。';
      } else {
        errorMessage += `錯誤訊息: ${error.message}`;
      }

      setAIExplaination(errorMessage);
    }
  };

  const handleResetFilters = () => {
    console.log('🔄 重設篩選條件');
    setFilters({
      station: '',
      minScore: 60,
      maxScore: 100,
      scoreLevel: '',
      supplyDemandLevel: '',
      flowLevel: '',
      youbikeLevel: '',
      distanceCategory: '',
      isRecommended: ''
    });
    setFilteredSites(mapData.sites);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>☕ 咖啡廳選址</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            重新載入
          </button>
          <div className="stats-badge">
            共 {filteredSites.length} 個地點
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* 左側篩選面板 */}
        <aside className="sidebar">
          <FilterPanel
            filters={filters}
            setFilters={setFilters}
            onReset={handleResetFilters}
            availableStations={mapData.stations}
          />
        </aside>

        {/* 主要內容區 */}
        <main className="main-content">
          {/* 地圖 */}
          <div className="map-container">
            <Map
              sites={filteredSites}
              stations={mapData.stations}
              shops={mapData.shops}
              selectedSite={selectedSite}
              onSiteClick={handleSiteClick}
            />
          </div>

          {selectedSite && (
            <SiteCard
              site={selectedSite}
              onClose={() => setSelectedSite(null)}
              onAIAnalysis={handleAIAnalysis}
            />
          )}

          {/* 推薦地點列表 */}
          <div className="sites-list">
            <div className="list-header">
              <h3> 推薦地點列表</h3>
              <span className="count-badge">{filteredSites.length} 個地點</span>
            </div>

            {filteredSites.length === 0 ? (
              <div className="empty-state">
                <p> 沒有符合條件的地點</p>
                <button className="btn-primary" onClick={handleResetFilters}>
                  重設篩選條件
                </button>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="sites-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>地點</th>
                      <th>分數</th>
                      <th>等級</th>
                      <th>供需狀態</th>
                      <th>推薦</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.map((site, index) => (
                      <tr
                        key={site.point_id}
                        onClick={() => handleSiteClick(site)}
                        className={selectedSite?.point_id === site.point_id ? 'selected' : ''}
                      >
                        <td>
                          <span className="rank-badge">{index + 1}</span>
                        </td>
                        <td>
                          <div className="site-name">
                            <strong>{site.mrt_station}</strong>
                            <span className="zone">{site.zone_label}</span>
                          </div>
                        </td>
                        <td>
                          <span className="score">{site.optimal_score?.toFixed(1) || 'N/A'}</span>
                        </td>
                        <td>
                          <span className={`level-badge ${site.score_level?.toLowerCase() || ''}`}>
                            {site.score_level || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="status">{site.supply_demand_status}</span>
                        </td>
                        <td>
                          <span className={`recommend-badge ${site.is_recommended === '推薦' ? 'yes' : 'no'}`}>
                            {site.recommendation}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAIAnalysis(site);
                            }}
                          >
                            AI 分析
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* AI 解釋 Modal */}
      {showAIModal && (
        <AIExplaination
          site={selectedSite}
          explaination={aiExplaination}
          loading={aiLoading}
          onClose={() => setShowAIModal(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>載入資料中...</p>
        </div>
      )}
    </div>
  );
}

export default App;