@echo off
chcp 65001 >nul
echo ========================================================
echo   進金生能源 6692｜太陽光電異常告警平台 - 本機手動同步
echo ========================================================
echo.
echo [1/2] 正在自 ACMEPOINT 系統同步最新告警事件...
python fetch_alarms.py
if %ERRORLEVEL% NEQ 0 (
    echo [錯誤] 資料同步失敗，請確認網路連線與憑證！
    pause
    exit /b 1
)
echo.
echo [2/2] 資料更新成功！
echo - 最新數據：data\latest.json
echo - 歷史快照：data\snapshots\
echo - 靜態離線腳本：data\data.js
echo.
echo 請開啟 index.html 檢視最新即時告警儀表板，或開啟 appendix.html 追蹤歷史趨勢。
pause
