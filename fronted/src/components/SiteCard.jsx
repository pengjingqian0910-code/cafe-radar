import React from 'react';
import './SiteCard.css';

function SiteCard({ site, onClose, onAIAnalysis }) {
  if (!site) return null;

  // 診斷：確認關閉按鈕被點擊
  const handleClose = (e) => {
    console.log('🔴 關閉按鈕被點擊！', e);
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  // 取得等級顏色
  const getLevelClass = (level) => {
    const levelMap = {
      '優秀': 'excellent',
      '良好': 'good',
      '普通': 'fair',
      '差': 'poor'
    };
    return levelMap[level] || 'fair';
  };

  // 格式化數字
  const formatNumber = (num) => {
    if (!num) return 'N/A';
    return Math.round(num).toLocaleString();
  };

  // 格式化百分比
  const formatPercentage = (num) => {
    if (num === undefined || num === null) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  return (
    <div className="site-card">
      {/* Header */}
      <div className="site-card-header">
        <div className="site-card-title">
          <div className="site-icon">📍</div>
          <div>
            <h2>{site.mrt_station}</h2>
            <p className="site-zone">{site.zone_label}</p>
          </div>
        </div>
        <button 
          className="card-close-btn" 
          onClick={handleClose}
          type="button"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      {/* Score Banner */}
      <div className="score-banner">
        <div className="score-main">
          <div className="score-label">綜合評分</div>
          <div className="score-value">{site.optimal_score?.toFixed(1) || 'N/A'}</div>
          <div className="score-max">/ 100</div>
        </div>
        <div className="score-badges">
          <span className={`level-badge-modern ${getLevelClass(site.score_level)}`}>
            {site.score_level || '未評級'}
          </span>
          {site.is_recommended === '推薦' && (
            <span className="recommend-badge-modern">⭐ 推薦</span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        {/* 人流分析 */}
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-label">人流可達性</div>
            <div className="metric-value">
              {formatNumber(site.flow_accessibility)}
            </div>
            <div className="metric-unit">人次/日</div>
            <div className="metric-sub">
              <span className={`level-indicator ${getLevelClass(site.flow_level)}`}>
                {site.flow_level || 'N/A'}
              </span>
              <span className="metric-score">{site.flow_score || 0}/100</span>
            </div>
          </div>
        </div>

        {/* 供需分析 */}
        <div className="metric-card">
          <div className="metric-icon">⚖️</div>
          <div className="metric-content">
            <div className="metric-label">供需狀態</div>
            <div className="metric-value">
              {formatPercentage(site.supply_demand_ratio)}
            </div>
            <div className="metric-unit">供需比</div>
            <div className="metric-sub">
              <span className="supply-status">
                {site.supply_demand_level || 'N/A'}
              </span>
              <span className="metric-score">{site.competition_score || 0}/100</span>
            </div>
          </div>
        </div>

        {/* 競爭環境 */}
        <div className="metric-card">
          <div className="metric-icon">☕</div>
          <div className="metric-content">
            <div className="metric-label">競爭店家</div>
            <div className="metric-value">
              {site.cafe_count || 0}
            </div>
            <div className="metric-unit">家咖啡廳</div>
            <div className="metric-sub">
              <span className="total-competitors">
                總計 {site.total_competitors || site.total_competitor || 0} 家
              </span>
            </div>
          </div>
        </div>

        {/* 交通便利 */}
        <div className="metric-card">
          <div className="metric-icon">🚲</div>
          <div className="metric-content">
            <div className="metric-label">YouBike 便利性</div>
            <div className="metric-value">
              {site.youbike_count || 0}
            </div>
            <div className="metric-unit">個站點</div>
            <div className="metric-sub">
              <span className={`level-indicator ${getLevelClass(site.youbike_level)}`}>
                {site.youbike_level || 'N/A'}
              </span>
              <span className="metric-score">{site.youbike_score || 0}/100</span>
            </div>
          </div>
        </div>

        {/* 距離分析 */}
        <div className="metric-card">
          <div className="metric-icon">🚶</div>
          <div className="metric-content">
            <div className="metric-label">可達性</div>
            <div className="metric-value">
              {site.zone_start_m || 0}m
            </div>
            <div className="metric-unit">距離捷運站</div>
            <div className="metric-sub">
              <span className="distance-category">
                {site.distance_category || 'N/A'}
              </span>
              <span className="metric-score">{site.distance_score || 0}/100</span>
            </div>
          </div>
        </div>

        {/* 基礎人流 */}
        <div className="metric-card">
          <div className="metric-icon">🚇</div>
          <div className="metric-content">
            <div className="metric-label">捷運站人流</div>
            <div className="metric-value">
              {formatNumber(site.base_flow)}
            </div>
            <div className="metric-unit">人次/日</div>
            <div className="metric-sub">
              <span className="distance-decay">
                衰減係數 {site.distance_decay?.toFixed(2) || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="site-card-actions">
        <button 
          className="btn-ai-analysis"
          onClick={() => onAIAnalysis(site)}
        >
          <span className="btn-icon">🤖</span>
          <span>AI 深度分析</span>
        </button>
      </div>
    </div>
  );
}

export default SiteCard;