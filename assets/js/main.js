/**
 * 進金生能源 6692｜太陽光電雲端監控・異常告警戰情平台
 * 參照 taoyuan-aidc-platform 架構：多視圖/幻燈片切換、鍵盤導航、進度條、圖表與數據交互
 */

(function () {
  // 視圖與幻燈片管理
  const parts = {
    p1: [].slice.call(document.querySelectorAll('#view-p1 .slide')),
    p2: [].slice.call(document.querySelectorAll('#view-p2 .slide')),
    p3: [].slice.call(document.querySelectorAll('#view-p3 .slide')),
    p4: [].slice.call(document.querySelectorAll('#view-p4 .slide'))
  };
  const order = ['p1', 'p2', 'p3', 'p4'];
  let state = { view: 'home', idx: 0 };
  const last = { p1: 0, p2: 0, p3: 0, p4: 0 };

  const views = {
    home: document.getElementById('view-home'),
    p1: document.getElementById('view-p1'),
    p2: document.getElementById('view-p2'),
    p3: document.getElementById('view-p3'),
    p4: document.getElementById('view-p4')
  };

  const deckbar = document.getElementById('deckbar');
  const fill = document.getElementById('progressFill');
  const counter = document.getElementById('counter');

  // 資料狀態
  let allAlarmsData = null;
  let filteredAlarms = [];
  let currentPage = 1;
  const pageSize = 20;
  let currentSort = { column: 'lastAlarmType', ascending: true };
  let activeFilters = { search: '', county: 'all', alarmType: 'all', maintainer: 'all', statusPill: 'all' };

  // ECharts 實例
  const charts = {};

  // 視圖渲染切換
  function renderView() {
    Object.keys(views).forEach(k => {
      if (views[k]) views[k].classList.toggle('active', k === state.view);
    });

    const navs = document.querySelectorAll('[data-nav]');
    for (let i = 0; i < navs.length; i++) {
      navs[i].classList.toggle('active', navs[i].getAttribute('data-nav') === state.view);
    }

    if (state.view === 'home') {
      if (deckbar) deckbar.style.display = 'none';
    } else {
      if (deckbar) deckbar.style.display = 'block';
      const slides = parts[state.view];
      if (slides && slides.length) {
        slides.forEach((s, i) => { s.classList.toggle('active', i === state.idx); });
        if (counter) counter.textContent = (state.idx + 1) + ' / ' + slides.length;
        if (fill) fill.style.width = ((state.idx + 1) / slides.length * 100) + '%';
        last[state.view] = state.idx;
      }
    }

    window.scrollTo(0, 0);

    // 觸發圖表尺寸更新
    setTimeout(() => {
      Object.keys(charts).forEach(k => {
        if (charts[k]) charts[k].resize();
      });
    }, 150);
  }

  function goHash(hash) {
    hash = (hash || '#home').replace('#', '');
    if (hash === 'home' || hash === '') {
      state.view = 'home';
      renderView();
      return;
    }
    const m = hash.match(/^(p1|p2|p3|p4)-(\d+)$/);
    if (m) {
      const v = m[1], i = parseInt(m[2], 10) - 1;
      if (parts[v] && parts[v][i]) {
        state.view = v;
        state.idx = i;
        renderView();
        return;
      }
    }
    if (parts[hash]) {
      state.view = hash;
      state.idx = last[hash] || 0;
      renderView();
      return;
    }
    state.view = 'home';
    renderView();
  }

  function setHash() {
    const h = state.view === 'home' ? '#home' : '#' + state.view + '-' + (state.idx + 1);
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function move(d) {
    if (state.view === 'home') {
      if (d > 0) {
        state.view = 'p1';
        state.idx = 0;
        renderView();
        setHash();
      }
      return;
    }

    const slides = parts[state.view];
    const n = state.idx + d;
    const pos = order.indexOf(state.view);

    if (n < 0) {
      if (pos > 0) {
        state.view = order[pos - 1];
        state.idx = parts[state.view].length - 1;
      } else {
        state.view = 'home';
      }
    } else if (n >= slides.length) {
      if (pos < order.length - 1) {
        state.view = order[pos + 1];
        state.idx = 0;
      } else {
        state.view = 'home';
      }
    } else {
      state.idx = n;
    }
    renderView();
    setHash();
  }

  // 導航與按鍵綁定
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  if (btnPrev) btnPrev.addEventListener('click', () => move(-1));
  if (btnNext) btnNext.addEventListener('click', () => move(1));

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      state.view = 'home';
      renderView();
      setHash();
    } else if (e.key === 'End' && state.view !== 'home') {
      e.preventDefault();
      state.idx = parts[state.view].length - 1;
      renderView();
      setHash();
    }
  });

  window.addEventListener('hashchange', () => { goHash(location.hash); });

  // 頂部導航點擊
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const targetView = el.getAttribute('data-nav');
      state.view = targetView;
      state.idx = targetView === 'home' ? 0 : (last[targetView] || 0);
      renderView();
      setHash();
    });
  });

  // 封面快速跳轉卡片
  document.querySelectorAll('.part-card[data-jump]').forEach(card => {
    card.addEventListener('click', () => {
      const jump = card.getAttribute('data-jump');
      location.hash = jump;
    });
  });

  // 載入資料
  function loadData() {
    if (window.LATEST_ALARM_DATA) {
      allAlarmsData = window.LATEST_ALARM_DATA;
      initDataBindings();
    } else {
      fetch('data/latest.json')
        .then(res => res.json())
        .then(data => {
          allAlarmsData = data;
          initDataBindings();
        })
        .catch(err => {
          console.error("載入最新數據失敗:", err);
        });
    }
  }

  // 數據綁定與初始化
  function initDataBindings() {
    if (!allAlarmsData) return;

    // 1. 更新各處數據標籤
    const meta = allAlarmsData.metadata;
    document.querySelectorAll('.val-sites-count').forEach(el => el.textContent = meta.totalSitesWithAlarms);
    document.querySelectorAll('.val-distinct-issues').forEach(el => el.textContent = meta.totalDistinctIssues);
    document.querySelectorAll('.val-raw-events').forEach(el => el.textContent = Number(meta.totalRawAlarms).toLocaleString());
    document.querySelectorAll('.val-updated-time').forEach(el => el.textContent = meta.updatedAt);

    // 2. 初始化 ECharts 圖表
    initECharts();

    // 3. 填充 Slide 1.1 表格
    populateTypeTable();

    // 4. 填充 Slide 1.2 前十大排行榜表格
    populateTopSitesTable();

    // 5. 初始化 Slide 1.3 即時告警清冊篩選與表格
    initRealtimeTable();

    // 6. 填充 Slide 2.1 區域工務所表格
    populateRegionalTable();

    // 7. 初始化 Slide 3.1 & 3.2 附錄歷史清冊
    initAppendixSection();
  }

  // 初始化所有 ECharts 圖表
  function initECharts() {
    if (!window.echarts || !allAlarmsData) return;

    const types = allAlarmsData.statistics.typeDistribution || [];
    const sites = allAlarmsData.statistics.siteRankings || [];
    const counties = allAlarmsData.statistics.countyDistribution || [];

    // Chart 1.1A: 異常情況分布甜甜圈圖
    const chartTypeEl = document.getElementById('chartTypeDistSlide');
    if (chartTypeEl) {
      charts.typeDist = echarts.init(chartTypeEl);
      const colorMap = {
        '發電效率不佳': '#17a2b8',
        '裝置斷訊': '#e83e8c',
        '發電數據異常': '#ffc107',
        '系統未連線': '#dc3545',
        '部分通訊異常': '#6f42c1',
        '系統短暫斷線': '#fd7e14'
      };
      charts.typeDist.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: <b>{c} 筆</b> ({d}%)' },
        legend: { orient: 'vertical', right: '4%', top: 'center', textStyle: { fontSize: 11 } },
        series: [{
          name: '異常情況分布',
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['36%', '50%'],
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          data: types.map(t => ({
            value: t.count,
            name: t.type,
            itemStyle: { color: colorMap[t.type] || '#1968AD' }
          }))
        }]
      });
    }

    // Chart 1.1B: 嚴重等級分布直條圖
    const chartLevelEl = document.getElementById('chartLevelSlide');
    if (chartLevelEl) {
      charts.levelDist = echarts.init(chartLevelEl);
      const sev = allAlarmsData.metadata.severityCounts || { red: 187, orange: 312, white: 0 };
      charts.levelDist.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '12%', containLabel: true },
        xAxis: { type: 'category', data: ['緊急高等級 (Red)', '重要次要等級 (Orange)'] },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar',
          barWidth: '40%',
          data: [
            { value: sev.red, itemStyle: { color: '#dc3545', borderRadius: [4, 4, 0, 0] } },
            { value: sev.orange, itemStyle: { color: '#fd7e14', borderRadius: [4, 4, 0, 0] } }
          ],
          label: { show: true, position: 'top', fontWeight: 'bold' }
        }]
      });
    }

    // Chart 1.2: 異常案場排行榜水平長條圖
    const chartRankEl = document.getElementById('chartSiteRankSlide');
    if (chartRankEl) {
      charts.siteRank = echarts.init(chartRankEl);
      const top15 = sites.slice(0, 15).reverse();
      charts.siteRank.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: params => {
            const item = params[0];
            const s = sites.find(x => x.factoryName === item.name);
            return `<b>${item.name}</b><br/>縣市: ${s ? s.county : '--'}<br/>工程師: ${s ? s.maintainer : '--'}<br/>獨立異常: <b>${item.value} 項</b><br/>累計事件: <b>${s ? s.totalRawAlarms : '--'} 次</b>`;
          }
        },
        grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: {
          type: 'category',
          data: top15.map(s => s.factoryName),
          axisLabel: { formatter: val => val.length > 7 ? val.substring(0, 6) + '..' : val }
        },
        series: [{
          type: 'bar',
          data: top15.map(s => s.distinctIssuesCount),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
              { offset: 0, color: '#1968AD' },
              { offset: 1, color: '#1BB1BF' }
            ]),
            borderRadius: [0, 4, 4, 0]
          },
          label: { show: true, position: 'right', fontWeight: 'bold', color: '#1968AD' }
        }]
      });
    }

    // Chart 2.1: 區域縣市異常分布
    const chartCountyEl = document.getElementById('chartCountySlide');
    if (chartCountyEl) {
      charts.countyDist = echarts.init(chartCountyEl);
      const topCounties = counties.slice(0, 10);
      charts.countyDist.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
        xAxis: { type: 'category', data: topCounties.map(c => c.county) },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar',
          data: topCounties.map(c => c.count),
          itemStyle: { color: '#1BB1BF', borderRadius: [4, 4, 0, 0] },
          label: { show: true, position: 'top', fontWeight: 'bold' }
        }]
      });
    }

    // Chart 3.1: 歷時演變趨勢折線圖
    const chartTrendEl = document.getElementById('chartHourlyTrendSlide');
    if (chartTrendEl) {
      charts.trend = echarts.init(chartTrendEl);
      const snaps = window.HISTORY_SNAPSHOTS_INDEX || [];
      const sorted = [...snaps].reverse();
      const xData = sorted.map(s => s.updatedAt ? s.updatedAt.substring(11, 16) : s.snapshotId);
      const yIssues = sorted.map(s => s.totalDistinctIssues);
      const yRed = sorted.map(s => (s.severityCounts || {}).red || 0);

      charts.trend.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['獨立異常總量', '緊急告警 (Red)'], top: '2%' },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: xData.length ? xData : ['17:00'] },
        yAxis: { type: 'value' },
        series: [
          {
            name: '獨立異常總量',
            type: 'line',
            smooth: true,
            data: yIssues.length ? yIssues : [499],
            lineStyle: { width: 3, color: '#1968AD' },
            itemStyle: { color: '#1968AD' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(25,104,173,0.3)' },
                { offset: 1, color: 'rgba(25,104,173,0.01)' }
              ])
            }
          },
          {
            name: '緊急告警 (Red)',
            type: 'line',
            smooth: true,
            data: yRed.length ? yRed : [187],
            lineStyle: { color: '#D95F45' },
            itemStyle: { color: '#D95F45' }
          }
        ]
      });
    }

    window.addEventListener('resize', () => {
      Object.keys(charts).forEach(k => { if (charts[k]) charts[k].resize(); });
    });
  }

  // Slide 1.1 表格：異常情況分布統計表
  function populateTypeTable() {
    const tbody = document.getElementById('tableTypeDist');
    if (!tbody || !allAlarmsData) return;

    const types = allAlarmsData.statistics.typeDistribution || [];
    const details = {
      '發電效率不佳': { level: 'Orange', desc: '日照大於 300W/m² 且電流過低、RA% 或 PR% 偏低', action: '排查 MPPT 串列衰退、陰影遮蔭或板面髒污清洗' },
      '裝置斷訊': { level: 'Red', desc: '變流器 Inverter 與監控資料採集器通訊中斷超過 30 分鐘', action: '檢查現場 RS485 迴路、通訊接頭鬆脫或電源供應器故障' },
      '發電數據異常': { level: 'Orange', desc: '回傳功率數據突波、跳動異常或計算邏輯失準', action: '檢查電表比流器 (CT) 訊號線與資料上傳時序' },
      '系統未連線': { level: 'Red', desc: '整場 4G/固網路由器或主監控箱斷線無法取得任何回傳', action: '派工重啟路由器、確認 SIM 卡流量與現場交流輔助電源' },
      '部分通訊異常': { level: 'Orange', desc: '案場內少數設備中繼逾時，但主通訊線路仍維持運行', action: '比對終端終端電阻配置與周邊電磁干擾源' },
      '系統短暫斷線': { level: 'Orange', desc: '雲端與案場通訊曾短暫中斷後自癒復歸', action: '持續觀測通訊封包遺失率，定期執行線路穩定度檢測' }
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

  // Slide 1.2 表格：前十大異常案場清冊
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
          <td><b>${s.factoryName}</b></td>
          <td class="ctr">${s.county}</td>
          <td class="ctr">${s.maintainer}</td>
          <td class="num font-weight-bold" style="color:var(--blue); font-size:1.05rem;">${s.distinctIssuesCount}</td>
          <td class="num">${s.totalRawAlarms}</td>
          <td><span class="chip blue">${devStr}</span></td>
          <td>${topTypes}</td>
          <td class="ctr"><span class="${chipClass}">${s.worstColor.toUpperCase()}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Slide 1.3：即時告警清冊與多維篩選
  function initRealtimeTable() {
    if (!allAlarmsData) return;

    renderStatusPills();
    populateSelectFilters();
    applyFilters();

    // 搜尋與篩選事件
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        activeFilters.search = e.target.value;
        applyFilters();
      });
    }

    const filterCounty = document.getElementById('filterCounty');
    if (filterCounty) {
      filterCounty.addEventListener('change', e => {
        activeFilters.county = e.target.value;
        applyFilters();
      });
    }

    const filterAlarmType = document.getElementById('filterAlarmType');
    if (filterAlarmType) {
      filterAlarmType.addEventListener('change', e => {
        activeFilters.alarmType = e.target.value;
        activeFilters.statusPill = e.target.value;
        renderStatusPills();
        applyFilters();
      });
    }

    const filterMaintainer = document.getElementById('filterMaintainer');
    if (filterMaintainer) {
      filterMaintainer.addEventListener('change', e => {
        activeFilters.maintainer = e.target.value;
        applyFilters();
      });
    }

    // 表頭排序
    document.querySelectorAll('#tableAlarms th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (currentSort.column === col) {
          currentSort.ascending = !currentSort.ascending;
        } else {
          currentSort.column = col;
          currentSort.ascending = true;
        }
        applyFilters();
      });
    });

    // 彈窗關閉
    const modalCloseX = document.getElementById('modalCloseX');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modal = document.getElementById('alarmDetailModal');
    if (modalCloseX && modal) modalCloseX.addEventListener('click', () => modal.classList.remove('show'));
    if (modalCloseBtn && modal) modalCloseBtn.addEventListener('click', () => modal.classList.remove('show'));
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
  }

  function renderStatusPills() {
    const container = document.getElementById('statusPillsContainer');
    if (!container || !allAlarmsData) return;

    const meta = allAlarmsData.metadata;
    const typeStats = allAlarmsData.statistics.typeDistribution || [];
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
        applyFilters();
      });
    });
  }

  function populateSelectFilters() {
    const counties = allAlarmsData.statistics.countyDistribution || [];
    const types = allAlarmsData.statistics.typeDistribution || [];
    const maintainers = allAlarmsData.statistics.maintainerDistribution || [];

    const cSel = document.getElementById('filterCounty');
    if (cSel) {
      cSel.innerHTML = '<option value="all">區域: 全部</option>' +
        counties.map(c => `<option value="${c.county}">${c.county} (${c.count})</option>`).join('');
    }

    const tSel = document.getElementById('filterAlarmType');
    if (tSel) {
      tSel.innerHTML = '<option value="all">屬性: 全部</option>' +
        types.map(t => `<option value="${t.type}">${t.type} (${t.count})</option>`).join('');
    }

    const mSel = document.getElementById('filterMaintainer');
    if (mSel) {
      mSel.innerHTML = '<option value="all">工程師: 全部</option>' +
        maintainers.map(m => `<option value="${m.maintainer}">${m.maintainer} (${m.count})</option>`).join('');
    }
  }

  function applyFilters() {
    if (!allAlarmsData) return;
    let list = [...allAlarmsData.rebuildAlarms];

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

    if (activeFilters.county !== 'all') {
      list = list.filter(i => i.county === activeFilters.county);
    }
    if (activeFilters.alarmType !== 'all') {
      list = list.filter(i => i.lastAlarmType === activeFilters.alarmType);
    }
    if (activeFilters.maintainer !== 'all') {
      list = list.filter(i => i.maintainer === activeFilters.maintainer);
    }

    // 排序
    list.sort((a, b) => {
      let vA = a[currentSort.column];
      let vB = b[currentSort.column];
      if (currentSort.column === 'impact') {
        vA = a.impact || 0;
        vB = b.impact || 0;
      }
      if (vA < vB) return currentSort.ascending ? -1 : 1;
      if (vA > vB) return currentSort.ascending ? 1 : -1;
      return 0;
    });

    filteredAlarms = list;
    currentPage = 1;
    renderAlarmsTable();
  }

  function renderAlarmsTable() {
    const tbody = document.getElementById('tableAlarmsBody');
    const badge = document.getElementById('dataCountBadge');
    if (!tbody) return;

    if (badge) badge.textContent = filteredAlarms.length;

    if (filteredAlarms.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="ctr text-muted p-4">查無符合條件之異常告警記錄</td></tr>`;
      renderPagination(0);
      return;
    }

    const start = (currentPage - 1) * pageSize;
    const items = filteredAlarms.slice(start, start + pageSize);

    tbody.innerHTML = items.map((item, idx) => {
      const chipClass = item.lastColorLabel === 'red' ? 'chip coral' : (item.lastColorLabel === 'orange' ? 'chip amber' : 'chip grey');
      return `
        <tr>
          <td>
            <a class="site-link" href="javascript:void(0)" data-site="${escapeHtml(item.factoryName)}">
              <b>${escapeHtml(item.factoryName)}</b>
            </a>
          </td>
          <td class="ctr">${escapeHtml(item.county)}</td>
          <td class="ctr">${escapeHtml(item.maintainer)}</td>
          <td class="ctr"><b>${escapeHtml(item.which)}</b></td>
          <td>${escapeHtml(item.lastAlarmType)}</td>
          <td class="ctr font-mono">${escapeHtml(item.time)}</td>
          <td class="ctr"><span class="${chipClass}">${item.impact}</span></td>
          <td class="ctr">
            <button class="btn-detail" data-idx="${start + idx}">明細 ...</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.site-link').forEach(a => {
      a.addEventListener('click', () => {
        const site = a.getAttribute('data-site');
        const sInput = document.getElementById('searchInput');
        if (sInput) sInput.value = site;
        activeFilters.search = site;
        applyFilters();
      });
    });

    tbody.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        showModal(filteredAlarms[idx]);
      });
    });

    renderPagination(filteredAlarms.length);
  }

  function renderPagination(total) {
    const wrap = document.getElementById('tablePagination');
    if (!wrap) return;

    const totalPages = Math.ceil(total / pageSize) || 1;
    wrap.innerHTML = `
      <span class="text-muted">顯示第 ${(currentPage - 1) * pageSize + 1} 至 ${Math.min(currentPage * pageSize, total)} 筆，共 ${total} 筆資料</span>
      <div style="display:flex; gap:6px; align-items:center;">
        <button class="page_btn" id="pPrev" ${currentPage <= 1 ? 'disabled' : ''}>上一頁</button>
        <span class="font-weight-bold mx-1">${currentPage} / ${totalPages}</span>
        <button class="page_btn" id="pNext" ${currentPage >= totalPages ? 'disabled' : ''}>下一頁</button>
      </div>
    `;

    const prev = document.getElementById('pPrev');
    const next = document.getElementById('pNext');
    if (prev) {
      prev.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderAlarmsTable();
        }
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderAlarmsTable();
        }
      });
    }
  }

  function showModal(item) {
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
        <span><b>最近時間：</b>${escapeHtml(item.time)}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:100px;">設備</th>
              <th style="width:130px;">屬性</th>
              <th style="width:160px;">發生時間</th>
              <th>詳細內容 / 錯誤代碼</th>
            </tr>
          </thead>
          <tbody>
            ${item.allAlarms.map(a => `
              <tr>
                <td class="ctr"><b>${a.inv === null ? '系統斷線' : (typeof a.inv === 'number' ? 'Inv' + String(a.inv).padStart(2, '0') : a.inv)}</b></td>
                <td><span class="chip ${a.colorLabel === 'red' ? 'coral' : 'amber'}">${escapeHtml(a.alarmType)}</span></td>
                <td class="ctr font-mono">${escapeHtml(a.timestamp ? a.timestamp.replace('T', ' ').substring(0, 19) : '--')}</td>
                <td>${escapeHtml(a.desc || a.errMsg || '--')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    modal.classList.add('show');
  }

  // Slide 2.1 表格：三大工務責任中心
  function populateRegionalTable() {
    const tbody = document.getElementById('tableRegionalOandM');
    if (!tbody || !allAlarmsData) return;

    const data = [
      {
        center: '南區工務中心 (南辦)',
        counties: '台南市',
        engineers: '明宗、洪阿凱、white、黃昱超',
        sites: '38 案場',
        issues: '242 項',
        focus: '富強鑫 (四/五/六期)、正隆燕巢、史谷脫、奇景光電、恒美、東和',
        common: '施奈德變流器改裝背架、變流器進水停機、MPPT 衰減、日照計爆值'
      },
      {
        center: '高屏工務中心 (高辦)',
        counties: '高雄市、屏東縣',
        engineers: 'Bryant Chen、李孟家、維運一課',
        sites: '26 案場',
        issues: '138 項',
        focus: '東哥二期、海創中心、五甲尾、禾豐、特力屋左營、益網路竹',
        common: '系統斷線、通訊終端電阻損壞、交流斷路器過熱跳脫'
      },
      {
        center: '中區工務中心 (彰辦)',
        counties: '彰化縣、雲林縣、台中市',
        engineers: '羅健國、汪順發、Jerry C.',
        sites: '14 案場',
        issues: '82 項',
        focus: '新陽、新大、芳德五期、展維實業、烏日高鐵、台瑞電氣',
        common: '新陽 48 串列發電效率不佳清洗對策、新大 14x 變流器通訊斷訊'
      },
      {
        center: '北區工務中心 (桃辦)',
        counties: '桃園市、新竹縣市',
        engineers: 'andrewlu、李昀璁',
        sites: '8 案場',
        issues: '37 項',
        focus: '晶碩光電、埤塘 7-1 水面型、長榮大園、同欣龍潭',
        common: '水面型浮台跳線檢修、台電 DREAMS 2FA 集中驗證、光電涼亭飾板保固'
      }
    ];

    tbody.innerHTML = data.map(d => `
      <tr>
        <td><b>${d.center}</b></td>
        <td class="ctr">${d.counties}</td>
        <td>${d.engineers}</td>
        <td class="ctr font-weight-bold">${d.sites}</td>
        <td class="num font-weight-bold" style="color:var(--blue);">${d.issues}</td>
        <td>${d.focus}</td>
        <td>${d.common}</td>
      </tr>
    `).join('');
  }

  // Slide 3.1 & 3.2：附錄歷史快照
  function initAppendixSection() {
    const snaps = window.HISTORY_SNAPSHOTS_INDEX || [];
    const tbody = document.getElementById('tableSnapshotArchive');
    if (tbody) {
      tbody.innerHTML = snaps.map(s => `
        <tr>
          <td><code>${s.snapshotId}</code></td>
          <td class="ctr"><b>${s.updatedAt}</b></td>
          <td class="num">${s.totalSitesWithAlarms}</td>
          <td class="num font-weight-bold" style="color:var(--blue);">${s.totalDistinctIssues}</td>
          <td class="num">${Number(s.totalRawAlarms).toLocaleString()}</td>
          <td><b>${s.topSite || '--'}</b></td>
          <td>${s.topAlarmType || '--'}</td>
          <td class="ctr">
            <button class="btn-detail py-0 btn-inspect" data-snap="${s.snapshotId}">調閱快照</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-inspect').forEach(btn => {
        btn.addEventListener('click', () => {
          const snapId = btn.getAttribute('data-snap');
          const sel = document.getElementById('snapshotPickerSelect');
          if (sel) sel.value = snapId;
          loadSnapshotDetails(snapId);
          location.hash = '#p3-2';
        });
      });
    }

    const picker = document.getElementById('snapshotPickerSelect');
    if (picker) {
      picker.innerHTML = snaps.map(s => `
        <option value="${s.snapshotId}">${s.updatedAt} (${s.totalDistinctIssues} 筆異常)</option>
      `).join('');
      picker.addEventListener('change', e => {
        loadSnapshotDetails(e.target.value);
      });
      if (snaps.length > 0) {
        loadSnapshotDetails(snaps[0].snapshotId);
      }
    }

    const btnExpJson = document.getElementById('btnExportJson');
    const btnExpCsv = document.getElementById('btnExportCsv');
    if (btnExpJson) btnExpJson.addEventListener('click', exportSnapshotJson);
    if (btnExpCsv) btnExpCsv.addEventListener('click', exportSnapshotCsv);
  }

  let viewingSnapshotData = null;

  function loadSnapshotDetails(snapId) {
    if (window.LATEST_ALARM_DATA && window.LATEST_ALARM_DATA.metadata.snapshotId === snapId) {
      viewingSnapshotData = window.LATEST_ALARM_DATA;
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
        alert("載入快照失敗: " + err);
      });
  }

  function renderSnapshotViewer() {
    if (!viewingSnapshotData) return;
    const tbody = document.getElementById('tableSnapshotDetailBody');
    if (!tbody) return;

    document.getElementById('snapViewerTime').textContent = viewingSnapshotData.metadata.updatedAt;
    document.getElementById('snapViewerIssues').textContent = viewingSnapshotData.metadata.totalDistinctIssues + ' 項';
    document.getElementById('snapViewerSites').textContent = viewingSnapshotData.metadata.totalSitesWithAlarms + ' 案場';

    tbody.innerHTML = viewingSnapshotData.rebuildAlarms.slice(0, 30).map(a => `
      <tr>
        <td><b>${a.factoryName}</b></td>
        <td class="ctr">${a.county}</td>
        <td class="ctr">${a.maintainer}</td>
        <td class="ctr">${a.which}</td>
        <td>${a.lastAlarmType}</td>
        <td class="ctr font-mono">${a.time}</td>
        <td class="ctr"><span class="chip ${a.lastColorLabel === 'red' ? 'coral' : 'amber'}">${a.impact}</span></td>
      </tr>
    `).join('');
  }

  function exportSnapshotJson() {
    const data = viewingSnapshotData || allAlarmsData;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alarm_snapshot_${data.metadata.snapshotId}.json`;
    a.click();
  }

  function exportSnapshotCsv() {
    const data = viewingSnapshotData || allAlarmsData;
    if (!data) return;
    const rows = [['案場名稱', '縣市', '工程師', '設備', '屬性', '開始時間', '影響筆數']];
    data.rebuildAlarms.forEach(a => {
      rows.push([`"${a.factoryName}"`, `"${a.county}"`, `"${a.maintainer}"`, `"${a.which}"`, `"${a.lastAlarmType}"`, `"${a.time}"`, a.impact]);
    });
    const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alarm_snapshot_${data.metadata.snapshotId}.csv`;
    a.click();
  }

  // 下次同步倒數計時器
  function updateTopTimer() {
    const timerEl = document.getElementById('topbarSyncTimer');
    if (!timerEl) return;
    const now = new Date();
    const taipeiHour = (now.getUTCHours() + 8) % 24;
    const taipeiMin = now.getUTCMinutes();
    const taipeiSec = now.getUTCSeconds();

    let nextTarget = 7;
    if (taipeiHour < 7) nextTarget = 7;
    else if (taipeiHour >= 7 && taipeiHour < 17) nextTarget = taipeiHour + 1;
    else nextTarget = 7;

    const diffM = 59 - taipeiMin;
    const diffS = 59 - taipeiSec;
    timerEl.textContent = `每日 07:00~17:00 整點更新 (下次預計 ${String(nextTarget).padStart(2, '0')}:00 自動同步，倒數 ${String(diffM).padStart(2, '0')}分${String(diffS).padStart(2, '0')}秒)`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  window.addEventListener('DOMContentLoaded', () => {
    loadData();
    goHash(location.hash);
    updateTopTimer();
    setInterval(updateTopTimer, 1000);
  });

})();
