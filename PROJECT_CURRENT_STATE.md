# NOVA Phase 0：Repo Audit、Safe Cleanup、Current Baseline

盤點日期：2026-07-06（Asia/Taipei）  
清理前 HEAD：`6ad731f`（`main`、`origin/main`）  
清理前 `git status --short`：空白（working tree clean）  
本文件只記錄 Phase 0；未開始 Phase 1，未新增 Colab Provider 或 Playback Engine。

## 1. 執行入口與資料流

### 正式前端、build、Pages 入口

```text
nova.html
  ├─ style.css
  ├─ script.js (type=module)
  └─ assets/avatar/final_hd_ultra_smooth/{INTRO_009_TEST,WAITING_HD}.mp4

vite.config.ts
  ├─ index.html -> src/login-main.tsx -> pages/Login.tsx -> EarthPortalLogin.tsx/.css
  ├─ login/index.html -> src/login-main.tsx
  ├─ nova.html -> script.js + style.css
  └─ outDir docs + scripts/create-spa-fallback.mjs -> docs/404.html

docs/nova/index.html
  ├─ /AIPEOPLE/assets/nova-DHk8WeGn.js
  ├─ /AIPEOPLE/assets/nova-DF_QU8hX.css
  ├─ /AIPEOPLE/assets/modulepreload-polyfill-B5Qt9EMX.js
  └─ /AIPEOPLE/assets/{INTRO_009_TEST-CV3yNZVZ,WAITING_HD-BkcmGUle}.mp4
```

- 正式前端 entry：`nova.html`；NOVA 的 module entry 是 `script.js`。`script.js` 沒有靜態 JS imports，透過 Vite 的 `import.meta` 和瀏覽器 API 執行。
- 正式 build entry：`vite.config.ts` 的 `main`、`login`、`nova` 三個 Rollup inputs。
- GitHub Pages entry：`docs/index.html`、`docs/login/index.html`、`docs/nova/index.html`；base path 是 `/AIPEOPLE/`，`docs/404.html` 是 SPA fallback。
- 舊或非正式前端 entry：`app.py`、`streamlit_app.py`、`nova_agent_workbench.py` 是獨立 Streamlit UI；不在 Vite/Pages 路徑。`landmark_api.py` 是獨立 HTTP server。

### 正式 backend 入口

```text
agent_runtime.py (FastAPI :8080)
  ├─ POST /agent/task
  ├─ GET /agent/task/{id}
  ├─ GET /agent/task/{id}/events (SSE)
  ├─ AgentEventStream
  └─ NovaUniversalAgentCore
       ├─ GPTBrainAdapter -> deterministic fallback
       ├─ NovaTaskPlanner
       ├─ NovaToolRouter
       ├─ NovaToolRegistry
       │    ├─ agent_tools
       │    ├─ FinalBeautyRenderTool
       │    │    └─ RenderProviderRegistry
       │    │         ├─ ComfyUIRenderProvider
       │    │         └─ LocalReferenceRenderProvider
       │    └─ Codex/BrowserUse/ComputerUse adapters
       ├─ NovaSafetyGuard
       ├─ ObservationEngine
       ├─ NovaWorkspace
       └─ NovaAgentTimeline -> NovaAgentEventSchema -> SSE
```

- 正式 backend entry：`agent_runtime.py`。
- `nova_agent_api.py`（`:8787` polling/TTS mock）、`agent_orchestrator.py` + `agent_brain.py` 是舊 runtime；仍被舊前端方法或彼此引用，因此保留並標為 LEGACY。

## 2. 檔案與模組清單

盤點共 481 個 Git tracked files。依需求排除 `.git`、`node_modules`、`docs/assets` 二進位素材、大型影片與 RIFE binary/model；其引用狀態另見「資產」段。下表逐一涵蓋可執行 source/config/document/output；「正式」指目前 Vite Pages 或 `agent_runtime.py` 路徑。

| 分類 | 檔案 | 用途與引用證據 | Runtime / 正式 / fallback | 刪除判定與風險 |
|---|---|---|---|---|
| CORE_RUNTIME | `agent_runtime.py` | FastAPI、task、SSE；import `agent_stream`、`nova_agent_core`、`nova_runtime_config` | Python / 正式 | 禁刪；核心入口，極高風險 |
| CORE_RUNTIME | `agent_stream.py` | `agent_runtime.py` import；SSE event history | Python / 正式 | 禁刪；極高 |
| CORE_RUNTIME | `nova_agent_core.py` | runtime import；協調 brain/planner/router/registry/timeline/safety/workspace | Python / 正式 | 禁刪；極高 |
| CORE_RUNTIME | `nova_agent_timeline.py` | core import；event normalize/publish | Python / 正式 | 禁刪；高 |
| CORE_RUNTIME | `nova_agent_event_schema.py` | timeline import；event schema | Python / 正式 | 禁刪；高 |
| CORE_RUNTIME | `nova_agent_types.py` | registry/planner 使用 descriptors/types | Python / 正式 | 禁刪；高 |
| CORE_RUNTIME | `nova_observation.py` | core import；tool observation | Python / 正式 | 禁刪；高 |
| CORE_RUNTIME | `nova_tool_observation.py` | observation model/helper | Python / 間接正式 | 保留；引用鏈需完整 smoke 才能移除 |
| CORE_RUNTIME | `nova_runtime_config.py` | runtime、brain、registry import；env config | Python / 正式 | 禁刪；高 |
| CORE_RUNTIME | `nova_safety_guard.py` | core import；執行前後安全邊界 | Python / 正式 | 禁刪；極高 |
| CORE_RUNTIME | `nova_workspace.py` | core import；workspace operations | Python / 正式 | 禁刪；高 |
| FRONTEND_SOURCE | `nova.html` | Vite nova input；引用 `style.css`、`script.js`、兩個 avatar videos | HTML/Vite / 正式 | 禁刪；極高 |
| FRONTEND_SOURCE | `script.js` | `nova.html` module；Workbench、SSE、local playback、viewer | HTML/Vite / 正式，含 fallback | 禁刪；極高 |
| FRONTEND_SOURCE | `style.css` | `nova.html` stylesheet；Workbench/Main Viewer | HTML/Vite / 正式 | 禁刪；極高 |
| FRONTEND_SOURCE | `index.html` | Vite main input；引用 `src/login-main.tsx` | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `login/index.html` | Vite login input；引用 `src/login-main.tsx` | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `src/login-main.tsx` | import React、`pages/Login` | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `src/pages/Login.tsx` | import/re-export login component | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `src/components/login/EarthPortalLogin.tsx` | login UI；import CSS/three/react | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `src/components/login/EarthPortalLogin.css` | component import | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `src/vite-env.d.ts` | Vite TS typing | build / 正式 | 保留；低但 build 需要 |
| BUILD_OUTPUT | `docs/index.html`, `docs/login/index.html`, `docs/nova/index.html`, `docs/404.html` | Vite/SPA Pages 產物；HTML 明確引用 hashed assets | Pages / 正式 | 禁刪；極高 |
| BUILD_OUTPUT | `docs/assets/modulepreload-polyfill-B5Qt9EMX.js`, `login-main-Xj3GcjBi.js`, `login-main-BSK-ELzF.css`, `nova-DHk8WeGn.js`, `nova-DF_QU8hX.css` | 上述 docs HTML 直接引用 | Pages / 正式 | 禁刪；極高 |
| BUILD_OUTPUT | `docs/assets/INTRO_009_TEST-CV3yNZVZ.mp4`, `WAITING_HD-BkcmGUle.mp4`, `office_bg-CiKpFE73.png` | Pages build 的 media assets；前兩個由 nova HTML 直接引用，背景由 bundle/CSS 產生 | Pages / 正式 | 保留；高 |
| BUILD_OUTPUT | `docs/assets-login/earth-login-reference.png`, `docs/assets/avatar/**` | Pages/public copy；login/avatar runtime assets | Pages / 正式或相容資產 | 不刪；未完成瀏覽器資產請求 smoke，風險高 |
| BUILD_OUTPUT | `docs/assets/avatar/AIPEOPLE/{040,041,042,043}.mp4` | built `script.js` runtime paths | Pages / 正式 | 禁刪；極高 |
| BACKEND_SOURCE | `agent_tools.py` | registry import；Interior、Browser、Website、Workspace tools | Python / 正式 | 禁刪；極高 |
| AGENT_BRAIN | `gpt_brain_adapter.py` | core import；GPT plan + deterministic fallback | Python / 正式、fallback | 禁刪；極高 |
| AGENT_BRAIN | `nova_task_planner.py` | core/brain import；intent plan | Python / 正式 | 禁刪；高 |
| TOOL_LAYER | `nova_tool_router.py` | core/brain import；intent -> tool names | Python / 正式 | 禁刪；高 |
| TOOL_LAYER | `nova_tool_registry.py` | core/brain import；tool instances/descriptors | Python / 正式 | 禁刪；極高 |
| TOOL_LAYER | `final_beauty_render_tool.py` | registry import；provider selection/output/quality handling | Python / 正式 | 禁刪；極高 |
| PROVIDER_LAYER | `render_provider_base.py` | ComfyUI/local provider import；request/result interface | Python / 正式介面 | 保留；未來 Colab 可共用 |
| PROVIDER_LAYER | `render_provider_registry.py` | FinalBeauty import；優先 ComfyUI，再 local reference/diagnostic | Python / 正式、fallback | 禁刪；極高 |
| PROVIDER_LAYER | `comfyui_render_provider.py` | registry import；workflow submit/poll/timeout/output validation | Python / 正式 local provider | 禁刪；極高 |
| PROVIDER_LAYER | `local_reference_render_provider.py` | registry import；provider-required diagnostic response | Python / diagnostic fallback | 保留；高 |
| PROVIDER_LAYER | `comfyui_workflows/interior_sdxl_basic.json` | ComfyUI template candidate | Python dynamic / local provider | 保留；dynamic path，不能以無 import 判定 |
| PROVIDER_LAYER | `comfyui_workflows/interior_sd15_minimal_stable.json`, `interior_sd15_lowvram.json` | ComfyUI fallback workflows | Python dynamic / fallback | 保留；高 |
| TOOL_LAYER | `codex_adapter.py` | registry import；CLI detection/safe commands | Python / 正式註冊、部分可用 | 保留；不是 orphan |
| PLACEHOLDER | `browser_use_adapter.py` | registry import；只回 waiting_for_user | Python / placeholder | 保留；未來替換，刪除會破 registry |
| PLACEHOLDER | `computer_use_adapter.py` | registry import；只回 waiting_for_user | Python / placeholder | 保留；未來替換，刪除會破 registry |
| LEGACY | `nova_agent_api.py` | 舊 `:8787` `/api/agent/status`、TTS mock；`script.js` 保有 polling 方法 | Python / 非正式 legacy | DEPRECATE_LATER；仍有 route/reference |
| LEGACY | `agent_brain.py`, `agent_orchestrator.py` | 舊 brain/orchestrator 相互引用；已被新 core 取代 | Python / 非正式 legacy | 不刪；需完整 import/runtime/browser smoke |
| LEGACY | `nova_agent_runner.py` | Playwright mock/Phase 1-era runner；舊 API 系列用途 | Python / 非正式 legacy | 不刪；有外部啟動可能，且未 smoke |
| LEGACY | `nova_agent_workbench.py` | Streamlit mock telemetry，明確呼叫 `nova_agent_api.py` endpoints | Python / 非正式 legacy | 不刪；獨立 entry |
| LEGACY | `streamlit_app.py` | 舊 Streamlit workbench/status UI | Python / 非正式 legacy | 不刪；獨立 entry |
| LEGACY | `app.py` | 舊 Streamlit control panel；imports `modules/*` | Python / 非正式 legacy | 不刪；README 仍記載 entry |
| LEGACY | `modules/ai_provider.py`, `search_layer.py`, `voice_layer.py`, `avatar_interface.py` | `app.py` imports；mock/demo services | Python / fallback/demo | 不刪；仍有 import |
| LEGACY | `landmark_api.py`, `modules/landmark_driver.py` | 獨立 avatar/landmark HTTP path；前者 import 後者 | Python / 非正式 legacy | 不刪；獨立 entry + dynamic assets |
| TEST_OR_DEBUG | `tools/auto_flow_search.py`, `build_flow_v2_candidates.py`, `build_flow_v3_longlens_candidates.py`, `color_match.py`, `color_match_boundary.py`, `cut_transition_test.py`, `talking_emphasis_transition_test.py`, `validate_flow_v2_candidate.js` | 離線 avatar 生成/評估工具；輸出對應 test/candidate assets | 手動工具 / 非正式 | 保留；tracked、可重現素材鏈未證明無用 |
| TEST_OR_DEBUG | `tools/preview_server.py` | 本機預覽 server | 手動 / 非正式 | 保留；獨立 entry |
| TEST_OR_DEBUG | `debug_video_identity/**`, `nova-*-preview*.png`, `tmp_phase18g_crossfade_sheet.jpg` | 人工視覺驗證輸出；無 runtime reference | 非正式 debug | tracked；可疑 orphan，但未獲產品資產保存結論，故不刪 |
| GENERATED_OUTPUT | `generated_projects/fashion-store/{index.html,script.js,style.css}` | WebsiteBuilder sample/output；目前無 Vite/Python import | 產出樣本 / 非正式 | 不刪；tracked 使用者產物，刪除風險中 |
| CORE_RUNTIME | `config/avatar_settings.json` | README/app/avatar config path | Python legacy config | 保留；dynamic reference |
| BUILD_OUTPUT | `public/assets-login/earth-login-reference.png` | Vite public input；build 複製來源 | Vite / 正式 | 保留；高 |
| FRONTEND_SOURCE | `assets/images/office_bg.png`, `assets/login/earth-login-reference.png`, `assets/login/login-orb.mp4` | CSS/login component asset paths | Vite / 正式 | 保留；高 |
| CORE_RUNTIME | `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `scripts/create-spa-fallback.mjs` | npm/Vite/TS/build 配置與 fallback generator | build / 正式 | 保留；高 |
| CORE_RUNTIME | `requirements.txt` | Python/legacy dependencies | Python | 保留；中 |
| CORE_RUNTIME | `.gitignore` | cache/runtime/output ignore policy | repository | 保留；低 |
| UNKNOWN | `README.md` | 仍描述舊 Streamlit 架構，與目前正式 runtime 不完全一致 | 文件 | 保留並列為待更新；不可視為 runtime truth |
| TEST_OR_DEBUG | `tools/rife_ncnn/**` | bundled RIFE executable、DLL、model、license | 離線 video tooling | 大型二進位按要求排除內容掃描；tracked，未刪 |

### 二進位/大型資產分類

- `assets/avatar/AIPEOPLE/**`、`assets/avatar/final_hd_ultra_smooth/**` 中由 `script.js`/`nova.html` 指向的檔案是正式 runtime assets。
- `assets/avatar/approved/**`、`final/**`、`final_hd*/**` 是 approved/final 或 rollback candidates；有動態路徑和人工回復價值，不判為可刪。
- `assets/avatar/*test*/**`、`flow_*candidates/**`、frame PNG/JPG、`debug_video_identity/**` 是 TEST_OR_DEBUG / GENERATED_OUTPUT。雖無正式 runtime reference，多為 tracked 審核證據；本次不把「無 import」誤當成「可刪」。
- `docs/assets` hashed assets均由目前 docs HTML 或 built bundle/CSS 連帶使用；未發現可由純 HTML 引用證據安全刪除的舊 hash 檔。

## 3. Legacy、重複路徑與舊 UI

| 項目 | 目前呼叫/來源 | 主路徑 | 結論 |
|---|---|---|---|
| `startAgentPlayback` / `getAgentPlaybackDefinition` / queue/run/complete | `script.js` 的 SSE error/local fallback、`runWorkbenchTaskAnimation`、backend completion 都會觸發 | fallback 展示路徑 | `LEGACY_PLAYBACK_TO_REPLACE`；現在不可刪 |
| 固定 `setTimeout` cursor/step 動畫 | local playback、cursor layer、UI reveal | fallback | 同上；等 Phase 1 新 engine 驗收後移除 |
| `startAgentStatusPolling` / `pollAgentStatus` | 方法仍存在；對 `:8787/api/agent/status` | 非目前 SSE 主路徑 | LEGACY；與舊 API 成組，未完成替換前不刪 |
| `checkStreamlitAvailability`、`streamlitWorkbenchStatus`、`agentIframe`、`agentStreamlitNotice` | DOM fields 與方法仍存在；health path `/_stcore/health` | 非主路徑 | LEGACY；仍有 DOM/runtime reference，不刪 |
| `/api/agent/tts/completion` / `handleAgentCompleted` / `MOCK COMPLETE` | polling completion method直接引用 | 非主路徑 | LEGACY mock TTS；不立即刪 |
| SSE | `submitAgentTask` + `EventSource /agent/task/{id}/events` | 正式 backend 主通道 | 保留 |
| polling | `:8787/api/agent/status` | legacy | DEPRECATE_LATER |
| local `EventTarget` | `AgentStatusStream` 與 capability engine UI state | frontend internal bus | 保留；不是 transport replacement |
| fixed playback timers | SSE failure/local preview | fallback | `LEGACY_PLAYBACK_TO_REPLACE` |
| Main Result Viewer | renderer只建立一個 `[data-result-viewer='main']` | 正式 | 保留；未改 |
| Render Status / Draft Preview | HTML/JS 未找到可見 tab；CSS 有隱藏相容 selector | 非正式相容 CSS | 沒有刪除；tracked CSS 且未完成 browser smoke |
| `.interior-view-switch`, `.final-beauty-render`, `[data-design-view]` | CSS仍存在，JS仍查 `.final-beauty-render` | legacy/compatibility | 不刪；仍有 runtime query 或成組樣式依賴 |

保留 local playback 的移除門檻：真實 SSE 覆蓋完整、新 Cursor Controller、新 Main Viewer Renderer、新 Playback Engine 均完成且通過驗收。目前四項未全部成立。

## 4. Provider 架構

| 分類 | 現況 | 未來可共用介面 |
|---|---|---|
| `local_provider` | `ComfyUIRenderProvider` | `RenderProviderBase`、`RenderRequest`、`RenderResult`、`check()`、`render(request, emit)` |
| `diagnostic_provider` | `LocalReferenceRenderProvider` / `RenderProviderNotConnected` | provider status/result contract |
| `future_fallback` | SD15 minimal/low-VRAM workflow 與 local reference response | workflow selection、fallback metadata |
| `shared_quality_gate` | ComfyUI output image validation + `FinalBeautyRenderTool` final-path validation | output existence、dimensions/black-image rejection、status/metadata |
| `provider_interface_candidate` | `render_provider_base.py` + registry selection | provider name/status、timeout、event emitter、artifact path、metadata |

`NOVA_RENDER_TIMEOUT_SECONDS` 由 `agent_runtime.py` 設定（最低 480 秒）並供 render provider 使用。workflow JSON 是動態檔案路徑，不可用靜態 import 缺席判定為 orphan。本次只盤點，未改 provider、quality gate 或執行邏輯。

## 5. 系統完成度基線

| 功能 | 完成度 | 真實 / 模擬 / Placeholder | 證據與已知限制 |
|---|---|---|---|
| NOVA 首頁 | 已完成、既有穩定核心 | 真實 frontend | Vite nova entry；本次未改 |
| Workbench | 部分完成 | 真實 UI + local fallback | 有 task canvas/SSE integration；仍混有 Streamlit/polling/local playback legacy |
| Main Viewer | 已完成目前單 viewer 版本 | 真實 renderer | 單一 `[data-result-viewer='main']`；本次未改 |
| Timeline | 部分完成 | 真實 backend events + local animation | `NovaAgentTimeline` + UI event handlers；fallback timers 尚存 |
| Backend Runtime | 已完成基礎 | 真實 | FastAPI task/state/static/SSE；memory-only tasks，無持久化 |
| SSE | 已完成基礎 | 真實 | endpoint 與 frontend `EventSource` 均存在；完整瀏覽器驗收尚缺 |
| GPT Brain | 部分完成 | 真實 API + deterministic fallback | key 可用時呼叫 OpenAI；否則 fallback |
| Planner | 已完成基礎 | 真實 deterministic | intent plans 已註冊 |
| Tool Router | 已完成基礎 | 真實 mapping | intent -> tool list |
| Codex | 部分完成 | adapter | CLI detect/read/test 有實作；patch/diff 部分仍 placeholder |
| Browser Use | 尚未完成 | Placeholder | adapter只停在 waiting_for_user |
| Computer Use | 尚未完成 | Placeholder | adapter只停在 waiting_for_user |
| Interior Design Tool | 部分完成 | 真實 schema/draft + provider | tool 有執行路徑；依 provider 環境決定 final render |
| ComfyUI | 部分完成 | 真實 local provider | check/workflow/submit/poll/timeout/output validation；需本機服務/model/nodes |
| Quality Gate | 部分完成 | 真實 | black/invalid image guard 已有；未做本輪實際 image render 驗收 |
| Colab Provider | 尚未開始 | 無 | Phase 0 明令不新增 |
| Playback Engine | 尚未開始 | 無新 engine；現有 local mock | legacy playback 必須保留到 Phase 1 替代完成 |
| Browser Automation | 部分完成 | tool + legacy Playwright | 正式 registry 有 safe-boundary tool；實際網站流程未驗收 |
| Website Builder | 部分完成 | 真實檔案生成 | tool 與 sample output 存在；瀏覽器 preview 未驗收 |
| File Workspace | 部分完成 | 真實、受限 | registry/core 路徑存在；完整操作矩陣未驗收 |

## 6. 清理結果與穩定還原點

確定刪除的檔案只有 Python cache：

- `__pycache__/app.cpython-314.pyc`
- `modules/__pycache__/ai_provider.cpython-314.pyc`
- `modules/__pycache__/avatar_interface.cpython-314.pyc`
- `modules/__pycache__/search_layer.cpython-314.pyc`
- `modules/__pycache__/voice_layer.cpython-314.pyc`

引用證據：這些是 CPython 3.14 產生的 bytecode cache；相對應 `.py` source 均存在，`.gitignore` 同時規定 `__pycache__/` 與 `*.pyc` 不應入庫。刪除風險低，Python 會按需重建。本次未刪 source、tracked output、avatar test assets、docs assets 或 generated project。

穩定還原點是清理前 `6ad731f`；本次不 commit、不 tag、不 push。最近五筆基線：

1. `6ad731f` Force GitHub Pages redeploy for NOVA
2. `abd3335` Force GitHub Pages redeploy for NOVA
3. `8cfb740` Trigger GitHub Pages rebuild
4. `790195c` tag `nova_workbench_single_viewer_black_output_guard_v1`
5. `9c8ac7a` tag `nova_gpt_brain_live_timeline_v1`

## 7. 驗證結果與已知失敗

- `script.js`：UTF-8 stdin + `node --input-type=module --check` 通過（exit 0）。直接 `node --check script.js` 在 managed sandbox 被 `EPERM lstat C:\Users\admin` 阻擋；這是檔案路徑權限，非 syntax failure。
- `npm run build`：未完成。Node 啟動 Vite 前同樣被 `EPERM lstat C:\Users\admin` 阻擋；核准後的執行無輸出卡住並已中止。不能宣稱 build 成功。
- 指定 13 個 Python 檔：`python -m compileall ...` 全部通過（exit 0）。compile 產生的 cache 在最終 Git 檢查前再次清除。
- GitHub Pages route：repo 內 `docs/index.html`、`docs/login/index.html`、`docs/nova/index.html`、`docs/404.html` 均存在；未做線上 Pages 請求。
- Main Result Viewer：source audit 找到單一 renderer template；沒有 Render Status / Draft Preview 可見 DOM tab，但保留隱藏 compatibility CSS。
- Console error 0、Return to NOVA、三種任務入口：未完成真實 headless browser smoke，因此不可標為通過。source 中 `returnToNova()` 與三類 task renderer/入口存在，只能列為靜態證據。

## 8. Phase 1 前置條件

目前**尚未具備可無條件開始 Phase 1 的驗收條件**。在開始前至少需：

1. 在可讓 Node 存取 repo 父目錄的環境完成 `npm run build`，並確認 docs diff。
2. 完成 headless/實機 browser smoke：console 0 error、Return to NOVA、三種任務入口、單一 Main Viewer。
3. 啟動 `agent_runtime.py` 驗證 create task、SSE event sequence、terminal state 與 local fallback。
4. 驗證 ComfyUI 不可用、workflow missing、timeout、invalid/black output、成功 output 五種情境。
5. 保留 `LEGACY_PLAYBACK_TO_REPLACE`，直到新 SSE/Cursor/Main Viewer/Playback 四項替代均驗收。

Phase 1 本次沒有開始。

## 9. Phase 0.5：Build Root Cause 與 Browser Smoke（2026-07-06）

### Build 根因與結果

- `C:\nvm4w\nodejs` 是 SymbolicLink，target 為 `C:\Users\admin\AppData\Local\nvm\v18.20.8`。
- 受管執行環境可執行 symlink 下的 `node.exe`，但禁止對 `C:\Users\admin` 讀 ACL／`lstat`。Node 載入 npm、npx 或 main script 時，在進入任何 Vite/專案程式前於 `node:fs:2655` 的 `realpathSync` 失敗。
- 完整 first-party stack：`node:internal/fs/utils:356` → `Object.realpathSync (node:fs:2655:7)` → `toRealPath (node:internal/modules/helpers:56:13)` → `_findPath` → `_resolveFilename` / `resolveMainPath` → `lstat C:\Users\admin`。因此沒有「第一個造成 EPERM 的專案檔案/行號」；錯誤發生在 Node loader，早於 `vite.config.ts`、Vite 與 `scripts/create-spa-fallback.mjs`。
- repo 內沒有 reparse point。Vite root 是 repo root；`publicDir` 未覆寫（Vite default `public`）；`outDir` 是 `docs`；inputs 只解析 `index.html`、`login/index.html`、`nova.html`。SPA fallback 只操作 repo 下 `docs` 與六個 avatar source，不遞迴、不 glob、不掃描 home。
- workspace 起初沒有 `node_modules`。依 `package-lock.json` 執行 `npm ci` 後，使用相同 Node 18.20.8 的實際 NVM target 路徑呼叫 npm（未使用系統管理員、未改 repo 設定），`npm run build` exit 0：Vite 36 modules transformed，並成功執行 `create-spa-fallback.mjs`。

### Backend 與 SSE

- 正式網址：`http://127.0.0.1:8080/nova.html`，HTTP 200。
- `/agent/config` HTTP 200；`POST /agent/task` HTTP 202。
- `/agent/task/{id}/events` HTTP 200、`text/event-stream`；實收事件由 `task_created`、brain/plan/tool/step events 到 `preview_ready`、`task_completed`。
- `/generated_assets` mount 存在；不存在檔案 probe 正確回 404。
- backend log 無 Python traceback。

### Chrome/Playwright smoke

- Google Chrome headless 實測正式本地網址，page HTTP 200。
- Console error：0；page exception：0；關鍵 JS/CSS 404：0。
- `document.querySelectorAll("[data-result-viewer='main']").length`：室內設計為 1；其他兩種 task canvas 為 0（符合 Main Viewer 僅屬室內 renderer）。
- `Render Status`：false；`Draft Preview`：false；Timeline 三種入口皆可見。
- 室內設計：Workbench 開啟、SSE 進入、provider-required 路徑顯示 `FAILED`，不是假 `DONE`。已修正 terminal ordering：Viewer=`FAILED`、lifecycle=`FAILED`、terminal=`true`、backend lifecycle=`backend_failed`；等待 10 秒後四項保持不變。
- 網站生成：`demoToCode` 開啟、backend terminal `backend_completed`、label `DONE`，無 JS exception。
- 訂票：`booking` 開啟、backend terminal `backend_waiting_for_user`、label `WAITING FOR USER`，無 JS exception。
- Return to NOVA：三次均可返回並恢復輸入。
- failure handler probe：`backend_failed`、label `FAILED`、`showsFakeDone=false`。
- `window.NOVA_WORKBENCH_DISPLAY_STATE` 新增可驗收的 `lifecycle` 與 `terminal`，其餘結構為 `taskType, phase, taskId, provider, progress, imageUrl, imageLoadStatus, previewDomStatus, badge, lastEvent, updatedAt`。
- 正常影片：`MEDIA_PLAYING`，active video `currentTime` 由 0.166954 增至 1.37882，fallback 不可見。
- 故意中斷 active video：`MEDIA_FALLBACK`，CSS fallback 真正可見，video wrapper 隱藏，input/send 可用，並可正常開啟 Workbench；Console error 0。

### 事件通道觀察

- Backend SSE：正式 `EventSource /agent/task/{id}/events`，實際驅動 intent、plan、tool、step、preview、terminal events。
- local `EventTarget`：前端 `AgentStatusStream`/capability UI bus；不是 backend transport。
- fixed timer：local playback/cursor/reveal fallback 使用；本次 backend online，沒有啟動 offline local fallback。
- polling：`startAgentStatusPolling`/`pollAgentStatus` 仍存在，但目前 send/SSE path 沒有呼叫 `startAgentStatusPolling`，本次未與 SSE 同時啟動。
- local fallback 可由 SSE submit/connect error 觸發；source guard 會避開已 terminal backend state。design3d failure 現已先鎖定 terminal/lifecycle 再關閉 SSE，避免回退至 `backend_running`。

### Phase 1 判定

依本輪明列的驗收條件，Phase 1 **已具備開始條件**：正常影片、故意中斷 fallback、FAILED terminal 10 秒、三入口、Console 0、backend/SSE 與 `npm run build` exit 0 全數通過。Phase 1 本輪仍沒有開始。

### PyCache 與最終 Git 注意事項

- `git ls-files` 仍列出五個 `.pyc`，因為它們是 HEAD 既有 tracked files，而 Phase 0 刪除尚未 commit；working tree 狀態是五筆 `D`。
- `.gitignore` 已有 `__pycache__/`、`*.pyc`（重複規則亦存在），能阻止新的 untracked cache 被加入；本次不修改 `.gitignore`。
- 最終 build 因 `script.js` 正式修改產生新的 NOVA hashed JS，`docs/nova/index.html` 與對應 `docs/assets/nova-*.js` 有預期內容 diff；未用 checkout/reset 清除。
