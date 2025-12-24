import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sitesRouter from './routes/sites.js';
import aiRouter from './routes/ai.js';

dotenv.config();

// 🧪 測試環境變數
console.log('🧪 Environment Variables:');
console.log('  PORT:', process.env.PORT);
console.log('  GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID);
console.log('  GCP_KEY_FILE:', process.env.GCP_KEY_FILE);
console.log('  DATASET_ID:', process.env.DATASET_ID || 'cafe_analysis');
console.log('  AI_SERVICE:', process.env.AI_SERVICE);
console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:5173');
console.log('');

const app = express();
const PORT = process.env.PORT || 3001;
// 🧪 顯示系統資訊
console.log('----------------------------------------------');
console.log('🧪 咖啡廳分析系統：後端助手啟動中...');

/* 🔑 CORS 修改：
   這就像是給所有人發一張臨時通行證。
   我們設定 origin: true，不管是從 localhost 還是從 192.168.x.x 進來，
   後端都會乖乖聽話。
*/
app.use(cors({
  origin: true, 
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📝 誰連進來都記錄下來，方便你抓蟲
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] 收到請求: ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/sites', sitesRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      port: PORT,
      gcpProject: process.env.GCP_PROJECT_ID,
      aiService: process.env.AI_SERVICE
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Cafe Site Selection API',
    version: '1.0.0',
    description: '咖啡廳選址分析系統 API',
    endpoints: {
      sites: [
        'GET  /api/sites - 取得所有推薦地點（支援進階篩選）',
        'GET  /api/sites/top - 取得 TOP N 推薦地點',
        'GET  /api/sites/mrt-stations - 取得捷運站位置資料',
        'GET  /api/sites/shops - 取得店家資料',
        'GET  /api/sites/station/:name - 取得特定捷運站詳情',
        'GET  /api/sites/meta/stations - 取得捷運站列表（篩選器用）',
        'GET  /api/sites/meta/stats - 取得統計資訊',
        'GET  /api/sites/map-data - 取得地圖整合資料',
        'POST /api/sites/calculate - 計算單一地點分數',
        'POST /api/sites/calculate/batch - 批次計算分數',
        'POST /api/sites/clear-cache - 清除快取',
        'GET  /api/sites/test-connection - 測試 BigQuery 連接'
      ],
      ai: [
        'POST /api/ai/explain - 取得 AI 解釋',
        'POST /api/ai/compare - 比較多個地點',
        'POST /api/ai/action-plan - 生成行動計劃'
      ],
      system: [
        'GET  /health - 健康檢查',
        'GET  / - API 資訊'
      ]
    },
    documentation: 'https://github.com/your-repo/docs',
    support: 'contact@example.com'
  });
});

// API 版本資訊
app.get('/api', (req, res) => {
  res.json({
    version: '1.0.0',
    status: 'active',
    availableEndpoints: [
      '/api/sites',
      '/api/ai'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      '/api/sites',
      '/api/ai',
      '/health',
      '/'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 【後端已準備就緒】`);
  console.log(`📍 內部連結: http://localhost:${PORT}`);
  console.log(`🌐 外部連線請使用你的電腦 IP，例如: http://192.168.x.x:${PORT}`);
});

export default app;