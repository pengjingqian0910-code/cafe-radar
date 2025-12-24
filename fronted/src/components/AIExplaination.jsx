import { useState } from 'react';
import '../App.css';
import './AIExplaination.css'

function AIExplaination({ site, explaination, onClose, loading }) {
  const [isClosing, setIsClosing] = useState(false);

  // 處理關閉動畫
  const handleClose = () => {
    setIsClosing(true);
    // 這裡的 300ms 剛好對應你 App.css 裡的動畫時間
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!site) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content error-state">
          <div className="modal-header">
            <h2>❌ 載入失敗</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <p>找不到地點資訊，請重新選擇。</p>
          </div>
        </div>
      </div>
    );
  }

  // 格式化 AI 回傳的 Markdown 文字
  const formatExplaination = (text) => {
    if (!text || text.trim().length === 0) {
      return <p className="loading-text-fallback">正在從數據庫調取深度分析資料...</p>;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    
    return lines.map((line, index) => {
      // 處理標題 (支援 # 或 1. )
      if (line.match(/^#{1,4}\s/) || line.match(/^\d+\.\s/)) {
        return (
          <h4 key={index} className="ai-report-heading">
            {line.replace(/^#{1,4}\s*/, '')}
          </h4>
        );
      }
      
      // 處理列表 (支援 - 或 *)
      if (line.startsWith('-') || line.startsWith('*')) {
        return (
          <li key={index} className="ai-report-list-item">
            {line.replace(/^[*-]\s*/, '')}
          </li>
        );
      }
      
      // 一般段落
      return (
        <p key={index} className="ai-report-paragraph">
          {line}
        </p>
      );
    });
  };

  return (
    <div 
      className={`modal-overlay ${isClosing ? 'closing' : ''}`} 
      onClick={handleClose}
    >
      <div 
        className={`modal-content ${isClosing ? 'closing' : ''}`} 
        onClick={(e) => e.stopPropagation()}
        /* 這裡保留 minHeight 是為了防止你提到的「白線」問題 */
        style={{ minHeight: '500px' }} 
      >
        {/* Header: 對應 App.css 的 .modal-header */}
        <div className="modal-header">
          <div className="header-brand">
            <span className="ai-icon">🤖</span>
            <h2>AI 戰略分析報告</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        {/* Body: 對應 App.css 的 .modal-body */}
        <div className="modal-body">
          {/* 地點概覽卡片 */}
          <div className="site-summary-card">
            <div className="site-title">
              <span className="pin">📍</span>
              <h3>{site.mrt_station} <small>{site.zone_label}</small></h3>
            </div>
            <div className="site-stats">
              <div className="stat-tag">🏆 評分: <strong>{site.optimal_score?.toFixed(1)}</strong></div>
              <div className="stat-tag">👥 人流: {site.flow_level || '中'}</div>
              <div className="stat-tag">⚖️ 供需: {site.supply_demand_level || '平衡'}</div>
            </div>
          </div>

          {/* AI 內容解析區 */}
          <div className="ai-content-area">
            {loading ? (
              <div className="ai-loading-view">
                <div className="spinner"></div>
                <h4>正在生成深度報告...</h4>
                <p>正在分析該區域的競爭強度與交通可達性</p>
              </div>
            ) : (
              <div className="ai-report-text">
                {formatExplaination(explaination)}
              </div>
            )}
          </div>
        </div>

        {/* Footer: 對應 App.css 的 .modal-footer */}
        <div className="modal-footer">
          <button 
            className="modal-btn-close"
            onClick={handleClose}
          >
            結束閱讀
          </button>
        </div>
      </div>

      {/* 補充動畫效果與局部修正 */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { 
          width: 40px; height: 40px; border: 4px solid #f1f5f9; 
          border-top-color: #2563eb; border-radius: 50%; 
          animation: spin 1s linear infinite; margin: 0 auto 1rem;
        }
        .site-summary-card {
          background: #f8fafc; border-radius: 16px; padding: 20px;
          margin-bottom: 25px; border: 1px solid #e2e8f0;
        }
        .site-stats { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
        .stat-tag { background: white; padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; border: 1px solid #e2e8f0; color: #475569; }
        .ai-report-heading { color: #1e3a8a; margin: 20px 0 10px; font-weight: 800; border-left: 4px solid #2563eb; padding-left: 12px; }
        .ai-report-paragraph { line-height: 1.8; color: #334155; margin-bottom: 15px; }
        .modal-btn-close { 
          background: #2563eb; color: white; border: none; padding: 10px 25px; 
          border-radius: 10px; cursor: pointer; font-weight: 600; 
        }
        /* 避免與 App.css 衝突的保險 */
        .modal-header h2 { color: white !important; margin: 0; }
      `}</style>
    </div>
  );
}

export default AIExplaination;