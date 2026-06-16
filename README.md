# NOVA AI - 智慧型數位人助手 (Intelligent Digital Human Assistant)

NOVA AI 是一個結合了前端網頁互動與 Streamlit 後端管理平台的次世代 AI 數位人助理專案。本專案已建立完整的 V1 骨架，特色在於「先讓網站可以跑」，且具備完善的影片與圖片 fallback 機制。

---

## 📂 檔案結構 (Project Structure)

```text
/
├── index.html                  # 前端數位人互動首頁 (直接點擊或透過 GitHub Pages 開啟)
├── style.css                   # 前端樣式檔 (採用 Glassmorphism 設計與 fallback 動畫)
├── script.js                  # 前端控制邏輯 (狀態機與 AvatarController)
├── app.py                      # 後端 Streamlit 控制台應用程式
├── requirements.txt            # Python 套件依賴
├── README.md                   # 說明文件
├── config/
│   └── avatar_settings.json    # 數位人與品牌設定檔
├── assets/
│   ├── avatar/                 # 數位人影音資源資料夾
│   │   ├── nova_working_placeholder.png  # 預設佔位圖 (影片未加載時顯示)
│   │   ├── nova_typing_loop.mp4          # 工作打字循環影片
│   │   ├── nova_turn_to_user.mp4         # 轉向使用者過渡影片
│   │   ├── nova_talk_loop.mp4            # 說話循環影片
│   │   └── nova_turn_back.mp4            # 轉回工作過渡影片
│   ├── images/
│   │   └── office_bg.png                 # 背景圖 (高質感辦公室場景)
│   └── models/                 # 未來預留模型存放路徑
└── modules/                    # 後端功能模組 (Demo 模式)
    ├── ai_provider.py          # AI 回覆模組 (預留 Gemini/OpenAI 接口)
    ├── search_layer.py         # 網路搜尋模組
    ├── voice_layer.py          # 語音 TTS/STT 模組
    └── avatar_interface.py     # 數位人動畫驅動介面
```

---

## 🚀 執行與部署說明 (Running & Deployment)

### 1. 開啟 GitHub Pages 前端
本前端純粹使用 **HTML5 / Vanilla CSS / JavaScript** 開發，不依賴任何 Node.js 構建工具或框架。
* **本地直接執行**：可以直接在瀏覽器中雙擊打開 `index.html`。
* **部署至 GitHub Pages**：
  1. 將本專案推送至您的 GitHub 儲存庫 `https://github.com/helear2252-ctrl/AIPEOPLE.git`。
  2. 進入 Repository 頁面，點選 **Settings** -> **Pages**。
  3. 將 **Source** 設定為 `Deploy from a branch`。
  4. 將 **Branch** 設為 `main` (或您的預設分支) 並點選 `Save`。
  5. 稍等片刻即可透過 GitHub 給予的 URL 網址直接在瀏覽器中存取您的數位人工作空間。

### 2. 執行 Streamlit 後端管理平台
Streamlit 後端提供了完整的 Chat 介面、語音測試、數位人測試、模型設定、數位人設定與系統狀態監控。
1. 請先確保安裝 Python (建議 3.9+)。
2. 安裝必要的依賴套件：
   ```bash
   pip install -r requirements.txt
   ```
3. 啟動 Streamlit 伺服器：
   ```bash
   streamlit run app.py
   ```
4. 啟動後，瀏覽器會自動開啟 `http://localhost:8501`。

---

## 🎥 數位人影片放置與自動套用 (Avatar Videos Setup)

本專案使用影片狀態機（Avatar State Machine）來控制數位人的動態。請在產出影片後，將影片放入 `assets/avatar/` 資料夾中，並確保檔名如下：

1. **`nova_typing_loop.mp4`** (Idle_Working 狀態)
   * **用途**：NOVA 正在打電腦工作，循環播放。
2. **`nova_turn_to_user.mp4`** (Turn_To_User 狀態)
   * **用途**：收到訊息後，NOVA 從工作狀態轉向使用者，播放一次。
3. **`nova_talk_loop.mp4`** (Talking 狀態)
   * **用途**：NOVA 開口回答使用者，循環播放。
4. **`nova_turn_back.mp4`** (Return_To_Desk 狀態)
   * **用途**：回答結束後，NOVA 轉回電腦繼續工作，播放一次。

### 🛡️ 自動防呆 fallback 機制
如果影片還沒有做，或者讀取失敗，專案內建兩段式防錯機制：
1. **第一級 Fallback**：若影片檔不存在，前端將自動載入靜態佔位圖 `assets/avatar/nova_working_placeholder.png`。
2. **第二級 Fallback**：若連靜態佔位圖亦不存在，前端會自動透過純 CSS 渲染出一個具有脈衝呼吸燈的 **NOVA Workspace 數位人專用佔位區域**，確保網站功能完整不崩潰，呈現最專業的介面。

---

## ⚙️ 系統設定檔

所有的基礎設定均儲存在 `config/avatar_settings.json` 中。Streamlit 與前端均會讀取此檔案以進行介面呈現。若 JSON 檔案遺失，系統將會自動套用預設值，保證運行無阻。
