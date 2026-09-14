# 進金生能源 6692｜雲端監控中心・太陽光電異常告警平台 (4.6 運維管理)

> 🚀 **GitHub Pages 線上即時平台**：[https://davidyeh51.github.io/acmepoint-alarm-platform/](https://davidyeh51.github.io/acmepoint-alarm-platform/)  
> 📑 **附錄・歷史追蹤備存庫**：[https://davidyeh51.github.io/acmepoint-alarm-platform/appendix.html](https://davidyeh51.github.io/acmepoint-alarm-platform/appendix.html)

本平台為**進金生能源服務股份有限公司（4.6 運維管理）**專屬建置之太陽光電「異常告警與維運決策戰情中心」。介面風格完全照抄並無縫融入原廠雲端監控中心（`https://om.acmepointes.com/tw/realtime`），提供全台 86+ 太陽能電廠之即時異常診斷、目標統計分析與自動化歷史快照備存。

---

## 🎯 核心功能與目標統計

### 一、目標統計 (1)：異常情況分布 (Distribution of Anomaly Types)
- **多維度分類統計**：即時掌握全網異常屬性分布：
  - `系統未連線` (Offline / Comm Disconnected)
  - `系統短暫斷線` (Temporary Offline)
  - `發電數據異常` (Power Generation Data Error)
  - `裝置斷訊` (Device Communication Failure)
  - `部分通訊異常` (Partial Communication Error)
  - `發電效率不佳` (Low Inverter Efficiency / PR Anomaly)
- **視覺化呈現**：
  - 頂部即時狀態膠囊（即時對齊 `realtime` 原廠風格，具備動態計數與點擊聯動篩選功能）。
  - 互動式甜甜圈圓環圖（Donut Chart），懸停顯示佔比與筆數，點選圓環區塊可直接穿透過濾下方告警清冊。

### 二、目標統計 (2)：同一案場有多少異常 (Anomalies per Site Ranking)
- **案場異常穿透彙整**：精準計算同一案場之「獨立異常問題數」、「累計原始告警事件數」及「受波及變流器 (Inverter) 清單」。
- **前十大異常案場排行榜**：水平漸層長條圖排序，可即時鎖定高風險電廠，點擊長條即可快速查看該案場所有異常歷史。

### 三、定時自動同步 (Daily 07:00 ~ 17:00 每整點更新)
- **GitHub Actions 自動排程**（Cron: `0 23,0,1,2,3,4,5,6,7,8,9 * * *`）：
  - 每日台灣時間（UTC+8）**07:00、08:00、09:00、10:00、11:00、12:00、13:00、14:00、15:00、16:00、17:00** 準時自動執行。
  - 自動透過 API 介接 ACMEPOINT 系統並抓取 `https://om.acmepointes.com/tw/historyalarms` 數據。
  - 重算兩大目標統計指標、儲存時間戳快照（Snapshot）、更新全域索引與離線腳本，自動 Commit、Push 並重啟 GitHub Pages 部署。
- **本機同步支援**：提供 `run_local_sync.bat`，於本機雙擊即可手動一鍵更新。

### 四、附錄追蹤備存庫 (`appendix.html`)
- **歷史整點快照備存**：每一次抓取之時間戳完整保存於 `data/snapshots/YYYY-MM-DD_HH-00.json`。
- **歷時演變趨勢圖**：當日各整點之異常數量變化曲線（總異常數、緊急等級 Red、重要等級 Orange）。
- **快照調閱器 (Snapshot Picker)**：可任意選擇歷史任一整點快照，還原當時各案場異常狀態。
- **資料匯出**：支援將當前快照一鍵下載為完整 JSON 或匯出為 Excel/CSV 清冊。

### 五、原廠視覺 100% 照抄還原
- 完全採用 ACMEPOINT 雲端監控中心官方標準色彩、字型與元件規範：
  - 頂部導航：Logo、系統標題、導覽膠囊按鈕、主題切換、用戶識別 (`David Yeh`)。
  - 左側功能列：經典青藍色系（`#aadaff` / `#1976d2`）展開收合側邊欄。
  - 狀態卡片與表格：案場、縣市、工程師、設備、屬性、開始時間、影響等級顏色塊（Red `#ff8b8e`、Orange `#ffb74d`、White `#ffffff`）與彈窗詳細清冊。

---

## 📁 專案目錄結構

```
異常告警平台/
├── .github/
│   └── workflows/
│       └── hourly_sync.yml        # 每天 07:00~17:00 整點自動抓取與 GitHub Pages 佈署
├── assets/
│   ├── css/
│   │   ├── app.css                # 原廠核心樣式
│   │   ├── chunk-vendors.css      # Bootstrap & UI 基礎樣式
│   │   └── custom.css             # 現代化儀表板與圖表樣式
│   ├── img/
│   │   └── acme-logo.png          # 原廠官方高解析 Logo
│   └── js/
│       ├── app.js                 # 前端互動邏輯（圖表、篩選、排序、彈窗、倒數）
│       └── echarts.min.js         # 視覺化圖表引擎
├── data/
│   ├── latest.json                # 最新整點告警數據與統計指標
│   ├── index.json                 # 所有歷史快照目錄清冊
│   ├── data.js                    # 靜態無伺服器直接執行離線腳本
│   └── snapshots/                 # 各整點時間戳快照備存檔
│       └── 2026-09-14_17-00.json
├── index.html                     # 主戰情中心：即時異常告警平台
├── appendix.html                  # 附錄頁面：歷史快照備存與趨勢追蹤
├── fetch_alarms.py                # 核心資料抓取與統計計算引擎
├── run_local_sync.bat             # 本機一鍵手動更新批次檔
└── README.md                      # 平台專案說明文件
```

---

## 🚀 快速開始與本地運行

1. **直接檢視網頁**：
   - 雙擊開啟 `index.html` 或 `appendix.html` 即可直接在瀏覽器操作完整功能。
2. **手動更新資料**：
   - 雙擊執行 `run_local_sync.bat`，系統將自動連線並更新 `data/` 下的所有檔案。
3. **雲端自動更新**：
   - 程式碼已推播至 GitHub，GitHub Actions 將於每日 07:00~17:00 自動觸發更新並即時發布至 GitHub Pages。
