// 案場基礎資料庫 (Site DB)
window.SITE_DB = [
  { id: "S001", name: "新陽", region: "南辦", engineer: "李健宏", capacity: "1998 kW", location: "台南市將軍區", equipType: "台達 M30A", lastMaintenance: "2026-08-15" },
  { id: "S002", name: "台南機場", region: "南辦", engineer: "張修銘", capacity: "3200 kW", location: "台南市南區", equipType: "施耐德 20k", lastMaintenance: "2026-07-22" },
  { id: "S003", name: "東哥二期", region: "高辦", engineer: "王志明", capacity: "980 kW", location: "高雄市小港區", equipType: "陽光電源", lastMaintenance: "2026-09-01" },
  { id: "S004", name: "善化酒廠", region: "南辦", engineer: "林志豪", capacity: "1500 kW", location: "台南市善化區", equipType: "台達 M50A", lastMaintenance: "2026-08-30" },
  { id: "S005", name: "新大", region: "南辦", engineer: "陳建宇", capacity: "850 kW", location: "台南市新市區", equipType: "華為", lastMaintenance: "2026-09-10" },
  { id: "S006", name: "埤塘7-1", region: "桃辦", engineer: "黃家銘", capacity: "2100 kW", location: "桃園市觀音區", equipType: "陽光電源 (水面型)", lastMaintenance: "2026-05-10" },
  { id: "S007", name: "正隆燕巢", region: "高辦", engineer: "陳柏翰", capacity: "1150 kW", location: "高雄市燕巢區", equipType: "台達 M30A", lastMaintenance: "2026-08-05" },
  { id: "S008", name: "富強鑫四期", region: "南辦", engineer: "林志豪", capacity: "750 kW", location: "台南市關廟區", equipType: "施耐德 20k", lastMaintenance: "2026-04-12" }
];

function getSiteInfo(siteName) {
  const site = window.SITE_DB.find(s => s.name === siteName);
  if (site) return site;
  return {
    id: "S999",
    name: siteName,
    region: "未分派",
    engineer: "未分派",
    capacity: "未知 kW",
    location: "未知",
    equipType: "未知",
    lastMaintenance: "無紀錄"
  };
}
