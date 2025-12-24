import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// 確保載入環境變數
dotenv.config();

// ============================================================================
// 🔧 環境變數檢查與初始化
// ============================================================================

console.log('============================================');
console.log('🔍 [AI Service] 環境變數檢查');
console.log('============================================');
console.log('GEMINI_API_KEY 存在:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY 長度:', process.env.GEMINI_API_KEY?.length || 0);
console.log('GEMINI_API_KEY 前 10 字:', process.env.GEMINI_API_KEY?.substring(0, 10) || 'undefined');
console.log('============================================');

// 檢查並處理 API Key
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ [AI Service] GEMINI_API_KEY 未設定！');
  console.error('請在 .env 檔案中設定：GEMINI_API_KEY=你的API金鑰');
  throw new Error('Missing GEMINI_API_KEY');
}

// 移除前後空白和引號
const apiKey = process.env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, '');

// 驗證 API Key 格式
if (!apiKey.startsWith('AIza')) {
  console.warn('⚠️ [AI Service] API Key 格式可能不正確（應以 "AIza" 開頭）');
}

// 初始化 Gemini
const genAI = new GoogleGenerativeAI(apiKey);
console.log('✅ [AI Service] GoogleGenerativeAI 初始化完成');

// ============================================================================
// 🎨 專業化 Prompt 生成器
// ============================================================================

function generateProfessionalPrompt(site) {
  const score = (site.optimal_score || 0).toFixed(1);
  const location = `${site.mrt_station || '未知地點'} ${site.zone_label || ''}`;
  
  return `
# 🎨 角色設定
你是一位頂尖的「商業地產選址顧問」，專門為高端咖啡品牌提供進駐建議。請針對以下數據進行深度剖析。

## 📊 數據面板
- 📍 地點：${location}
- 🚇 交通：距離捷運 ${site.zone_start_m || 0}m (${site.distance_category || '未知'})
- 🏆 綜合評分：${score} / 100 (${site.score_level || '未評級'})
- 👥 人流表現：每日約 ${Math.round(site.flow_accessibility || 0).toLocaleString()} 人次 (等級：${site.flow_level || '未知'})
- ⚖️ 供需狀況：供需比 ${((site.supply_demand_ratio || 0) * 100).toFixed(1)}% (${site.supply_demand_level || '未知'})
- ⚔️ 競爭環境：周邊已有 ${site.cafe_count || 0} 家咖啡廳，總競爭者 ${site.total_competitors || site.total_competitor || 0} 家
- 🚲 基礎設施：附近有 ${site.youbike_count || 0} 個 YouBike 站點 (${site.youbike_level || '未知'})

## 🏗️ 輸出任務 (請按照以下潮流 SaaS 風格撰寫)

### 1. 📍 區域戰略價值 (Strategic Value)
分析該地點在交通網路中的「樞紐地位」，以及人流帶來的集客效應。

### 2. ⚔️ 競爭護城河評估 (Competitive Moat)
針對現有競爭者數量，分析應採取「差異化突圍」還是「群聚紅利」策略。

### 3. ☕ 產品導向建議 (Product Positioning)
根據數據，該地點最適合哪種形態？(例如：外帶店、精品手沖、或工作友善店)

### 4. 🎯 目標客群洞察 (Target Audience)
基於人流特性和周邊環境，描述最適合的目標客群畫像。

### 5. 💰 經營策略建議 (Business Strategy)
提供 3-5 個具體的經營建議，包括定價策略、產品組合、服務模式等。

### 6. 🚀 最終開發評級 (Final Verdict)
給予 1-10 的信心分數，並用「最有力量的一句話」作為成敗關鍵總結。

---
請使用專業、簡練、充滿商業洞察力的語氣，多使用「市場空隙」、「流動紅利」、「品牌定位」等專業詞彙。
避免冗長的敘述，每個部分控制在 2-3 段落內。
`;
}

// ============================================================================
// 🤖 AI 生成主函數
// ============================================================================

export async function generateExplaination(site) {
  try {
    // 驗證輸入
    if (!site || !site.mrt_station) {
      throw new Error('Site data is missing or invalid');
    }

    console.log('[AI] 開始生成分析:', site.mrt_station, site.zone_label);
    
    // 🔥 關鍵修復：使用最新且穩定的模型名稱
    // 優先順序：
    // 1. gemini-1.5-flash-latest (最新版本，最穩定)
    // 2. gemini-1.5-flash (標準版本)
    // 3. gemini-2.0-flash-exp (實驗版本，僅測試用)
    
    let model;
    let modelName;
    
    try {
      // 優先嘗試使用 -latest 版本
      modelName = 'gemini-2.5-pro';
      console.log(`[Gemini] 嘗試使用模型: ${modelName}`);
      model = genAI.getGenerativeModel({ model: modelName });
    } catch (error) {
      // 如果 -latest 失敗，退回標準版本
      console.warn(`[Gemini] ${modelName} 不可用，退回標準版本`);
      modelName = 'gemini-1.5-flash';
      console.log(`[Gemini] 使用模型: ${modelName}`);
      model = genAI.getGenerativeModel({ model: modelName });
    }
    
    console.log('[Gemini] 生成專業 Prompt...');
    const prompt = generateProfessionalPrompt(site);
    console.log('[Gemini] Prompt 長度:', prompt.length, '字元');
    
    console.log('[Gemini] 發送請求到 API...');
    const result = await model.generateContent(prompt);
    
    console.log('[Gemini] 解析回應...');
    const response = await result.response;
    const text = response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('AI 回傳內容為空');
    }
    
    console.log('[Gemini] 成功生成分析');
    console.log('[Gemini] 回應長度:', text.length, '字元');
    
    return text;
    
  } catch (error) {
    console.error('============================================');
    console.error('❌ [AI Service] 錯誤詳情:');
    console.error('============================================');
    console.error('錯誤類型:', error.constructor.name);
    console.error('錯誤訊息:', error.message);
    
    // 針對不同錯誤提供解決方案
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      console.error('');
      console.error('💡 模型名稱問題：');
      console.error('當前嘗試的模型可能不可用');
      console.error('');
      console.error('解決方案：');
      console.error('1. 確認 @google/generative-ai 版本 >= 0.21.0');
      console.error('   執行：npm list @google/generative-ai');
      console.error('   更新：npm install @google/generative-ai@latest');
      console.error('');
      console.error('2. 可用的模型名稱：');
      console.error('   - gemini-1.5-flash-latest (推薦)');
      console.error('   - gemini-1.5-flash');
      console.error('   - gemini-1.5-pro-latest');
      console.error('');
      console.error('3. 查看可用模型列表：');
      console.error('   curl "https://generativelanguage.googleapis.com/v1/models?key=你的KEY"');
    } else if (error.message?.includes('API key')) {
      console.error('');
      console.error('💡 API Key 問題：');
      console.error('1. 檢查 .env 檔案中的 GEMINI_API_KEY');
      console.error('2. 確認沒有多餘的空白或引號');
      console.error('3. 前往重新生成：https://aistudio.google.com/app/apikey');
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      console.error('');
      console.error('💡 配額限制問題：');
      console.error('免費額度已用完，請稍後再試或升級方案');
    }
    
    console.error('============================================');
    
    // 返回備用分析
    console.log('[AI Service] 使用備用方案（基本分析）');
    return generateFallbackExplaination(site);
  }
}

// ============================================================================
// 🛡️ 備用方案：基本分析
// ============================================================================

function generateFallbackExplaination(site) {
  const score = site.optimal_score || 0;
  const location = `${site.mrt_station || '未知地點'} ${site.zone_label || ''}`;
  
  let analysis = `
## 📊 基本數據分析

### 📍 地點概況
**${location}** 的綜合評分為 **${score.toFixed(1)}** 分

### 🎯 快速評估
`;

  if (score >= 85) {
    analysis += `
**🌟 強烈推薦等級**

**區域戰略價值**
- 人流可達性：${(site.flow_accessibility || 0).toLocaleString()} 人次/日
- 交通便利度：${site.distance_category || '良好'}
- 集客效應強，位於交通樞紐位置

**競爭護城河**
- 供需比：${((site.supply_demand_ratio || 0) * 100).toFixed(1)}%
- ${site.supply_demand_level === '供給不足' ? '✅ 市場空隙大，競爭壓力小' : '適度競爭環境'}
- 周邊 ${site.cafe_count || 0} 家咖啡廳形成商圈聚集效應

**產品定位建議**
適合開設**中高端精品咖啡廳**，提供優質體驗

**經營策略**
1. 把握優質地點，快速建立品牌
2. 定位中高價位，重視品質與服務
3. 建立會員制度，培養忠實客群
4. 提供特色餐點，增加競爭力

**最終評級：9/10**
💎 這是一個值得大膽投資的黃金地段！
`;
  } else if (score >= 70) {
    analysis += `
**⭐ 推薦等級**

**區域戰略價值**
- 人流表現良好，每日約 ${Math.round(site.flow_accessibility || 0).toLocaleString()} 人次
- 交通可達性：${site.distance_category || '良好'}

**競爭環境**
- 周邊競爭者：${site.total_competitors || site.total_competitor || 0} 家
- ${site.supply_demand_level || '需要找到差異化定位'}

**產品定位建議**
適合開設**社區型咖啡廳**或**工作友善店**

**經營策略**
1. 找出獨特賣點，與競爭者區隔
2. 重視服務品質和顧客體驗
3. 靈活定價，適時推出促銷
4. 經營社群，建立口碑

**最終評級：7/10**
📈 謹慎評估後可以考慮投資
`;
  } else if (score >= 60) {
    analysis += `
**⚠️ 需謹慎評估**

**挑戰分析**
- 競爭環境：${site.supply_demand_level || '較為激烈'}
- 人流表現：${site.flow_level || '需要評估'}
- 需要明確的差異化策略

**建議**
1. 深入市場調查
2. 考慮其他替代地點
3. 如果堅持開店，需要控制成本
4. 準備至少 6 個月的周轉金

**最終評級：5/10**
⚡ 不建議新手創業者選擇此地點
`;
  } else {
    analysis += `
**❌ 不推薦**

綜合評分偏低（${score.toFixed(1)}分），建議尋找其他地點。

**主要問題**
- ${site.supply_demand_level || '市場環境不佳'}
- ${site.flow_level === '低' ? '人流量不足' : '需要改善'}

**建議**
🔴 強烈建議尋找其他更適合的地點

**最終評級：3/10**
`;
  }

  analysis += `

---
*⚠️ 注意：這是基於數據的基本分析，建議使用 AI 深度分析獲得更專業的建議。*
`;

  return analysis;
}

// ============================================================================
// 📊 多地點比較
// ============================================================================

export async function compareLocations(sites) {
  try {
    if (!sites || sites.length < 2) {
      throw new Error('Need at least 2 sites to compare');
    }

    console.log('[AI] 比較', sites.length, '個地點');

    // 使用相同的模型選擇邏輯
    let model;
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    } catch {
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    
    const sitesInfo = sites.map((site, index) => `
### 地點 ${index + 1}: ${site.mrt_station} ${site.zone_label}
- 🏆 綜合分數: ${site.optimal_score?.toFixed(1) || 'N/A'} / 100
- 👥 人流: ${site.flow_accessibility?.toLocaleString() || 'N/A'} 人次/日
- ⚖️ 供需比: ${site.supply_demand_ratio ? (site.supply_demand_ratio * 100).toFixed(1) + '%' : 'N/A'}
- ⚔️ 競爭: ${site.cafe_count || 0} 家咖啡廳，總計 ${site.total_competitors || 0} 家
- 🚲 YouBike: ${site.youbike_count || 0} 站
- 📍 推薦: ${site.is_recommended || '未知'}
`).join('\n');

    const prompt = `
你是專業的咖啡廳選址顧問。請比較以下 ${sites.length} 個地點：

${sitesInfo}

請提供：

## 1. 🏆 排名與推薦順序
根據綜合評分和實際潛力排序

## 2. 🎯 各地點特色分析
每個地點的核心優勢和潛在風險

## 3. 👥 適合對象
不同地點分別適合什麼類型的經營者

## 4. 💡 最終建議
如果只能選一個，推薦哪個？為什麼？

請簡潔專業，使用商業分析術語。
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error('[AI Comparison] 錯誤:', error);
    throw error;
  }
}

// ============================================================================
// 📋 行動計劃生成
// ============================================================================

export async function generateActionPlan(site, options = {}) {
  try {
    const { budget = 1000000, timeline = '3個月' } = options;

    console.log('[AI] 生成行動計劃:', site.mrt_station);

    let model;
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    } catch {
      model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }
    
    const prompt = `
你是經驗豐富的咖啡廳開店顧問。

## 地點資訊
- 位置: ${site.mrt_station} ${site.zone_label}
- 綜合分數: ${site.optimal_score?.toFixed(1) || 'N/A'} / 100
- 人流: ${site.flow_accessibility?.toLocaleString() || 'N/A'} 人次/日
- 競爭: ${site.total_competitors || 0} 家

## 創業條件
- 💰 預算: ${budget.toLocaleString()} 元
- ⏱️ 時程: ${timeline}

請提供完整開店計劃：

### 📅 時程規劃
**第 1 個月：前期準備**
**第 2 個月：籌備階段**
**第 3 個月：開幕準備**

### 💰 預算分配
包括租金、裝潢、設備、人事、行銷、周轉金

### ⚠️ 風險管理
主要風險點和應對策略

請提供具體、可執行的建議。
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  } catch (error) {
    console.error('[AI Action Plan] 錯誤:', error);
    throw error;
  }
}

export default {
  generateExplaination,
  compareLocations,
  generateActionPlan,
};