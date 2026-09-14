/**
 * 進金生能源 6692 ｜ 4.6 運維管理 ｜ 太陽光電異常告警與資深維運顧問平台
 * 遵循 taoyuan-aidc-platform 架構與 System Prompt v1.1 資深維運顧問方法論
 */

(function () {
  'use strict';

  // 14 頁投影片清單
  const slideList = [
    { id: 'home', label: '封面總覽', part: 'home' },
    { id: 'p1-1', label: 'Part 1 顧問前置審查 1.1', part: 'p1' },
    { id: 'p1-2', label: 'Part 1 目標統計 1.2', part: 'p1' },
    { id: 'p1-3', label: 'Part 1 目標統計 1.3', part: 'p1' },
    { id: 'p2-1', label: 'Part 2 結構性推論 2.1', part: 'p2' },
    { id: 'p2-2', label: 'Part 2 雙軌風險分級 2.2', part: 'p2' },
    { id: 'p2-3', label: 'Part 2 現場側根因研判 2.3', part: 'p2' },
    { id: 'p3-1', label: 'Part 3 維運行動建議 3.1', part: 'p3' },
    { id: 'p3-2', label: 'Part 3 待補資料阻擋項 3.2', part: 'p3' },
    { id: 'p4-1', label: 'Part 4 AI 顧問 Markdown 報告 4.1', part: 'p4' },
    { id: 'p4-2', label: 'Part 4 AI 顧問系統 JSON 4.2', part: 'p4' },
    { id: 'p4-3', label: 'Part 4 附錄歷史快照調閱 4.3', part: 'p4' },
    { id: 'p5-1', label: 'Part 5 雲端排程 5.1', part: 'p5' },
    { id: 'p5-2', label: 'Part 5 本機維運 5.2', part: 'p5' }
  ];

  let currentSlideIndex = 0;
  let allAlarmsData = null;
  let aiConsultantJson = null;
  let aiConsultantReport = "";
  let viewingSnapshotData = null;

  // 即時清冊篩選與分頁狀態
  let filteredAlarms = [];
  let currentPage = 1;
  const pageSize = 15;
  let activeFilters = { search: '', county: 'all', alarmType: 'all', maintainer: 'all', statusPill: 'all' };

  // ECharts 實例物件
  const charts = {};

  // 初始化入口
  document.addEventListener('DOMContentLoaded', () => {
    initDeckNavigation();
    initCountdownTimer();
    loadAllData();
  });

  // ==================== 1. 簡報導航與鍵盤事件 ====================
  function initDeckNavigation() {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    const btnPrev = document.getElementById('btnPrevSlide');
    const btnNext = document.getElementById('btnNextSlide');
    if (btnPrev) btnPrev.addEventListener('click', () => changeSlide(currentSlideIndex - 1));
    if (btnNext) btnNext.addEventListener('click', () => changeSlide(currentSlideIndex + 1));

    document.addEventListener('keydown', (e) => {
      // 若在輸入框內打字則忽略快捷鍵
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        changeSlide(currentSlideIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        changeSlide(currentSlideIndex - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        changeSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        changeSlide(slideList.length - 1);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullScreen();
      }
    });
  }

  function handleHashChange() {
    const hash = (location.hash || '#home').replace('#', '');
    const foundIndex = slideList.findIndex(s => s.id === hash);
    if (foundIndex !== -1) {
      currentSlideIndex = foundIndex;
    } else {
      currentSlideIndex = 0;
    }
    renderActiveSlide();
  }

  function changeSlide(newIndex) {
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= slideList.length) newIndex = slideList.length - 1;
    location.hash = '#' + slideList[newIndex].id;
  }

  function renderActiveSlide() {
    const activeItem = slideList[currentSlideIndex];

    // 切換 slide 元素 active 類別
    slideList.forEach((item) => {
      const el = document.getElementById('view-' + item.id);
      if (el) el.classList.toggle('active', item.id === activeItem.id);
    });

    // 頂部導航 tab active 切換
    document.querySelectorAll('.topnav a, .nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-nav') === activeItem.part);
    });

    // 底部指標列更新
    const indicator = document.getElementById('slideIndicator');
    if (indicator) {
      indicator.textContent = `${activeItem.label} ｜ ${currentSlideIndex + 1} / ${slideList.length} 頁`;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    // 重繪 ECharts
    setTimeout(() => {
      Object.keys(charts).forEach(k => {
        if (charts[k]) charts[k].resize();
      });
    }, 100);
  }

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  // ==================== 2. 定時同步倒數計時器 ====================
  function initCountdownTimer() {
    const timerEl = document.getElementById('syncCountdownText');
    if (!timerEl) return;

    function update() {
      const now = new Date();
      // 轉為台北時間 UTC+8
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const taipeiNow = new Date(utc + (3600000 * 8));

      const hour = taipeiNow.getHours();
      const min = taipeiNow.getMinutes();
      const sec = taipeiNow.getSeconds();

      let targetHour = 7;
      let targetDesc = "07:00";

      if (hour >= 7 && hour < 17) {
        targetHour = hour + 1;
        targetDesc = `${targetHour < 10 ? '0' : ''}${targetHour}:00`;
      } else if (hour >= 17) {
        targetDesc = "明日 07:00";
      }

      // 計算距下個整點剩餘分秒
      const remMin = 59 - min;
      const remSec = 59 - sec;

      if (hour >= 7 && hour < 17) {
        timerEl.textContent = `每日 07:00~17:00 整點更新（下次預計 ${targetDesc} 自動同步，倒數 ${remMin}分${remSec < 10 ? '0' : ''}${remSec}秒）`;
      } else {
        timerEl.textContent = `每日 07:00~17:00 整點更新（夜間休眠中，下次預計 ${targetDesc} 自動同步）`;
      }
    }

    update();
    setInterval(update, 1000);
  }

  // ==================== 3. 數據載入與初始化 ====================
  function loadAllData() {
    if (window.LATEST_ALARM_DATA) {
      allAlarmsData = window.LATEST_ALARM_DATA;
      aiConsultantJson = window.AI_AGENT_CONSULTANT_JSON || null;
      aiConsultantReport = window.AI_AGENT_CONSULTANT_REPORT || "";
      initDataBindings();
    } else {
      fetch('data/latest.json')
        .then(res => res.json())
        .then(data => {
          allAlarmsData = data;
          initDataBindings();
        })
        .catch(err => {
          console.error("載入告警數據失敗:", err);
        });

      fetch('data/ai_agent_consultant_data.json')
        .then(res => res.json())
        .then(data => {
          aiConsultantJson = data;
          renderAiJsonBox();
        })
        .catch(() => {});

      fetch('data/ai_agent_consultant_report.md')
        .then(res => res.text())
        .then(md => {
          aiConsultantReport = md;
          renderAiReport();
        })
        .catch(() => {});
    }
  }

  function initDataBindings() {
    if (!allAlarmsData) return;

    // 1. 全域標籤替換
    const meta = allAlarmsData.metadata;
    document.querySelectorAll('.val-sites-count').forEach(el => el.textContent = meta.totalSitesWithAlarms);
    document.querySelectorAll('.val-distinct-issues').forEach(el => el.textContent = meta.totalDistinctIssues);
    document.querySelectorAll('.val-raw-events').forEach(el => el.textContent = Number(meta.totalRawAlarms).toLocaleString());
    document.querySelectorAll('.val-updated-time').forEach(el => el.textContent = meta.updatedAt);

    // 2. 初始化 ECharts 圖表 (Slide 1.2, 1.3)
    initECharts();

    // 3. 渲染 Slide 1.2 表格：異常屬性分布
    populateTypeTable();

    // 4. 渲染 Slide 1.3 表格：前十大高風險案場
    populateTopSitesTable();

    // 5. 渲染 Slide 4.1：AI 顧問 Markdown 報告
    renderAiReport();

    // 6. 渲染 Slide 4.2：AI 顧問系統 JSON
    renderAiJsonBox();

    // 7. 渲染 Slide 4.3：快照調閱器與 499 筆清冊檢索
    initSnapshotSection();
  }

  // ==================== 4. ECharts 圖表繪製 ====================
  function initECharts() {
    if (!window.echarts || !allAlarmsData) return;

    const types = allAlarmsData.statistics.typeDistribution || [];
    const sites = allAlarmsData.statistics.siteRankings || [];

    // Chart 1.2A: 異常屬性分布甜甜圈圖
    const chartTypeEl = document.getElementById('chartTypeDistSlide');
    if (chartTypeEl) {
      charts.typeDist = echarts.init(chartTypeEl);
      const pieData = types.map(t => ({ name: t.type, value: t.count }));
      charts.typeDist.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{b}: <b>{c} 筆</b> ({d}%)'
        },
        legend: {
          orient: 'vertical',
          right: '5%',
          top: 'center',
          textStyle: { color: '#12293D', fontSize: 12 }
        },
        color: ['#1BB1BF', '#D95F45', '#E09A2B', '#1968AD', '#2E7D32'],
        series: [
          {
            name: '異常屬性',
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 13, fontWeight: 'bold' }
            },
            data: pieData
          }
        ]
      });
    }

    // Chart 1.2B: 嚴重度等級柱狀圖
    const chartSevEl = document.getElementById('chartSeveritySlide');
    if (chartSevEl) {
      charts.severity = echarts.init(chartSevEl);
      charts.severity.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '8%', right: '8%', bottom: '12%', top: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: ['緊急高階 (Red)', '重要次階 (Orange)'],
          axisLabel: { color: '#12293D', fontWeight: 'bold' }
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { stroke: '#E8F1F9' } }
        },
        series: [
          {
            name: '事件筆數',
            type: 'bar',
            barWidth: '38%',
            data: [
              { value: 187, itemStyle: { color: '#D95F45', borderRadius: [4, 4, 0, 0] } },
              { value: 312, itemStyle: { color: '#E09A2B', borderRadius: [4, 4, 0, 0] } }
            ],
            label: {
              show: true,
              position: 'top',
              fontWeight: 'bold',
              fontSize: 13,
              color: '#12293D'
            }
          }
        ]
      });
    }

    // Chart 1.3: 前十大案場水平長條圖
    const chartSitesEl = document.getElementById('chartTopSitesSlide');
    if (chartSitesEl) {
      charts.topSites = echarts.init(chartSitesEl);
      const top10 = sites.slice(0, 10).reverse();
      charts.topSites.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const item = top10[params[0].dataIndex];
            return `<b>${item.factoryName}</b> (${item.county})<br>責任工程師: ${item.maintainer}<br>獨立異常: <b>${item.distinctIssuesCount} 項</b><br>波及設備: ${item.devicesList.slice(0,3).join(', ')}`;
          }
        },
        grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
        xAxis: {
          type: 'value',
          boundaryGap: [0, 0.05],
          splitLine: { lineStyle: { stroke: '#E8F1F9' } }
        },
        yAxis: {
          type: 'category',
          data: top10.map(s => s.factoryName),
          axisLabel: { color: '#12293D', fontWeight: 'bold', fontSize: 12 }
        },
        series: [
          {
            name: '獨立異常項目',
            type: 'bar',
            barWidth: '55%',
            data: top10.map(s => s.distinctIssuesCount),
            itemStyle: {
              color: (p) => p.dataIndex >= top10.length - 2 ? '#D95F45' : (p.dataIndex >= top10.length - 5 ? '#E09A2B' : '#1968AD'),
              borderRadius: [0, 4, 4, 0]
            },
            label: {
              show: true,
              position: 'right',
              formatter: '{c} 項',
              fontWeight: 'bold',
              color: '#12293D'
            }
          }
        ]
      });

      charts.topSites.on('click', (params) => {
        const siteName = params.name;
        location.hash = '#p4-3';
        setTimeout(() => {
          const sInput = document.getElementById('searchInput');
          if (sInput) {
            sInput.value = siteName;
            activeFilters.search = siteName;
            applyFilters();
          }
        }, 150);
      });
    }

    window.addEventListener('resize', () => {
      Object.keys(charts).forEach(k => { if (charts[k]) charts[k].resize(); });
    });
  }

  // ==================== 5. 表格渲染 (Slide 1.2 & 1.3) ====================
  function populateTypeTable() {
    const tbody = document.getElementById('tableTypeDist');
    if (!tbody || !allAlarmsData) return;

    const types = allAlarmsData.statistics.typeDistribution || [];
    const details = {
      '發電效率不佳': { level: 'Orange', desc: '日照大於 300W/m² 且電流過低、RA% 或 PR% 偏低', action: '排查 MPPT 串列衰退、陰影遮蔭或組件髒污清洗' },
      '裝置斷訊': { level: 'Red', desc: '變流器 Inverter 與監控資料採集器通訊中斷超過 30 分鐘', action: '檢查現場 RS485 迴路、通訊接頭鬆脫或電源供應器故障' },
      '發電數據異常': { level: 'Orange', desc: '回傳功率數據突波、跳動異常或計算邏輯失準', action: '檢查電表比流器 (CT) 訊號線與資料上傳時序' },
      '系統未連線': { level: 'Red', desc: '整場 4G/固網路由器或主監控箱斷線無法取得任何回傳', action: '派工重啟路由器、確認 SIM 卡流量與現場交流輔助電源' },
      '部分通訊異常': { level: 'White', desc: '案場內少數設備中繼逾時，但主通訊線路仍維持運行', action: '比對終端電阻配置與周邊電磁干擾源' }
    };

    tbody.innerHTML = types.map((t, idx) => {
      const d = details[t.type] || { level: 'White', desc: '一般監控事件', action: '持續例行觀察' };
      const chipClass = d.level === 'Red' ? 'chip coral' : 'chip amber';
      return `
        <tr>
          <td class="ctr"><b>${idx + 1}</b></td>
          <td><b>${t.type}</b></td>
          <td class="num font-weight-bold">${t.count} 筆</td>
          <td class="num">${t.percentage}%</td>
          <td class="ctr"><span class="${chipClass}">${d.level}</span></td>
          <td>${d.desc}</td>
          <td>${d.action}</td>
        </tr>
      `;
    }).join('');
  }

  function populateTopSitesTable() {
    const tbody = document.getElementById('tableTopSites');
    if (!tbody || !allAlarmsData) return;

    const sites = (allAlarmsData.statistics.siteRankings || []).slice(0, 10);
    tbody.innerHTML = sites.map((s, idx) => {
      const chipClass = s.worstColor === 'red' ? 'chip coral' : 'chip amber';
      const devStr = s.devicesList.slice(0, 3).join(', ') + (s.devicesList.length > 3 ? ` 等 ${s.devicesList.length} 台` : '');
      const topTypes = Object.entries(s.alarmTypeCounts).map(([k, v]) => `${k}(${v})`).join('、 ');
      return `
        <tr class="${idx < 3 ? 'hl-row' : ''}">
          <td class="ctr"><b>${idx + 1}</b></td>
          <td><b style="cursor:pointer; color:var(--blue);" class="site-drilldown" data-site="${escapeHtml(s.factoryName)}">${escapeHtml(s.factoryName)}</b></td>
          <td class="ctr">${escapeHtml(s.county)}</td>
          <td class="ctr">${escapeHtml(s.maintainer)}</td>
          <td class="num font-weight-bold" style="color:var(--coral); font-size:1.05rem;">${s.distinctIssuesCount}</td>
          <td class="num">${s.totalRawAlarms}</td>
          <td><span class="chip blue">${escapeHtml(devStr)}</span></td>
          <td>${escapeHtml(topTypes)}</td>
          <td class="ctr"><span class="${chipClass}">${s.worstColor.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.site-drilldown').forEach(el => {
      el.addEventListener('click', () => {
        const s = el.getAttribute('data-site');
        location.hash = '#p4-3';
        setTimeout(() => {
          const sInput = document.getElementById('searchInput');
          if (sInput) {
            sInput.value = s;
            activeFilters.search = s;
            applyFilters();
          }
        }, 150);
      });
    });
  }

  // ==================== 6. AI 顧問 Markdown 報告渲染 (Slide 4.1) ====================
  function renderAiReport() {
    const container = document.getElementById('aiReportContainer');
    if (!container) return;

    const md = aiConsultantReport || (window.AI_AGENT_CONSULTANT_REPORT || "");
    if (!md) {
      container.innerHTML = "<p class='text-muted'>正在載入 AI Agent 維運顧問報告...</p>";
      return;
    }

    container.innerHTML = parseMarkdownToHtml(md);

    // 複製與下載按鈕
    const btnCopy = document.getElementById('btnCopyReport');
    if (btnCopy) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(md).then(() => {
          alert("已成功複製 AI Agent 資深維運顧問 Markdown 報告！");
        });
      };
    }

    const btnDownload = document.getElementById('btnDownloadReport');
    if (btnDownload) {
      btnDownload.onclick = () => {
        downloadFile(md, 'ai_agent_consultant_report.md', 'text/markdown');
      };
    }
  }

  // 簡易 Markdown 轉換為 HTML
  function parseMarkdownToHtml(md) {
    let lines = md.split('\n');
    let html = '';
    let inTable = false;
    let tableLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
        tableLines.push(line);
        continue;
      } else if (inTable) {
        html += renderMdTable(tableLines);
        tableLines = [];
        inTable = false;
      }

      if (!line) {
        continue;
      }

      // GitHub Alerts: > [!IMPORTANT], > [!WARNING]
      if (line.startsWith('> [!IMPORTANT]')) {
        html += `<div class="card my-2" style="background:#fff8e6; border-left:4px solid #e09a2b; padding:12px 16px;"><b><i class="fas fa-exclamation-circle text-warning mr-1"></i> 重要聲明：</b><br>`;
        continue;
      }
      if (line.startsWith('> [!WARNING]')) {
        html += `<div class="card my-2" style="background:#feece8; border-left:4px solid #d95f45; padding:12px 16px;"><b><i class="fas fa-exclamation-triangle text-danger mr-1"></i> 顧問警告：</b><br>`;
        continue;
      }
      if (line.startsWith('>')) {
        html += `<p style="margin:4px 0;">${formatInlineMd(line.replace(/^>\s*/, ''))}</p>`;
        if (i + 1 < lines.length && !lines[i+1].trim().startsWith('>')) {
          html += `</div>`;
        }
        continue;
      }

      if (line.startsWith('### ')) {
        html += `<h3>${formatInlineMd(line.replace('### ', ''))}</h3>`;
      } else if (line.startsWith('## ')) {
        html += `<h2>${formatInlineMd(line.replace('## ', ''))}</h2>`;
      } else if (line.startsWith('# ')) {
        html += `<h1>${formatInlineMd(line.replace('# ', ''))}</h1>`;
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        html += `<ul><li>${formatInlineMd(line.substring(2))}</li></ul>`;
      } else if (line === '---') {
        html += `<hr style="border:0; border-top:1px solid var(--line); margin:18px 0;">`;
      } else {
        html += `<p>${formatInlineMd(line)}</p>`;
      }
    }

    if (inTable) {
      html += renderMdTable(tableLines);
    }

    return html;
  }

  function renderMdTable(lines) {
    if (lines.length < 2) return '';
    let out = '<div class="table-wrap my-2"><table><thead><tr>';
    let headers = lines[0].split('|').map(s => s.trim()).filter(s => s.length > 0);
    headers.forEach(h => { out += `<th>${formatInlineMd(h)}</th>`; });
    out += '</tr></thead><tbody>';

    for (let i = 2; i < lines.length; i++) {
      let cols = lines[i].split('|').map(s => s.trim()).filter(s => s.length > 0);
      out += '<tr>';
      cols.forEach(c => { out += `<td>${formatInlineMd(c)}</td>`; });
      out += '</tr>';
    }
    out += '</tbody></table></div>';
    return out;
  }

  function formatInlineMd(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  // ==================== 7. AI 顧問系統 JSON 渲染 (Slide 4.2) ====================
  function renderAiJsonBox() {
    const box = document.getElementById('aiJsonCodeBox');
    if (!box) return;

    const jsonObj = aiConsultantJson || (window.AI_AGENT_CONSULTANT_JSON || null);
    if (!jsonObj) {
      box.textContent = "載入 JSON 資料中...";
      return;
    }

    const formatted = JSON.stringify(jsonObj, null, 2);
    box.textContent = formatted;

    const btnCopy = document.getElementById('btnCopyJson');
    if (btnCopy) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(formatted).then(() => {
          alert("已成功複製符合 System Prompt v1.1 Schema 之標準 JSON 資料！");
        });
      };
    }

    const btnDownload = document.getElementById('btnDownloadJson');
    if (btnDownload) {
      btnDownload.onclick = () => {
        downloadFile(formatted, 'ai_agent_consultant_data.json', 'application/json');
      };
    }
  }

  // ==================== 8. 快照調閱與全量 499 筆檢索 (Slide 4.3) ====================
  function initSnapshotSection() {
    const snaps = window.HISTORY_SNAPSHOTS_INDEX || [];
    const picker = document.getElementById('snapshotPickerSelect');

    if (picker) {
      picker.innerHTML = snaps.map(s => `
        <option value="${s.snapshotId}">${s.updatedAt} (${s.totalDistinctIssues} 筆異常)</option>
      `).join('');

      picker.addEventListener('change', (e) => {
        loadSnapshotDetails(e.target.value);
      });

      if (snaps.length > 0) {
        loadSnapshotDetails(snaps[0].snapshotId);
      }
    }

    // 篩選與搜尋工具列
    initFilterControls();

    // 下載 JSON / CSV
    const btnExpJson = document.getElementById('btnExportJson');
    const btnExpCsv = document.getElementById('btnExportCsv');
    if (btnExpJson) btnExpJson.addEventListener('click', exportSnapshotJson);
    if (btnExpCsv) btnExpCsv.addEventListener('click', exportSnapshotCsv);

    // 彈窗關閉按鈕
    const modalCloseX = document.getElementById('modalCloseX');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modal = document.getElementById('alarmDetailModal');
    if (modalCloseX && modal) modalCloseX.addEventListener('click', () => modal.classList.remove('show'));
    if (modalCloseBtn && modal) modalCloseBtn.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
  }

  function loadSnapshotDetails(snapId) {
    if (allAlarmsData && allAlarmsData.metadata.snapshotId === snapId) {
      viewingSnapshotData = allAlarmsData;
      renderSnapshotViewer();
      return;
    }

    fetch(`data/snapshots/${snapId}.json`)
      .then(res => res.json())
      .then(data => {
        viewingSnapshotData = data;
        renderSnapshotViewer();
      })
      .catch(err => {
        console.warn("載入快照檔案失敗，回退至最新資料:", err);
        viewingSnapshotData = allAlarmsData;
        renderSnapshotViewer();
      });
  }

  function renderSnapshotViewer() {
    if (!viewingSnapshotData) return;
    const meta = viewingSnapshotData.metadata;

    const timeEl = document.getElementById('snapViewerTime');
    const sitesEl = document.getElementById('snapViewerSites');
    const issuesEl = document.getElementById('snapViewerIssues');

    if (timeEl) timeEl.textContent = meta.updatedAt;
    if (sitesEl) sitesEl.textContent = `${meta.totalSitesWithAlarms} 案場`;
    if (issuesEl) issuesEl.textContent = `${meta.totalDistinctIssues} 項`;

    populateSelectFilters();
    renderStatusPills();
    applyFilters();
  }

  function initFilterControls() {
    const sInput = document.getElementById('searchInput');
    if (sInput) {
      sInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        currentPage = 1;
        applyFilters();
      });
    }

    const cSel = document.getElementById('filterCounty');
    if (cSel) {
      cSel.addEventListener('change', (e) => {
        activeFilters.county = e.target.value;
        currentPage = 1;
        applyFilters();
      });
    }

    const tSel = document.getElementById('filterAlarmType');
    if (tSel) {
      tSel.addEventListener('change', (e) => {
        activeFilters.alarmType = e.target.value;
        activeFilters.statusPill = e.target.value;
        renderStatusPills();
        currentPage = 1;
        applyFilters();
      });
    }

    const mSel = document.getElementById('filterMaintainer');
    if (mSel) {
      mSel.addEventListener('change', (e) => {
        activeFilters.maintainer = e.target.value;
        currentPage = 1;
        applyFilters();
      });
    }

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        activeFilters = { search: '', county: 'all', alarmType: 'all', maintainer: 'all', statusPill: 'all' };
        if (sInput) sInput.value = '';
        if (cSel) cSel.value = 'all';
        if (tSel) tSel.value = 'all';
        if (mSel) mSel.value = 'all';
        renderStatusPills();
        currentPage = 1;
        applyFilters();
      });
    }
  }

  function renderStatusPills() {
    const container = document.getElementById('statusPillsContainer');
    if (!container || !viewingSnapshotData) return;

    const meta = viewingSnapshotData.metadata;
    const typeStats = viewingSnapshotData.statistics.typeDistribution || [];
    const getCount = (typeName) => {
      const found = typeStats.find(t => t.type === typeName);
      return found ? found.count : 0;
    };

    const pills = [
      { label: '所有異常', count: meta.totalDistinctIssues, filterVal: 'all', icon: 'fas fa-bell' },
      { label: '發電效率不佳', count: getCount('發電效率不佳'), filterVal: '發電效率不佳', icon: 'fas fa-chart-line' },
      { label: '裝置斷訊', count: getCount('裝置斷訊'), filterVal: '裝置斷訊', icon: 'fas fa-exclamation-triangle' },
      { label: '發電數據異常', count: getCount('發電數據異常'), filterVal: '發電數據異常', icon: 'fas fa-bolt' },
      { label: '系統未連線', count: getCount('系統未連線'), filterVal: '系統未連線', icon: 'fas fa-unlink' },
      { label: '部分通訊異常', count: getCount('部分通訊異常'), filterVal: '部分通訊異常', icon: 'fas fa-biohazard' }
    ];

    container.innerHTML = pills.map(p => `
      <button type="button" class="status_pill ${activeFilters.statusPill === p.filterVal ? 'active' : ''}" data-val="${p.filterVal}">
        <i class="${p.icon} mr-1"></i>
        <span>${p.label}</span>
        <span class="badge_num">${p.count}</span>
      </button>
    `).join('');

    container.querySelectorAll('.status_pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-val');
        activeFilters.statusPill = (activeFilters.statusPill === v && v !== 'all') ? 'all' : v;
        activeFilters.alarmType = activeFilters.statusPill === 'all' ? 'all' : activeFilters.statusPill;
        const sel = document.getElementById('filterAlarmType');
        if (sel) sel.value = activeFilters.alarmType;
        renderStatusPills();
        currentPage = 1;
        applyFilters();
      });
    });
  }

  function populateSelectFilters() {
    if (!viewingSnapshotData) return;
    const counties = viewingSnapshotData.statistics.countyDistribution || [];
    const types = viewingSnapshotData.statistics.typeDistribution || [];
    const maintainers = viewingSnapshotData.statistics.maintainerDistribution || [];

    const cSel = document.getElementById('filterCounty');
    if (cSel) {
      cSel.innerHTML = '<option value="all">區域: 全部</option>' +
        counties.map(c => `<option value="${c.county}">${c.county} (${c.count})</option>`).join('');
      cSel.value = activeFilters.county;
    }

    const tSel = document.getElementById('filterAlarmType');
    if (tSel) {
      tSel.innerHTML = '<option value="all">屬性: 全部</option>' +
        types.map(t => `<option value="${t.type}">${t.type} (${t.count})</option>`).join('');
      tSel.value = activeFilters.alarmType;
    }

    const mSel = document.getElementById('filterMaintainer');
    if (mSel) {
      mSel.innerHTML = '<option value="all">工程師: 全部</option>' +
        maintainers.map(m => `<option value="${m.maintainer}">${m.maintainer} (${m.count})</option>`).join('');
      mSel.value = activeFilters.maintainer;
    }
  }

  function applyFilters() {
    if (!viewingSnapshotData) return;
    let list = [...viewingSnapshotData.rebuildAlarms];

    if (activeFilters.search.trim()) {
      const q = activeFilters.search.trim().toLowerCase();
      list = list.filter(item =>
        item.factoryName.toLowerCase().includes(q) ||
        item.which.toLowerCase().includes(q) ||
        item.county.toLowerCase().includes(q) ||
        item.maintainer.toLowerCase().includes(q) ||
        item.lastAlarmType.toLowerCase().includes(q)
      );
    }

    if (activeFilters.county !== 'all') {
      list = list.filter(item => item.county === activeFilters.county);
    }

    if (activeFilters.alarmType !== 'all') {
      list = list.filter(item => item.lastAlarmType === activeFilters.alarmType);
    }

    if (activeFilters.maintainer !== 'all') {
      list = list.filter(item => item.maintainer === activeFilters.maintainer);
    }

    filteredAlarms = list;
    renderAlarmsTable();
  }

  function renderAlarmsTable() {
    const tbody = document.getElementById('tableSnapshotDetailBody');
    if (!tbody) return;

    if (filteredAlarms.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">無符合條件之告警項目</td></tr>`;
      renderPagination(0);
      return;
    }

    const start = (currentPage - 1) * pageSize;
    const pageItems = filteredAlarms.slice(start, start + pageSize);

    tbody.innerHTML = pageItems.map((item, idx) => {
      const chipClass = item.lastColorLabel === 'red' ? 'chip coral' : 'chip amber';
      return `
        <tr>
          <td class="ctr">${start + idx + 1}</td>
          <td><b>${escapeHtml(item.factoryName)}</b></td>
          <td class="ctr">${escapeHtml(item.county)}</td>
          <td class="ctr">${escapeHtml(item.maintainer)}</td>
          <td class="ctr"><code>${escapeHtml(item.which)}</code></td>
          <td>${escapeHtml(item.lastAlarmType)}</td>
          <td class="ctr font-mono">${escapeHtml(item.time)}</td>
          <td class="ctr"><span class="${chipClass}">${escapeHtml(item.impact)}</span></td>
          <td class="ctr">
            <button class="btn-detail py-0 btn-show-detail" data-idx="${start + idx}">明細 ...</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-show-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        showAlarmModal(filteredAlarms[idx]);
      });
    });

    renderPagination(filteredAlarms.length);
  }

  function renderPagination(total) {
    const wrap = document.getElementById('tablePagination');
    if (!wrap) return;

    const totalPages = Math.ceil(total / pageSize) || 1;
    wrap.innerHTML = `
      <span class="text-muted" style="font-size:.85rem;">顯示第 ${(currentPage - 1) * pageSize + 1} 至 ${Math.min(currentPage * pageSize, total)} 筆，共 ${total} 筆資料</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="deck-btn" id="pPrev" ${currentPage <= 1 ? 'disabled' : ''} style="width:auto; padding:4px 10px; font-size:.82rem;">上一頁</button>
        <span class="font-weight-bold mx-1" style="font-size:.85rem;">${currentPage} / ${totalPages}</span>
        <button class="deck-btn" id="pNext" ${currentPage >= totalPages ? 'disabled' : ''} style="width:auto; padding:4px 10px; font-size:.82rem;">下一頁</button>
      </div>
    `;

    const prev = document.getElementById('pPrev');
    const next = document.getElementById('pNext');
    if (prev) {
      prev.onclick = () => {
        if (currentPage > 1) {
          currentPage--;
          renderAlarmsTable();
        }
      };
    }
    if (next) {
      next.onclick = () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderAlarmsTable();
        }
      };
    }
  }

  function showAlarmModal(item) {
    if (!item) return;
    const modal = document.getElementById('alarmDetailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBodyContent');
    if (!modal || !title || !body) return;

    title.textContent = `${item.factoryName} - 告警明細清單 (${item.allAlarms.length} 筆)`;
    body.innerHTML = `
      <div style="background:var(--blue-soft); padding:10px 14px; border-radius:4px; margin-bottom:14px; font-size:.84rem; display:flex; flex-wrap:wrap; gap:16px;">
        <span><b>縣市：</b>${escapeHtml(item.county)}</span>
        <span><b>維運工程師：</b>${escapeHtml(item.maintainer)}</span>
        <span><b>設備：</b>${escapeHtml(item.which)}</span>
        <span><b>最近記錄：</b>${escapeHtml(item.time)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:100px;">設備</th>
              <th style="width:130px;">屬性</th>
              <th style="width:160px;">發生時間</th>
              <th>原廠告警內容描述</th>
            </tr>
          </thead>
          <tbody>
            ${item.allAlarms.map(a => `
              <tr>
                <td><b>${escapeHtml(item.which)}</b></td>
                <td><span class="${a.colorLabel === 'red' ? 'chip coral' : 'chip amber'}">${escapeHtml(a.alarmType)}</span></td>
                <td class="font-mono">${escapeHtml(a.timestamp.replace('T', ' ').substring(0, 19))}</td>
                <td>${escapeHtml(a.desc || a.errMsg || '--')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    modal.classList.add('show');
  }

  function exportSnapshotJson() {
    if (!viewingSnapshotData) return;
    const jsonStr = JSON.stringify(viewingSnapshotData, null, 2);
    downloadFile(jsonStr, `alarm_snapshot_${viewingSnapshotData.metadata.snapshotId}.json`, 'application/json');
  }

  function exportSnapshotCsv() {
    if (!viewingSnapshotData) return;
    const alarms = viewingSnapshotData.rebuildAlarms || [];
    let csv = '\uFEFF案場名稱,縣市,責任工程師,設備,異常屬性,記錄時間,衝擊數值,原始事件次數\n';
    alarms.forEach(a => {
      csv += `"${a.factoryName}","${a.county}","${a.maintainer}","${a.which}","${a.lastAlarmType}","${a.time}",${a.impact},${a.allAlarms.length}\n`;
    });
    downloadFile(csv, `alarm_snapshot_${viewingSnapshotData.metadata.snapshotId}.csv`, 'text/csv;charset=utf-8;');
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
