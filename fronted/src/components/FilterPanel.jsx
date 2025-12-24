import { useState, useEffect } from 'react';
import { getStations } from '../../../backend/services/api';

function FilterPanel({ filters, setFilters, onReset, availableStations }) {
  const [stations, setStations] = useState([]);
  const [isExpanded, setIsExpanded] = useState({
    basic: true,
    advanced: false
  });

  useEffect(() => {
    if (availableStations && availableStations.length > 0) {
      setStations(availableStations);
    } else {
      loadStations();
    }
  }, [availableStations]);

  const loadStations = async () => {
    try {
      const data = await getStations();
      setStations(data || []);
    } catch (error) {
      console.error('載入捷運站失敗:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    console.log(`🔧 [FilterPanel] 更新篩選: ${key} = ${value}`);
    setFilters({ ...filters, [key]: value });
  };

  const toggleSection = (section) => {
    setIsExpanded({ ...isExpanded, [section]: !isExpanded[section] });
  };

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3> 篩選器</h3>
        <button className="btn-text" onClick={onReset}>
           重設全部
        </button>
      </div>

      {/* ========== 基本篩選 ========== */}
      <div className="filter-section">
        <button 
          className="section-toggle"
          onClick={() => toggleSection('basic')}
        >
          <span>基本篩選</span>
          <span className="toggle-icon">{isExpanded.basic ? '▼' : '▶'}</span>
        </button>

        {isExpanded.basic && (
          <div className="section-content">
            {/* 捷運站 */}
            <div className="filter-group">
              <label className="filter-label">捷運站</label>
              <select
                className="filter-select"
                value={filters.station}
                onChange={(e) => handleFilterChange('station', e.target.value)}
              >
                <option value="">所有捷運站</option>
                {stations.map(station => (
                  <option key={station.name || station.station_name} value={station.name || station.station_name}>
                    {station.name || station.station_name}
                    {station.daily_flow && ` (${Math.round(station.daily_flow / 1000)}k人流)`}
                  </option>
                ))}
              </select>
            </div>

            {/* 分數範圍 */}
            <div className="filter-group">
              <label className="filter-label">
                分數範圍: {filters.minScore} - {filters.maxScore}
              </label>
              <div className="range-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.minScore}
                  onChange={(e) => handleFilterChange('minScore', parseInt(e.target.value))}
                  className="range-slider"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.maxScore}
                  onChange={(e) => handleFilterChange('maxScore', parseInt(e.target.value))}
                  className="range-slider"
                />
              </div>
              <div className="range-values">
                <span>{filters.minScore}</span>
                <span>{filters.maxScore}</span>
              </div>
            </div>

            {/* 只顯示推薦 */}
            <div className="filter-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.isRecommended === '推薦'}
                  onChange={(e) => handleFilterChange('isRecommended', e.target.checked ? '推薦' : '')}
                />
                <span>只顯示推薦地點 ⭐</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ========== 進階篩選 ========== */}
      <div className="filter-section">
        <button 
          className="section-toggle"
          onClick={() => toggleSection('advanced')}
        >
          <span>進階篩選</span>
          <span className="toggle-icon">{isExpanded.advanced ? '▼' : '▶'}</span>
        </button>

        {isExpanded.advanced && (
          <div className="section-content">
            {/* 分數等級 */}
            <div className="filter-group">
              <label className="filter-label">分數等級</label>
              <select
                className="filter-select"
                value={filters.scoreLevel}
                onChange={(e) => handleFilterChange('scoreLevel', e.target.value)}
              >
                <option value="">所有等級</option>
                <option value="優秀">⭐⭐⭐ 優秀</option>
                <option value="良好">⭐⭐ 良好</option>
                <option value="普通">⭐ 普通</option>
                <option value="差">❌ 差</option>
              </select>
            </div>

            {/* 供需程度 */}
            <div className="filter-group">
              <label className="filter-label">供需程度</label>
              <select
                className="filter-select"
                value={filters.supplyDemandLevel}
                onChange={(e) => handleFilterChange('supplyDemandLevel', e.target.value)}
              >
                <option value="">所有競爭程度</option>
                <option value="供給不足">🟢 供給不足 (低競爭)</option>
                <option value="適度競爭">🟡 適度競爭</option>
                <option value="接近飽和">🟠 接近飽和 (高競爭)</option>
                <option value="過度飽和">🔴 過度飽和</option>
              </select>
            </div>

            {/* 人流等級 */}
            <div className="filter-group">
              <label className="filter-label">人流等級</label>
              <select
                className="filter-select"
                value={filters.flowLevel}
                onChange={(e) => handleFilterChange('flowLevel', e.target.value)}
              >
                <option value="">所有人流等級</option>
                <option value="高">🔥 高人流</option>
                <option value="中">📊 中人流</option>
                <option value="低">📉 低人流</option>
              </select>
            </div>

            {/* 可達性 */}
            <div className="filter-group">
              <label className="filter-label">可達性</label>
              <select
                className="filter-select"
                value={filters.distanceCategory}
                onChange={(e) => handleFilterChange('distanceCategory', e.target.value)}
              >
                <option value="">所有可達性</option>
                <option value="近距離">🚶 步行可達 (近距離 0-500m)</option>
                <option value="中距離">🚴 YouBike (中距離 500-1500m)</option>
                <option value="遠距離">🚌 需轉乘 (遠距離 1500m+)</option>
              </select>
            </div>

            {/* YouBike 等級 */}
            <div className="filter-group">
              <label className="filter-label">YouBike 等級</label>
              <select
                className="filter-select"
                value={filters.youbikeLevel}
                onChange={(e) => handleFilterChange('youbikeLevel', e.target.value)}
              >
                <option value="">所有 YouBike 等級</option>
                <option value="3站以上">🚴 優秀 (3站以上)</option>
                <option value="2站">🚲 良好 (2站)</option>
                <option value="1站">🛴 普通 (1站)</option>
                <option value="0站">❌ 差 (0站)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 篩選統計 */}
      <div className="filter-stats">
        <p className="stats-text">
          已套用 {countActiveFilters()} 個篩選條件
        </p>
      </div>
    </div>
  );

  function countActiveFilters() {
    let count = 0;
    if (filters.station) count++;
    if (filters.minScore > 0 || filters.maxScore < 100) count++;
    if (filters.isRecommended) count++;
    if (filters.scoreLevel) count++;
    if (filters.supplyDemandLevel) count++;
    if (filters.flowLevel) count++;
    if (filters.distanceCategory) count++;
    if (filters.youbikeLevel) count++;
    return count;
  }
}

export default FilterPanel;