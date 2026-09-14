/**
 * 進金生能源 6692｜異常告警平台
 * 前端互動核心邏輯：資料加載、統計圖表渲染、多維度篩選排序、歷史快照切換
 */

(function () {
  let allAlarmsData = null;
  let filteredAlarms = [];
  let currentPage = 1;
  const pageSize = 25;

  let currentSort = {
    column: 'lastAlarmType',
    ascending: true
  };

  let activeFilters = {
    search: '',
    county: 'all',
    alarmType: 'all',
    maintainer: 'all',
    statusPill: 'all',
    site: 'all'
  };

  let chartTypeDist = null;
  let chartSiteRank = null;

  // 初始化入口
  window.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadAlarmData();
    initEventListeners();
    updateNextSyncTimer();
    setInterval(updateNextSyncTimer, 1000);
  });

  // 側邊欄展開收合
  function initSidebar() {
    const expandBtn = document.querySelector('.btn_sidebar_expand');
    const sidebar = document.querySelector('.sidebar');
    if (expandBtn && sidebar) {
      expandBtn.addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
        const textSpans = sidebar.querySelectorAll('.sidebar_text');
        textSpans.forEach(span => {
          span.style.display = sidebar.classList.contains('expanded') ? 'inline-block' : 'none';
        });
        setTimeout(() => {
          if (chartTypeDist) chartTypeDist.resize();
          if (chartSiteRank) chartSiteRank.resize();
        }, 300);
      });
    }
  }

  // 加載資料 (優先讀取 window.LATEST_ALARM_DATA，否則非同步抓取 data/latest.json)
  function loadAlarmData() {
    if (window.LATEST_ALARM_DATA) {
      allAlarmsData = window.LATEST_ALARM_DATA;
      renderDashboard();
    } else {
      fetch('data/latest.json')
        .then(res => res.json())
        .then(data => {
          allAlarmsData = data;
          renderDashboard();
        })
        .catch(err => {
          console.error("載入告警數據失敗:", err);
          document.getElementById('tableBody').innerHTML = `
            <tr><td colspan="8" class="text-danger p-4">無法載入最新告警資料，請確認 data/latest.json 是否存在。</td></tr>
          `;
        });
    }
  }

  // 渲染儀表板
  function renderDashboard() {
    if (!allAlarmsData) return;

    // 1. 更新最後更新時間
    const updatedEl = document.getElementById('lastUpdatedTime');
    if (updatedEl) {
      updatedEl.textContent = allAlarmsData.metadata.updatedAt || '--';
    }

    // 2. 渲染頂部狀態膠囊卡片
    renderStatusPills();

    // 3. 填充下拉選單選項
    populateDropdownFilters();

    // 4. 初始化並渲染兩大核心圖表 (異常情況分布 & 同一案場異常數量統計)
    initCharts();

    // 5. 執行篩選與表格渲染
    applyFilters();
  }

  // 渲染頂部狀態膠囊
  function renderStatusPills() {
    const meta = allAlarmsData.metadata;
    const typeStats = allAlarmsData.statistics.typeDistribution || [];

    const getCount = (typeName) => {
      const found = typeStats.find(t => t.type === typeName);
      return found ? found.count : 0;
    };

    const pillConfig = [
      { id: 'pill_all', label: '所有異常', count: meta.totalDistinctIssues, icon: 'fas fa-bell', filterVal: 'all', cssClass: '' },
      { id: 'pill_offline', label: '系統未連線', count: getCount('系統未連線'), icon: 'fas fa-unlink', filterVal: '系統未連線', cssClass: 'pill_error' },
      { id: 'pill_short_offline', label: '系統短暫斷線', count: getCount('系統短暫斷線'), icon: 'fas fa-hourglass-half', filterVal: '系統短暫斷線', cssClass: 'pill_warning' },
      { id: 'pill_data_err', label: '發電數據異常', count: getCount('發電數據異常'), icon: 'fas fa-bolt', filterVal: '發電數據異常', cssClass: 'pill_warning' },
      { id: 'pill_device_comm', label: '裝置斷訊', count: getCount('裝置斷訊'), icon: 'fas fa-exclamation-triangle', filterVal: '裝置斷訊', cssClass: 'pill_error' },
      { id: 'pill_comm_err', label: '部分通訊異常', count: getCount('部分通訊異常'), icon: 'fas fa-biohazard', filterVal: '部分通訊異常', cssClass: 'pill_warning' },
      { id: 'pill_eff_low', label: '發電效率不佳', count: getCount('發電效率不佳'), icon: 'fas fa-chart-line', filterVal: '發電效率不佳', cssClass: 'pill_info' }
    ];

    const container = document.getElementById('statusPillsContainer');
    if (!container) return;

    container.innerHTML = pillConfig.map(p => `
      <div class="status_pill ${p.cssClass} ${activeFilters.statusPill === p.filterVal ? 'active' : ''}" data-filter="${p.filterVal}">
        <i class="${p.icon} mr-1"></i>
        <span>${p.label}</span>
        <span class="badge_num">${p.count}</span>
      </div>
    `).join('');

    container.querySelectorAll('.status_pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.getAttribute('data-filter');
        activeFilters.statusPill = (activeFilters.statusPill === val && val !== 'all') ? 'all' : val;
        activeFilters.alarmType = activeFilters.statusPill === 'all' ? 'all' : activeFilters.statusPill;
        
        // 同步下拉選單
        const selectAlarmType = document.getElementById('filterAlarmType');
        if (selectAlarmType) selectAlarmType.value = activeFilters.alarmType;

        renderStatusPills();
        applyFilters();
      });
    });
  }

  // 填充下拉選單
  function populateDropdownFilters() {
    const countySelect = document.getElementById('filterCounty');
    const typeSelect = document.getElementById('filterAlarmType');
    const maintainerSelect = document.getElementById('filterMaintainer');

    if (countySelect) {
      const counties = allAlarmsData.statistics.countyDistribution || [];
      countySelect.innerHTML = `<option value="all">依區域篩選: 全部</option>` +
        counties.map(c => `<option value="${c.county}">${c.county} (${c.count})</option>`).join('');
    }

    if (typeSelect) {
      const types = allAlarmsData.statistics.typeDistribution || [];
      typeSelect.innerHTML = `<option value="all">依屬性篩選: 全部</option>` +
        types.map(t => `<option value="${t.type}">${t.type} (${t.count})</option>`).join('');
    }

    if (maintainerSelect) {
      const maintainers = allAlarmsData.statistics.maintainerDistribution || [];
      maintainerSelect.innerHTML = `<option value="all">依工程師篩選: 全部</option>` +
        maintainers.map(m => `<option value="${m.maintainer}">${m.maintainer} (${m.count})</option>`).join('');
    }
  }

  // 初始化與渲染圖表
  function initCharts() {
    const chartTypeEl = document.getElementById('chartTypeDistribution');
    const chartSiteEl = document.getElementById('chartSiteRanking');

    if (chartTypeEl && window.echarts) {
      if (!chartTypeDist) chartTypeDist = echarts.init(chartTypeEl);
      const types = allAlarmsData.statistics.typeDistribution || [];

      const colorPalette = {
        '系統未連線': '#dc3545',
        '系統短暫斷線': '#fd7e14',
        '發電數據異常': '#ffc107',
        '裝置斷訊': '#e83e8c',
        '部分通訊異常': '#6f42c1',
        '發電效率不佳': '#17a2b8'
      };

      const optionType = {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: <b>{c} 筆</b> ({d}%)'
        },
        legend: {
          orient: 'vertical',
          right: '5%',
          top: 'center',
          textStyle: { fontSize: 12 }
        },
        series: [
          {
            name: '異常情況分布',
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 16,
                fontWeight: 'bold',
                formatter: '{b}\n{d}%'
              }
            },
            data: types.map(t => ({
              value: t.count,
              name: t.type,
              itemStyle: { color: colorPalette[t.type] || '#4885c1' }
            }))
          }
        ]
      };
      chartTypeDist.setOption(optionType);

      chartTypeDist.off('click');
      chartTypeDist.on('click', (params) => {
        activeFilters.alarmType = params.name;
        activeFilters.statusPill = params.name;
        const sel = document.getElementById('filterAlarmType');
        if (sel) sel.value = params.name;
        renderStatusPills();
        applyFilters();
      });
    }

    if (chartSiteEl && window.echarts) {
      if (!chartSiteRank) chartSiteRank = echarts.init(chartSiteEl);
      const sites = (allAlarmsData.statistics.siteRankings || []).slice(0, 10).reverse();

      const optionSite = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: function (params) {
            const item = params[0];
            const siteData = allAlarmsData.statistics.siteRankings.find(s => s.factoryName === item.name);
            return `
              <b>${item.name}</b><br/>
              縣市: ${siteData ? siteData.county : '--'}<br/>
              維運工程師: ${siteData ? siteData.maintainer : '--'}<br/>
              獨立異常數: <b>${item.value} 項</b><br/>
              累計事件次數: <b>${siteData ? siteData.totalRawAlarms : '--'} 次</b>
            `;
          }
        },
        grid: {
          left: '3%',
          right: '8%',
          bottom: '3%',
          top: '4%',
          containLabel: true
        },
        xAxis: {
          type: 'value',
          boundaryGap: [0, 0.05],
          splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
        },
        yAxis: {
          type: 'category',
          data: sites.map(s => s.factoryName),
          axisLabel: {
            formatter: function (value) {
              return value.length > 8 ? value.substring(0, 7) + '...' : value;
            }
          }
        },
        series: [
          {
            name: '異常數量',
            type: 'bar',
            data: sites.map(s => s.distinctIssuesCount),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color: '#1976d2' },
                { offset: 1, color: '#64b5f6' }
              ]),
              borderRadius: [0, 4, 4, 0]
            },
            label: {
              show: true,
              position: 'right',
              valueAnimation: true,
              fontWeight: 'bold',
              color: '#1976d2'
            }
          }
        ]
      };
      chartSiteRank.setOption(optionSite);

      chartSiteRank.off('click');
      chartSiteRank.on('click', (params) => {
        activeFilters.site = params.name;
        activeFilters.search = params.name;
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = params.name;
        applyFilters();
      });
    }

    window.addEventListener('resize', () => {
      if (chartTypeDist) chartTypeDist.resize();
      if (chartSiteRank) chartSiteRank.resize();
    });
  }

  // 篩選與排序邏輯
  function applyFilters() {
    if (!allAlarmsData) return;

    let list = [...allAlarmsData.rebuildAlarms];

    // 1. 搜尋字串篩選
    if (activeFilters.search.trim()) {
      const q = activeFilters.search.trim().toLowerCase();
      list = list.filter(item => 
        (item.factoryName && item.factoryName.toLowerCase().includes(q)) ||
        (item.county && item.county.toLowerCase().includes(q)) ||
        (item.maintainer && item.maintainer.toLowerCase().includes(q)) ||
        (item.which && item.which.toLowerCase().includes(q)) ||
        (item.lastAlarmType && item.lastAlarmType.toLowerCase().includes(q))
      );
    }

    // 2. 區域縣市
    if (activeFilters.county !== 'all') {
      list = list.filter(item => item.county === activeFilters.county);
    }

    // 3. 異常屬性
    if (activeFilters.alarmType !== 'all') {
      list = list.filter(item => item.lastAlarmType === activeFilters.alarmType);
    }

    // 4. 維運工程師
    if (activeFilters.maintainer !== 'all') {
      list = list.filter(item => item.maintainer === activeFilters.maintainer);
    }

    // 5. 排序
    list.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      if (currentSort.column === 'impact') {
        valA = a.impact || 0;
        valB = b.impact || 0;
      } else if (currentSort.column === 'lastAlarmType') {
        const priority = {
          "系統未連線": 1,
          "系統短暫斷線": 2,
          "發電數據異常": 3,
          "裝置斷訊": 4,
          "部分通訊異常": 5,
          "發電效率不佳": 6
        };
        valA = priority[valA] || 7;
        valB = priority[valB] || 7;
      }

      if (valA < valB) return currentSort.ascending ? -1 : 1;
      if (valA > valB) return currentSort.ascending ? 1 : -1;
      return 0;
    });

    filteredAlarms = list;
    currentPage = 1;
    renderTable();
  }

  // 渲染表格
  function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const countBadge = document.getElementById('dataCountBadge');
    if (!tableBody) return;

    if (countBadge) {
      countBadge.textContent = filteredAlarms.length;
    }

    if (filteredAlarms.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="8" class="text-muted p-4">查無符合條件的異常紀錄</td></tr>
      `;
      renderPagination(0);
      return;
    }

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = filteredAlarms.slice(startIdx, startIdx + pageSize);

    tableBody.innerHTML = pageItems.map((item, idx) => {
      let colorClass = 'bg_level_white';
      if (item.lastColorLabel === 'red') colorClass = 'bg_level_red';
      else if (item.lastColorLabel === 'orange') colorClass = 'bg_level_orange';

      return `
        <tr>
          <td>
            <span class="clickable_site" data-site="${escapeHtml(item.factoryName)}">
              <i class="fas fa-globe-americas mr-1" style="color:#4294cf"></i>${escapeHtml(item.factoryName)}
            </span>
          </td>
          <td>${escapeHtml(item.county)}</td>
          <td>${escapeHtml(item.maintainer)}</td>
          <td><b>${escapeHtml(item.which)}</b></td>
          <td>${escapeHtml(item.lastAlarmType)}</td>
          <td>${escapeHtml(item.time)}</td>
          <td>
            <span class="impact_badge ${colorClass}">
              ${item.impact}
            </span>
          </td>
          <td>
            <button class="btn_detail" data-idx="${startIdx + idx}">詳細 ...</button>
          </td>
        </tr>
      `;
    }).join('');

    // 綁定點擊案場事件
    tableBody.querySelectorAll('.clickable_site').forEach(span => {
      span.addEventListener('click', () => {
        const site = span.getAttribute('data-site');
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = site;
        activeFilters.search = site;
        applyFilters();
      });
    });

    // 綁定點擊詳細彈窗按鈕
    tableBody.querySelectorAll('.btn_detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        showAlarmDetailModal(filteredAlarms[idx]);
      });
    });

    renderPagination(filteredAlarms.length);
  }

  // 渲染分頁器
  function renderPagination(totalItems) {
    const paginationWrap = document.getElementById('paginationWrap');
    if (!paginationWrap) return;

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    let html = `
      <div>顯示第 ${(currentPage - 1) * pageSize + 1} 至 ${Math.min(currentPage * pageSize, totalItems)} 筆，共 ${totalItems} 筆資料</div>
      <div>
        <button class="page_btn" id="btnPrevPage" ${currentPage <= 1 ? 'disabled' : ''}>上一頁</button>
        <span class="mx-2 font-weight-bold">${currentPage} / ${totalPages}</span>
        <button class="page_btn" id="btnNextPage" ${currentPage >= totalPages ? 'disabled' : ''}>下一頁</button>
      </div>
    `;
    paginationWrap.innerHTML = html;

    const prevBtn = document.getElementById('btnPrevPage');
    const nextBtn = document.getElementById('btnNextPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderTable();
          document.querySelector('.table_section').scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderTable();
          document.querySelector('.table_section').scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  // 顯示詳細彈窗
  function showAlarmDetailModal(item) {
    if (!item) return;

    const modal = document.getElementById('alarmDetailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBodyContent');

    if (!modal || !title || !body) return;

    title.innerHTML = `<i class="fas fa-exclamation-circle text-danger mr-2"></i> ${escapeHtml(item.factoryName)} - 告警明細清單 (${item.allAlarms.length} 筆)`;

    body.innerHTML = `
      <div class="mb-3 d-flex flex-wrap gap-3 font-weight-bold" style="background:#f8f9fa; padding:10px 14px; border-radius:4px;">
        <span class="mr-3"><i class="fas fa-map-marker-alt text-primary mr-1"></i> 縣市：${escapeHtml(item.county)}</span>
        <span class="mr-3"><i class="fas fa-user-cog text-primary mr-1"></i> 工程師：${escapeHtml(item.maintainer)}</span>
        <span class="mr-3"><i class="fas fa-microchip text-primary mr-1"></i> 受影響設備：${escapeHtml(item.which)}</span>
        <span><i class="fas fa-clock text-primary mr-1"></i> 最近發生時間：${escapeHtml(item.time)}</span>
      </div>
      <div class="table-responsive">
        <table class="table table-bordered table-sm text-center" style="font-size:12px;">
          <thead class="thead-light">
            <tr>
              <th style="width:100px;">設備 (INV)</th>
              <th style="width:120px;">屬性 (類型)</th>
              <th style="width:160px;">時間戳記</th>
              <th class="text-left">詳細內容 / 錯誤代碼</th>
            </tr>
          </thead>
          <tbody>
            ${item.allAlarms.map(a => `
              <tr>
                <td><b>${invOrNot(a.inv)}</b></td>
                <td><span class="badge ${a.colorLabel === 'red' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(a.alarmType)}</span></td>
                <td>${escapeHtml(a.timestamp ? a.timestamp.replace('T', ' ').substring(0, 19) : '--')}</td>
                <td class="text-left">${escapeHtml(a.desc || a.errMsg || '--')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.add('show');
  }

  function invOrNot(inv) {
    if (inv === null || inv === undefined) return "系統斷線";
    if (typeof inv === 'number') return `Inv${String(inv).padStart(2, '0')}`;
    return String(inv);
  }

  // 事件監聽
  function initEventListeners() {
    // 搜尋輸入
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        activeFilters.search = e.target.value;
        applyFilters();
      });
    }

    // 區域篩選
    const filterCounty = document.getElementById('filterCounty');
    if (filterCounty) {
      filterCounty.addEventListener('change', (e) => {
        activeFilters.county = e.target.value;
        applyFilters();
      });
    }

    // 屬性篩選
    const filterAlarmType = document.getElementById('filterAlarmType');
    if (filterAlarmType) {
      filterAlarmType.addEventListener('change', (e) => {
        activeFilters.alarmType = e.target.value;
        activeFilters.statusPill = e.target.value;
        renderStatusPills();
        applyFilters();
      });
    }

    // 工程師篩選
    const filterMaintainer = document.getElementById('filterMaintainer');
    if (filterMaintainer) {
      filterMaintainer.addEventListener('change', (e) => {
        activeFilters.maintainer = e.target.value;
        applyFilters();
      });
    }

    // 重新更新按鈕
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        btnRefresh.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> 更新中...`;
        setTimeout(() => {
          location.reload();
        }, 500);
      });
    }

    // 排序表頭
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (currentSort.column === col) {
          currentSort.ascending = !currentSort.ascending;
        } else {
          currentSort.column = col;
          currentSort.ascending = true;
        }
        document.querySelectorAll('th.sortable i').forEach(icon => icon.className = 'fas fa-sort text-muted');
        const icon = th.querySelector('i');
        if (icon) {
          icon.className = currentSort.ascending ? 'fas fa-sort-up text-primary' : 'fas fa-sort-down text-primary';
        }
        applyFilters();
      });
    });

    // 關閉彈窗
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCloseX = document.getElementById('modalCloseX');
    const modal = document.getElementById('alarmDetailModal');
    if (modalCloseBtn && modal) modalCloseBtn.addEventListener('click', () => modal.classList.remove('show'));
    if (modalCloseX && modal) modalCloseX.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }
  }

  // 下次同步倒數計時器 (每天 07:00 ~ 17:00 每個整點更新)
  function updateNextSyncTimer() {
    const timerEl = document.getElementById('nextSyncTimer');
    if (!timerEl) return;

    const now = new Date();
    // 取得台北時間小時
    const taipeiHour = (now.getUTCHours() + 8) % 24;
    const taipeiMin = now.getUTCMinutes();
    const taipeiSec = now.getUTCSeconds();

    // 尋找下一個目標整點 (7:00 到 17:00)
    let nextTargetHour = null;
    if (taipeiHour < 7) {
      nextTargetHour = 7;
    } else if (taipeiHour >= 7 && taipeiHour < 17) {
      nextTargetHour = taipeiHour + 1;
    } else {
      nextTargetHour = 7; // 明天早上 7 點
    }

    let diffMinutes = 59 - taipeiMin;
    let diffSeconds = 59 - taipeiSec;

    timerEl.textContent = `每日 07:00~17:00 整點更新 (下次預計於 ${String(nextTargetHour).padStart(2, '0')}:00 自動同步，倒數 ${String(diffMinutes).padStart(2, '0')}分${String(diffSeconds).padStart(2, '0')}秒)`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
