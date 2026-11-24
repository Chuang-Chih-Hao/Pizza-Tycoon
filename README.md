# 披薩大亨：黃金切片
六年級扇形數學的多人合作披薩店。此初始提交提供可部署的連線大廳、教師開房、1～4 位學生加入、準備狀態及 WebSocket 遊戲伺服器。完整料理操作介面將由後續版本加入。

## 本機試用
使用 Node.js 22 以上，在專案根目錄執行 `npm ci`、`npm start`，開啟 http://localhost:3000 。以另一個分頁輸入老師取得的六位房號即可加入。健康檢查位於 `/health`。

## Render
[以既有設定建立免費服務](https://dashboard.render.com/blueprint/new?repo=https://github.com/Chuang-Chih-Hao/Pizza-Tycoon)。Blueprint 讀取根目錄的 render.yaml。手動設定 Web Service 時，Build Command 為 `npm ci --omit=dev`，Start Command 為 `npm start`，Health Check Path 為 `/health`，使用 Free 方案。房間保存在單一服務的記憶體，重新部署會清除房間。預設手動部署，請於課堂外更新。目前未建立正式服務。
