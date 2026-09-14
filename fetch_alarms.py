#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
進金生能源 6692｜異常告警平台
定時抓取 om.acmepointes.com 告警數據並計算統計指標
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timezone, timedelta

# 設定時區為台北時間 (UTC+8)
TZ_TAIPEI = timezone(timedelta(hours=8))

BASE_URL = "https://om.acmepointes.com"
LOGIN_API = f"{BASE_URL}/api/cosmos/auth/login"
ALARMS_API = f"{BASE_URL}/api/cosmos/devicestatus/historyalarms"

USERNAME = os.environ.get("OM_USERNAME", "davidyeh")
PASSWORD = os.environ.get("OM_PASSWORD", "om016692")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/tw/historyalarms"
}

def inv_or_not(inv):
    if inv is None:
        return "系統斷線"
    if isinstance(inv, int):
        return f"Inv{inv:02d}"
    return str(inv)

def alarm_priority(alarm_type):
    priority_map = {
        "系統未連線": 1,
        "系統短暫斷線": 2,
        "發電數據異常": 3,
        "裝置斷訊": 4,
        "部分通訊異常": 5,
        "發電效率不佳": 6,
    }
    return priority_map.get(alarm_type, 7)

def fetch_data():
    session = requests.Session()
    session.headers.update(HEADERS)

    print(f"[{datetime.now(TZ_TAIPEI).strftime('%Y-%m-%d %H:%M:%S')}] Logging in as {USERNAME}...", flush=True)
    login_payload = {
        "account": USERNAME,
        "password": PASSWORD
    }
    
    login_res = session.post(LOGIN_API, json=login_payload, timeout=15)
    if login_res.status_code != 200:
        raise RuntimeError(f"Login failed: HTTP {login_res.status_code} - {login_res.text}")
    
    login_data = login_res.json()
    if not login_data.get("success"):
        raise RuntimeError(f"Login returned error: {login_data.get('msg')}")
    
    print(f"Login success! Operator: {login_data.get('data', {}).get('displayName', 'User')}", flush=True)

    print(f"Fetching alarms from {ALARMS_API}...", flush=True)
    alarms_res = session.post(ALARMS_API, json={}, timeout=30)
    if alarms_res.status_code != 200:
        raise RuntimeError(f"Failed to fetch alarms: HTTP {alarms_res.status_code} - {alarms_res.text}")
    
    alarms_json = alarms_res.json()
    if not alarms_json.get("success"):
        raise RuntimeError(f"Alarms API returned error: {alarms_json.get('msg')}")
    
    raw_sites = alarms_json.get("data", [])
    print(f"Successfully fetched {len(raw_sites)} sites with alarm records.", flush=True)
    return raw_sites

def process_and_analyze(raw_sites):
    now_taipei = datetime.now(TZ_TAIPEI)
    timestamp_str = now_taipei.strftime("%Y-%m-%d %H:%M:%S")
    snapshot_id = now_taipei.strftime("%Y-%m-%d_%H-00")

    rebuild_alarms = []
    site_stats_map = {}
    type_distribution = {}
    county_distribution = {}
    maintainer_distribution = {}
    level_distribution = {"red": 0, "orange": 0, "white": 0}

    total_raw_alarms = 0

    for site in raw_sites:
        factory_name = site.get("factoryName", "未知案場")
        county = site.get("county", "未指定")
        maintainer = site.get("maintainer", "未指定")
        all_alarms = site.get("allAlarms", [])
        total_raw_alarms += len(all_alarms)

        # 彙總同一案場統計
        if factory_name not in site_stats_map:
            site_stats_map[factory_name] = {
                "factoryName": factory_name,
                "county": county,
                "maintainer": maintainer,
                "totalRawAlarms": len(all_alarms),
                "distinctIssuesCount": 0,
                "alarmTypeCounts": {},
                "devices": set(),
                "worstColor": "white",
                "latestTime": ""
            }

        # 去重分組：inv + alarmType
        dedup_keys = []
        for a in all_alarms:
            key = (a.get("inv"), a.get("alarmType"))
            if key not in dedup_keys:
                dedup_keys.append(key)

        for inv, a_type in dedup_keys:
            # 篩選對應 alarms
            matching = [a for a in all_alarms if a.get("inv") == inv and a.get("alarmType") == a_type]
            if not matching:
                continue

            for m in matching:
                if m.get("level") == 2:
                    m["alarmType"] = "發電數據異常"

            last_alarm = matching[-1]
            last_type = last_alarm.get("alarmType", "其他")
            last_color = last_alarm.get("colorLabel", "white")
            raw_time = last_alarm.get("timestamp", "")
            
            # 時間格式轉換
            try:
                dt = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
                formatted_time = dt.astimezone(TZ_TAIPEI).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                formatted_time = raw_time[:19].replace("T", " ")

            device_str = inv_or_not(inv)

            item = {
                "factoryName": factory_name,
                "county": county,
                "maintainer": maintainer,
                "which": device_str,
                "lastAlarmType": last_type,
                "lastColorLabel": last_color,
                "time": formatted_time,
                "impact": len(matching),
                "allAlarms": matching
            }
            rebuild_alarms.append(item)

            # 更新案場統計
            site_stat = site_stats_map[factory_name]
            site_stat["distinctIssuesCount"] += 1
            site_stat["alarmTypeCounts"][last_type] = site_stat["alarmTypeCounts"].get(last_type, 0) + 1
            site_stat["devices"].add(device_str)
            if last_color == "red":
                site_stat["worstColor"] = "red"
            elif last_color == "orange" and site_stat["worstColor"] != "red":
                site_stat["worstColor"] = "orange"
            if not site_stat["latestTime"] or formatted_time > site_stat["latestTime"]:
                site_stat["latestTime"] = formatted_time

            # 統計指標 (1)：異常情況分布
            type_distribution[last_type] = type_distribution.get(last_type, 0) + 1
            county_distribution[county] = county_distribution.get(county, 0) + 1
            maintainer_distribution[maintainer] = maintainer_distribution.get(maintainer, 0) + 1
            level_distribution[last_color] = level_distribution.get(last_color, 0) + 1

    # 排序 rebuild_alarms (照屬性優先順序)
    rebuild_alarms.sort(key=lambda x: (alarm_priority(x["lastAlarmType"]), x["factoryName"]))

    # 整理統計指標 (2)：同一案場有多少異常 (依異常數排序)
    site_rankings = []
    for f_name, s in site_stats_map.items():
        site_rankings.append({
            "factoryName": f_name,
            "county": s["county"],
            "maintainer": s["maintainer"],
            "distinctIssuesCount": s["distinctIssuesCount"],
            "totalRawAlarms": s["totalRawAlarms"],
            "devicesCount": len(s["devices"]),
            "devicesList": sorted(list(s["devices"])),
            "alarmTypeCounts": s["alarmTypeCounts"],
            "worstColor": s["worstColor"],
            "latestTime": s["latestTime"]
        })
    # 依獨立問題數排序
    site_rankings.sort(key=lambda x: (x["distinctIssuesCount"], x["totalRawAlarms"]), reverse=True)

    # 異常情況分布格式化清單
    type_rankings = [
        {"type": k, "count": v, "percentage": round(v / len(rebuild_alarms) * 100, 1) if rebuild_alarms else 0}
        for k, v in sorted(type_distribution.items(), key=lambda item: item[1], reverse=True)
    ]

    # 縣市分布
    county_rankings = [
        {"county": k, "count": v, "percentage": round(v / len(rebuild_alarms) * 100, 1) if rebuild_alarms else 0}
        for k, v in sorted(county_distribution.items(), key=lambda item: item[1], reverse=True)
    ]

    # 工程師分布
    maintainer_rankings = [
        {"maintainer": k, "count": v, "percentage": round(v / len(rebuild_alarms) * 100, 1) if rebuild_alarms else 0}
        for k, v in sorted(maintainer_distribution.items(), key=lambda item: item[1], reverse=True)
    ]

    result = {
        "metadata": {
            "snapshotId": snapshot_id,
            "updatedAt": timestamp_str,
            "totalSitesWithAlarms": len(site_rankings),
            "totalDistinctIssues": len(rebuild_alarms),
            "totalRawAlarms": total_raw_alarms,
            "severityCounts": level_distribution
        },
        "statistics": {
            "typeDistribution": type_rankings,
            "siteRankings": site_rankings,
            "countyDistribution": county_rankings,
            "maintainerDistribution": maintainer_rankings
        },
        "rebuildAlarms": rebuild_alarms
    }

    return result, snapshot_id

def save_data(result, snapshot_id):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(current_dir, "data")
    snapshots_dir = os.path.join(data_dir, "snapshots")
    os.makedirs(snapshots_dir, exist_ok=True)

    # 1. 儲存最新快照 latest.json
    latest_file = os.path.join(data_dir, "latest.json")
    with open(latest_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Saved latest data to {latest_file}", flush=True)

    # 2. 儲存時間戳快照
    snapshot_file = os.path.join(snapshots_dir, f"{snapshot_id}.json")
    with open(snapshot_file, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Saved snapshot to {snapshot_file}", flush=True)

    # 3. 更新快照索引清冊 index.json
    index_file = os.path.join(data_dir, "index.json")
    history_index = []
    if os.path.exists(index_file):
        try:
            with open(index_file, "r", encoding="utf-8") as f:
                history_index = json.load(f)
        except Exception:
            history_index = []

    # 移除重複的 snapshotId
    history_index = [item for item in history_index if item.get("snapshotId") != snapshot_id]

    # 加入本次快照索引
    history_index.append({
        "snapshotId": snapshot_id,
        "updatedAt": result["metadata"]["updatedAt"],
        "totalSitesWithAlarms": result["metadata"]["totalSitesWithAlarms"],
        "totalDistinctIssues": result["metadata"]["totalDistinctIssues"],
        "totalRawAlarms": result["metadata"]["totalRawAlarms"],
        "severityCounts": result["metadata"]["severityCounts"],
        "topAlarmType": result["statistics"]["typeDistribution"][0]["type"] if result["statistics"]["typeDistribution"] else "",
        "topSite": result["statistics"]["siteRankings"][0]["factoryName"] if result["statistics"]["siteRankings"] else "",
        "filename": f"snapshots/{snapshot_id}.json"
    })

    # 依時間降冪排列
    history_index.sort(key=lambda x: x["snapshotId"], reverse=True)

    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(history_index, f, ensure_ascii=False, indent=2)
    print(f"Updated index ({len(history_index)} snapshots) to {index_file}", flush=True)

    # 4. 產生 data.js 供純靜態或本地雙擊直接運行
    data_js_file = os.path.join(data_dir, "data.js")
    with open(data_js_file, "w", encoding="utf-8") as f:
        f.write(f"window.LATEST_ALARM_DATA = {json.dumps(result, ensure_ascii=False)};\n")
        f.write(f"window.HISTORY_SNAPSHOTS_INDEX = {json.dumps(history_index, ensure_ascii=False)};\n")
    print(f"Saved standalone script to {data_js_file}", flush=True)

def main():
    try:
        raw_sites = fetch_data()
        result, snapshot_id = process_and_analyze(raw_sites)
        save_data(result, snapshot_id)
        print("Alarm platform data synchronization completed successfully!")
    except Exception as e:
        print(f"Error during execution: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
