import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 💡 關鍵就在這一行！
    // 設定為 true 或 '0.0.0.0'，伺服器就會監聽所有網路介面（包括 Public IP）
    host: true, 
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        // ⚠️ 注意：如果你的後端 API 也在另一台電腦，這裡也要改成該電腦的 IP
        target: 'http://localhost:3001', 
        changeOrigin: true,
      },
    },
  },
})