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

## 10. Phase 1 — Real Agent Architecture Audit

本章是只讀架構稽核；除本報告外沒有修改 source、UI、GPT Brain、Workbench、Provider 或 playback。

### 10.1 真實端到端呼叫鏈

前端正式鏈：

1. `nova.html:92-96` 的 `#chat-input` / `#btn-send` 由 `script.js:1027-1032` 綁定至 `AvatarController.handleSendMessageFlow()`。
2. `handleSendMessageFlow()`（`script.js:1930-1960`）讀取字串 prompt、鎖定 input、處理 avatar cue，呼叫 `startAgentWorkbench()`（`1963-1971`）。這是 async browser flow；錯誤由 `catch` 進 `showAgentError()`。
3. `showAgentOverlay()`（`1979` 起）呼叫 `renderCurrentWorkbenchTask()`；後者以 keyword 決定前端 canvas、建立 Workbench DOM，並呼叫 `startAgentTaskRuntime()`（`script.js:1679-1698`）。
4. `startAgentTaskRuntime()`（`1344-1360`）以 `startBackendAgentTask()` POST JSON `{"userMessage": string, "brain": "localMock"}` 到 `/agent/task`（`script.js:515-525`）。HTTP/abort error 進 `handleBackendRuntimeOffline()` 與 local fallback。
5. backend 回傳 task JSON 後，`subscribeAgentEvents()` 建立 `/agent/task/{id}/events` 的 `EventSource`（`script.js:528-543`），註冊具名 SSE events。非預期斷線才呼叫 offline handler。
6. `handleBackendAgentEvent()`（`1404-1468`）把 `event.data.task` 設為前端 state，依序更新 Timeline、debug、Workbench、tool chip、render state、terminal state。
7. Timeline 由 `updateOperationTimeline()`（`script.js:1472-1503`）使用真實 event type/payload 更新；Viewer 由 `setWorkbenchDisplayPhase()`（`1312-1342`）與 `renderMainResultViewer()` 更新；backend 提供 `state.cursor` 時由 `updateWorkbenchFromAgentState()`（`1662-1669`）轉成百分比座標。

後端正式鏈：

1. `TaskRequest` 是 Pydantic model：`userMessage: str`、`brain: str="localMock"`（`agent_runtime.py:21`）。`POST /agent/task`（`27-32`）建立 memory-only task dict、先 publish `task_created`，再以 daemon thread 同步呼叫 `NovaUniversalAgentCore.run()`。
2. `NovaUniversalAgentCore` 建立 Planner、Registry、Router、Observer、Safety、Workspace（`nova_agent_core.py:12-14`）。`run()` 本身同步，因 FastAPI route 在 thread 中啟動，所以 API 非阻塞。
3. Core 建立 `GPTBrainAdapter`，先 `plan()`；任何 exception（包括無 key、HTTP、JSON）都進 deterministic `fallback()`，發 `brain_fallback_used`，不會直接 FAILED（`nova_agent_core.py:18-24`）。
4. tool names 優先採 Brain `selectedTools` 中存在 descriptor 的項目；若結果為空才 `router.select(intent)`（`nova_agent_core.py:24`）。Core 再呼叫本地 `planner.create_plan()` 重建執行 steps（`26`），沒有直接執行 Brain 的 `plan[]`。
5. descriptor status 必須是 `available` 才進 executable list（`nova_agent_core.py:32`）。每個 tool 的同步 `run(message, emit)` 被 try/catch 包住；ObservationEngine 將 result/files 或 exception 正規化（`37-49`、`nova_observation.py:3-6`）。
6. tool events 經 `tool_emit()` 送入 `NovaAgentTimeline.emit()`；部分事件建立 alias（例如 `beauty_render_progress` → `render_sampling_progress`）（`nova_agent_core.py:38-42`）。
7. 成功終點依序是 `artifact_created`、`preview_ready`、`task_completed`（`nova_agent_core.py:52-55`）；未捕捉 exception 會把 task 設為 `failed` 並發 `task_failed`（`56-57`）；safety 可產生 `waiting_for_user`（`30-31`、`53-54`）。
8. `NovaAgentTimeline.emit()` 將 payload 補成 `AgentTimelineEvent` 後 publish（`nova_agent_timeline.py:3-12`）。事件 schema 是 `eventType/taskId/stepId/title/visibleAction/tool/status/progress/timestamp/artifact/debug`（`nova_agent_event_schema.py:5-12`）。
9. `AgentEventStream` 以 Condition 保存每 task 的 in-memory event list（`agent_stream.py:6-17`）；SSE route 將 event 轉為 `id/event/data` frames，terminal task status 後結束（`agent_runtime.py:39-50`）。

### 10.2 GPT Brain、Planner 與 Tool Router

- 真正 Agent Brain：`GPTBrainAdapter`（`gpt_brain_adapter.py:5-20`）。當 `OPENAI_API_KEY` 存在時，會以 `urllib.request` 真實 POST `https://api.openai.com/v1/chat/completions`，timeout 45 秒（`10-17`）。
- model 來自 `NOVA_OPENAI_MODEL`，default `gpt-4.1-mini`；key 只從 backend process environment 的 `OPENAI_API_KEY` 讀取（`nova_runtime_config.py:5-14`），前端 `/agent/config` 只收到 availability boolean，不會收到 token（`agent_runtime.py:23-25`）。
- Brain response 是 JSON object；預設 public schema：

```json
{"brainProvider":"GPTBrainAdapter","intent":"general_assistant","confidence":0.0,"plan":[],"selectedTools":[],"safetyLevel":"safe","requiresUserConfirmation":false}
```

- 沒有 runtime validator/Pydantic model 驗證 GPT JSON 欄位；只以 default dict `update()`（`gpt_brain_adapter.py:12-17`）。malformed/missing critical data可在 core 觸發 exception，最外層才會 FAILED；GPT call 本身失敗則通常被降級為 fallback，而非 FAILED。
- fallback 是 keyword intent detection（`nova_task_planner.py:4-9`）+ hard-coded router（`nova_tool_router.py:1-5`）+ hard-coded step templates（`nova_task_planner.py:10-12`），不是模型推理。
- Planner 產生 `AgentPlan(intent, steps, tools, goal)` dataclass（`nova_agent_types.py:21-24`）。
- Brain 的 `selectedTools` 真正影響 tool selection，但 Brain 的 `plan[]` 不驅動執行 steps；core 會用 local planner 重建。因此 Planner 與 Router 是「部分由 Brain intent/tools 引導、主要由 hard-coded mappings 執行」。
- 若 Brain 回傳不存在 descriptor 的 tools，會被濾掉並回到 Router；若至少一個合法 tool 存在，Router 不再補工具（`nova_agent_core.py:24`）。
- 固定 mock data：fallback confidence=1、所有 planner step labels、router routes、Interior scene spec、booking result、website product/catalog、FinalBeauty positive/negative base prompts。

### 10.3 Tool Registry 實際狀態

| Tool id | 實體 class / intent | 分類與 side effect | Artifact / SSE / 驗證狀態 |
|---|---|---|---|
| `InteriorDesignTool`, `Interior3DTool` | 同一 `Interior3DTool`; `interior_design` | PARTIAL；回固定 scene dict，無 filesystem side effect（`agent_tools.py:13-17`） | `tool_output` SSE；無檔案；成功路徑已 smoke，沒有獨立 failure validation |
| `FinalBeautyRenderTool` | `FinalBeautyRenderTool`; `interior_design` | IMPLEMENTED orchestration；寫 generated JSON/image（`final_beauty_render_tool.py:18-89`） | 多個 render SSE/artifacts；provider unavailable、timeout/invalid 分支存在，成功需 ComfyUI 環境 |
| `FileWorkspaceTool` | `FileWorkspaceTool`; interior/website/code/file | PLACEHOLDER/no-op，固定 `Workspace ready`（`agent_tools.py:41-43`） | 無 artifact、無自身 SSE；core 仍把它視為成功 |
| `BrowserBookingTool`, `BrowserAutomationTool` | 同一 `BrowserAutomationTool`; booking | MOCK/PARTIAL；只回固定 Vieshow preview，未啟動 Playwright（`agent_tools.py:19-24`） | `tool_output` + `tool_waiting_for_user`; 無真實 browser side effect |
| `WebsiteBuilderTool` | `WebsiteBuilderTool`; website | IMPLEMENTED template writer；真的建立/覆寫 `generated_projects/fashion-store` 三檔（`agent_tools.py:26-39`） | `tool_output`、3 artifacts；內容與商品固定，只 prompt 未真正塑形 |
| `CodeBuilderTool` | `PassiveTool`; code | PLACEHOLDER；固定 summary（`nova_tool_registry.py:12-14,21`） | 無 artifact；core emits generic observation |
| `ResearchTool` | `PassiveTool`; research/general | PLACEHOLDER；固定 summary（`nova_tool_registry.py:22`） | 無外部搜尋、無 artifact |
| `GPTBrainAdapter` | `PlaceholderTool` registry entry | registry tool 是 PLACEHOLDER；真正 Brain 在 core 直接 new，不由 registry tool 執行（`nova_tool_registry.py:23`） | 無 |
| `CodexAdapter` | `CodexAdapter`; 無 Router route | PARTIAL/UNUSED | 見 10.9 |
| `BrowserUseAdapter` | `BrowserUseAdapter`; booking/research | descriptor `placeholder`，故 core executable filter 會跳過（`nova_tool_registry.py:39`; `nova_agent_core.py:32`） | 若直接 run 只發 started/completed blocked |
| `ComputerUseAdapter` | `ComputerUseAdapter`; 無 Router route | PLACEHOLDER/UNUSED，descriptor `placeholder` | 若直接 run 只發 started |
| `ComfyUIRenderProvider` | registry value是 `PlaceholderTool` | 直接 tool id 是 PLACEHOLDER；真正 provider 由 FinalBeauty 的 provider registry 使用 | 不應由 Tool Registry 直接執行 |
| `GitTool`, `ComputerUseTool`, `BrowserUseTool`, `RenderTool` | `PlaceholderTool` | PLACEHOLDER，且多數無 route | 固定 placeholder result |

Registry descriptor default status 是 `available`（`nova_agent_types.py:16-19`）；所以 `PassiveTool`、`FileWorkspaceTool` 等會被 core 當成 executable success。這是目前「顯示完成」與「真實能力」間的重要落差。

### 10.4 室內設計真實路徑

實際鏈：prompt → fallback/GPT intent `interior_design` → Router 預設 `[InteriorDesignTool, FinalBeautyRenderTool, FileWorkspaceTool]`（`nova_tool_router.py:2`）→ core 順序 run → render provider → quality validation → SSE terminal。

- `Interior3DTool` 真實產生 `sceneSpec` dict，但內容全部固定為 modern cafe、固定 objects/count/material/lighting/camera/layers；prompt 沒有參與計算（`agent_tools.py:13-17`）。
- Room Schema：沒有獨立 schema model；只有固定 sceneSpec。ComfyUI 的 `buildPrompt(roomSchema)` 存在（`comfyui_render_provider.py:56-58`），但 FinalBeauty 呼叫時沒有傳入 sceneSpec。
- Moodboard：沒有 backend artifact、model 或 event。
- Zoning：沒有演算法或 artifact。
- Furniture placement/material/lighting：backend 只回固定 counts/labels；前端 WebGL scene 的幾何與座標硬編碼於 `script.js:280-318`，不是 prompt 計算結果。`applySceneSpec()` 只更新 HUD文字（`356-361`）。
- Prompt Analysis / Style Extraction：GPT/fallback 有 intent/plan，但沒有專門 analysis artifact；畫面文案是前端固定模板。
- 3D Blockout：前端 `Interior3DEngine` 真實建立 Three.js geometry，能 drag rotation；但模型佈局固定，不是 backend spatial solver。
- render prompt：`FinalBeautyRenderTool` 使用固定 `POSITIVE_PROMPT` + `. Client brief: {message}`，固定 negative prompt，輸出 640×384 `RenderRequest`（`final_beauty_render_tool.py:14-15,26-32`）。
- workflow：provider default `interior_sd15_lowvram.json`，fallback `interior_sd15_minimal_stable.json`（`comfyui_render_provider.py:23-29`）；placeholder tokens由 `_inject()` 取代（`222-228`），checkpoint 由 env/API選取（`63-69,253-256`）。
- 真實 render：POST ComfyUI `/prompt`、poll `/history/{id}` 和 `/queue`、GET `/view`、儲存 `final_render.png`（`71-117,162-209`）。
- Image Quality Gate：沒有獨立 class；內嵌在 `validateOutputImage()`，驗證可開啟、>10KB、dimensions、非全黑/全白/單色、finite mean（`119-140`）。黑圖會用 fallback workflow 重試一次（`230-250`）。
- final image 回傳：相對 path 寫入 `RenderResult.image_path`；FinalBeauty 轉為 `/generated_assets/.../final_render.png`，發 `beauty_render_ready/completed`（`final_beauty_render_tool.py:60-75`）；FastAPI static mount 提供檔案（`agent_runtime.py:52`）。
- FAILED：timeout、invalid image、environment failure會 raise，core 發 `task_failed`；provider unavailable則寫 `render_provider_required.json`、發 `beauty_render_blocked`，tool本身仍 return，最後可能是 `task_completed` 但前端轉成 FAILED/blocked display（`final_beauty_render_tool.py:76-89`）。

畫面來源分類：

| 可見步驟 | 真實 artifact/backend event | 實際來源 | Phase 2 最小缺口 |
|---|---|---|---|
| Prompt Analysis | intent/plan event；無 analysis artifact | 部分真實 | typed analysis schema + persisted artifact |
| Style Extraction | 無專門 event/artifact | 固定前端文字 | prompt-derived style model |
| Moodboard | 無 | NOT_IMPLEMENTED/固定畫面概念 | moodboard generator + artifact event |
| Zoning Layout | 無 | 固定 scene | zoning solver/schema |
| Room Schema | 固定 sceneSpec `tool_output` | PARTIAL | validated dynamic RoomSchema |
| 3D Blockout | 前端 Three.js geometry；無 backend model file | 真 UI、固定模型 | schema-to-geometry mapping |
| Furniture Placement | 固定 coordinates/count | 固定 playback/geometry | placement computation + artifact |
| Material Pass | 固定 material palette | 固定 playback | material assignments from schema |
| Lighting Pass | 固定 lights | 固定 playback | lighting plan from schema |
| Final Render | 真 ComfyUI job/image/quality events（環境可用時） | REAL provider path | remote-provider abstraction + job schema |

### 10.5 Render Provider 抽象程度與建議 schema

已存在：

- `RenderProviderBase.check()` / `render()`、`RenderRequest`、`RenderResult`（`render_provider_base.py:9-38`）。
- `RenderProviderRegistry`，但 providers list 與優先序 hard-coded，只真正 check ComfyUI；local reference 與 `RenderProviderNotConnected` 選擇不完整（`render_provider_registry.py:8-22`）。
- standardized request/result：有，但欄位不足以表達 remote job、progress、failure code、cancellation。
- health check：ComfyUI `detectAvailability()` 呼叫 `/system_stats`、`/queue`、`/object_info`（`comfyui_render_provider.py:38-49`）。
- timeout：有 poll timeout + 60秒 grace（`81-106`）。
- retry：僅 invalid-black-output fallback workflow 一次；沒有 transport retry/backoff。
- cancellation：沒有。
- provider factory/environment selection：沒有；`NOVA_RENDER_PROVIDER` 不存在。
- standardized job status：沒有獨立 model；ComfyUI prompt id/status藏在 dict/metadata。

Colab 可共用 `RenderProviderBase`、`RenderRequest` 的 prompt/dimensions、`RenderResult`、FinalBeauty artifact/emit contract、quality validation概念。建議只提出、不實作：

```text
RenderRequest {task_id, prompt, negative_prompt, width, height, seed?, workflow_id?, metadata}
RenderJob {job_id, provider, task_id, status, submitted_at, remote_ref}
RenderProgress {job_id, stage, progress, message, updated_at}
RenderResult {job_id, provider, status, image_path|download_url, metadata}
RenderFailure {job_id?, provider, code, message, retryable, details}
RenderProviderHealth {provider, available, latency_ms, capabilities, reason, checked_at}
```

### 10.6 Google Colab GPU 接入缺口

必須新增（此 audit 不實作）：

- backend：`colab_render_provider.py`、`colab_render_client.py`、`colab_render_schema.py`、`render_provider_factory.py`。
- Colab：`nova_colab_render_backend.ipynb`，內含 FastAPI server、單一 GPU model worker、bounded job queue、`GET /health`、`POST /render`、`GET /jobs/{id}`、`GET /jobs/{id}/result`、Bearer token middleware與 tunnel bootstrap。
- configuration：`NOVA_RENDER_PROVIDER`、`NOVA_COLAB_BASE_URL`、`NOVA_COLAB_TOKEN`、`NOVA_COLAB_TIMEOUT_SECONDS`。

需要抽象/修改：

- `render_provider_base.py`：加入 remote job/progress/cancel/health contract，但保留現有 request/result backward compatibility。
- `render_provider_registry.py`：改由 factory/env 選 provider，禁止 hard-code secret或把 token放 payload。
- `final_beauty_render_tool.py`：只依 provider interface，不呼叫 ComfyUI-specific `validateOutputImage/returnProviderResult`。
- quality validation應抽成 shared service，讓 local與Colab result使用同一規則；目前邏輯在 `comfyui_render_provider.py:119-140`。
- `nova_runtime_config.py`：backend-only 讀取 Colab env；`agent_runtime.py /agent/config` 只能暴露 availability/capability，不可回 token/base credentials。

不可直接修改：已驗收的 NOVA 首頁視覺、Workbench layout、單一 Main Viewer、media fallback/terminal lock、GPT Brain prompt logic、現有 ComfyUI workflow與 quality thresholds；接入應在 provider boundary 後方。

最小接入：一個 factory + 一個 Colab provider/client/schema + notebook API；維持 `FinalBeautyRenderTool.run(message, emit)` 與前端 SSE names。最大風險是 Colab runtime/tunnel不穩、GPU memory/model cold start、job重複提交、token外洩、result下載中斷與 timeout 後 late result。斷線必須轉成 `RenderFailure(code="colab_disconnected", retryable=true)`，provider return/raise後由 FinalBeauty 發 `beauty_render_failed`，core 發 `task_failed`；不可降級成假 DONE。Token只在 Python backend request header中使用，永不寫 artifact、SSE、frontend config或URL query。

### 10.7 SSE、local playback、media 與真實操作感分界

- Backend SSE：真實 task/brain/plan/tool/provider/artifact/terminal資料。來源是 `NovaAgentTimeline` → `AgentEventStream` → FastAPI SSE。
- 根據真實資料的 UI event：`handleBackendAgentEvent()`、`updateOperationTimeline()`、`setWorkbenchDisplayPhase()`；render progress部分基於真 queue elapsed time估算（`comfyui_render_provider.py:81-95`），不是 sampler精確進度。
- local EventTarget：`AgentOrchestrator` / `AgentStatusStream`（`script.js:506-590`）是 frontend fallback bus，不代表 backend工作。
- polling：`AgentStatusStream.connectPolling()`（`511`）與 legacy `startAgentStatusPolling/pollAgentStatus`（`2041-2079`）存在，但正式 submit path 使用 SSE，audit未找到其啟動呼叫。
- fixed playback/local playback：`getAgentPlaybackDefinition()` 的固定 steps（`1734-1789`），由 `setTimeout` queue執行（`1792-1844`）；只在 offline/local fallback或相容流程使用，不是工具執行證據。
- media state：`NOVA_MEDIA_STATE` 是真實 browser media/fallback狀態，不是 Agent event（`script.js:788-789,1097-1127`）。

### 10.8 Cursor 真實程度

- 控制函式：`moveAgentCursor()`、`moveCursorTo()`、`clickCursorTarget()`、`runAgentCursorStep()`（`script.js:1247-1275`），以及 playback wrappers `moveAgentCursorToTarget/clickAgentTarget`（`1871-1872`）。
- 座標可來自 backend `state.cursor.x/y`（`1665`，百分比）或固定 playback point；selector模式會以真實 DOM bounding box計算視覺座標（`1253-1261`）。
- click沒有呼叫 `target.click()`；只加 `.is-agent-target` / `.is-clicking` classes（`1264-1270`）。
- drag：使用者真的拖 Three.js viewport會改 rotation（`script.js:289-341`的 pointer/render path），但 Agent cursor不會 dispatch pointer drag。
- typing：沒有寫入目標 form field；booking typed value是固定 HTML。
- 結論：Cursor 是視覺動畫，不是 browser/computer automation。可保留 DOM selector定位、CSS cursor layer、backend cursor payload；固定座標、假 click、假 typing需由未來 action-result events取代。

### 10.9 Browser / Computer / Codex adapters

| Adapter | 分類 | 實際行為 / SSE / error / safety | 保留判定 |
|---|---|---|---|
| `BrowserUseAdapter` | PLACEHOLDER | 不呼叫外部服務；固定發 `browser_action_started/completed(blocked)` 並回 waiting_for_user（`browser_use_adapter.py:1-4`）；無 exception handling；safe boundary字串 | 保留 contract，Phase 2實作前 descriptor持續 placeholder |
| `ComputerUseAdapter` | PLACEHOLDER | 不操作電腦；只發 started並回 waiting_for_user（`computer_use_adapter.py:1-4`）；無 completed/error event | 保留但不可宣稱 implemented |
| `CodexAdapter` | PARTIAL、目前 Router UNUSED | 可偵測 CLI、列/讀檔、以 `subprocess.run(shell=False, timeout=60)` 真執行 command/test（`codex_adapter.py:4-14`）；封鎖部分 git字串，但無 allowlist、return-code/stderr處理，`propose_patch/summarize_diff`部分 placeholder；本身不 emit SSE | 保留，使用前需更強 sandbox/command schema/observability |

前端 `BrowserAutomationEngine` 也是 `frontend_preview`（`script.js:424-436`）；`openOfficialSite()` 只有使用者觸發才 `window.open`，playback本身不操作網站。

### 10.10 Website Builder 與 File Workspace

| 能力 | 分類 | 證據 |
|---|---|---|
| backend `WebsiteBuilderTool` | REAL template file creation / PARTIAL generation | 寫三個實檔並回 paths/content（`agent_tools.py:26-39`）；內容固定 fashion template |
| frontend `WebsiteBuildEngine` | PARTIAL | keyword style解析、固定 site model、產生 HTML/CSS/JS strings（`script.js:439-478`） |
| backend `FileWorkspaceTool` | MOCK | 只回 `Workspace ready`，不讀寫（`agent_tools.py:41-43`） |
| frontend file storage | REAL browser-local | `FileWorkspaceEngine` 使用 localStorage、project/file CRUD（`script.js:481-490`） |
| file diff | NOT_IMPLEMENTED | 沒有 diff model/algorithm |
| preview rebuild | NOT_IMPLEMENTED | 沒有 bundler/rebuild；只有固定 live canvas |
| iframe preview | NOT_IMPLEMENTED/legacy shell | iframe保持 `about:blank`；網站 preview不是執行生成檔 |
| generated project storage | REAL但雙軌 | backend filesystem `generated_projects/` + frontend localStorage；沒有一致 source of truth |
| Save as Code | PARTIAL/REAL download | frontend產 code strings並以 browser download/export；backend也會寫固定 files；兩路未統一 |

### 10.11 Phase 2 最小安全範圍

必須新增：provider factory、Colab provider/client/schema、Colab notebook API，以及 remote render job/progress/failure/health models。

必須修改（最小）：`render_provider_base.py`、`render_provider_registry.py`、`final_beauty_render_tool.py`、`nova_runtime_config.py`；必要時 `agent_runtime.py` 只增加 backend-only provider capability。`comfyui_render_provider.py`應透過 shared quality service適配，但不可改變已驗收 quality semantics。

不可碰：`nova.html` 視覺、Workbench layout與 task canvas、Main Result Viewer single-view contract、`script.js` media state/fallback與 FAILED terminal lock、GPT Brain既有邏輯、Planner/Router（除非另立驗收）、既有 ComfyUI workflows。

Phase 2 最小成果應只有：Colab health → submit → poll progress → download → shared quality gate → 現有 render SSE → 現有 Viewer；加上 disconnect/timeout/token-redaction tests。不要同時新增 Playback Engine、重構 Workbench、實作 Browser/Computer/Codex或改 GPT planning。

### 10.12 Audit 結論

- 完整真實執行：FastAPI task/SSE、GPT API（有 key時）、tool orchestration、Website template filesystem write、ComfyUI local submit/poll/download/quality gate（環境可用時）、frontend SSE-driven Timeline/Viewer terminal。
- 部分完成：Planner/Brain coupling、Interior schema/3D、Codex、Website Builder/File Workspace、provider abstraction。
- Placeholder/local mock：Browser/Computer adapters、Code/Research/FileWorkspace tools、registry內 GPT/ComfyUI/Git/Render placeholders、booking automation、local playback/cursor actions。
- audit build：`npm run build` exit 0，Vite 36 modules transformed，SPA fallback成功。
- Phase 2 本章沒有開始。

## 11. Phase 2A — Colab Remote Render Contract

### 完成範圍

- `colab_render_schema.py`：新增嚴格 remote contracts：`RenderProviderHealth`、`RemoteRenderRequest`、`RemoteRenderJob`、`RemoteRenderProgress`、`RemoteRenderResult`、`RemoteRenderFailure`。Job status只允許 `queued/loading_model/sampling/decoding/saving/completed/failed/cancelled`。
- `colab_render_client.py`：新增 authenticated HTTP client，支援 `health/submit_render/get_job/download_result/cancel_job`、Bearer token、URL normalization、connect/read/poll timeout、HTTP/error mapping、JSON schema validation、Content-Type與最大下載限制。未使用 `verify=False`，不記錄 token。
- `colab_render_provider.py`：實作既有 `RenderProviderBase`，流程為 health → submit → poll → result metadata → image download → `generated_assets/interior_renders/{task_id}/final_render.png` → shared Quality Gate → `RenderResult`。
- `render_provider_factory.py`：由 backend env `NOVA_RENDER_PROVIDER=comfyui|colab` 選 provider；unknown value拋明確 `RenderProviderConfigurationError`，不自動 fallback假圖。
- `image_quality_gate.py`：把 ComfyUI 既有判定原樣抽成 `ImageQualityGate.validate()`。ComfyUI `validateOutputImage()` 現在 delegate共用 gate；仍要求可解碼、>10KB、有效尺寸、非全黑/全白/單色、finite mean，沒有降低門檻。
- `render_provider_base.py`：保留既有 `RenderRequest/RenderResult/check/render`，只補 `is_remote`、共用 `validate_output_image()` 與 `make_result()` helper，沒有建立第二套 provider base。
- `render_provider_registry.py`：使用 factory；ComfyUI unavailable時保留既有 local reference行為，Colab unavailable時不默默切 local假完成。
- `final_beauty_render_tool.py`：改用 base helpers；remote health unavailable直接產生正式 failed result；所有 `failed` result沿既有 `beauty_render_failed` + exception進 Agent `task_failed`，不由 provider設定前端 DONE。
- `nova_runtime_config.py`：加入 provider、Colab base URL與四個 timeout/poll設定。Bearer token仍只由 client在 backend environment讀取，不進 config dataclass repr/API。
- `agent_runtime.py`：startup記錄 provider name、sanitized host、timeout、health status；`/agent/config` 只新增 render provider name，沒有 token或敏感 query。

### Environment variables

```text
NOVA_RENDER_PROVIDER
NOVA_COLAB_BASE_URL
NOVA_COLAB_TOKEN
NOVA_COLAB_CONNECT_TIMEOUT_SECONDS
NOVA_COLAB_READ_TIMEOUT_SECONDS
NOVA_COLAB_POLL_INTERVAL_SECONDS
NOVA_COLAB_MAX_POLL_SECONDS
```

### Error mapping

Client/provider支援：`COLAB_CONFIG_MISSING`、`COLAB_UNREACHABLE`、`COLAB_AUTH_FAILED`、`COLAB_URL_EXPIRED`、`COLAB_BAD_RESPONSE`、`COLAB_JOB_FAILED`、`COLAB_JOB_TIMEOUT`、`COLAB_RESULT_INVALID`、`COLAB_RESULT_DOWNLOAD_FAILED`。Failure metadata不含 Authorization header/token。Colab missing config時 runtime可啟動，health=`unavailable`；任務執行會發 `beauty_render_failed` 並進 FAILED，不會發 completed或切換假圖。

### Tests

- 新增 `tests/test_colab_render_schema.py`、`tests/test_colab_render_client.py`、`tests/test_colab_render_provider.py`、`tests/test_render_provider_factory.py`，以及本機 `ThreadingHTTPServer` fixture。
- 22 tests passed：health success/auth failure/missing config、submit、完整 state sequence、failed/timeout/expired URL、invalid JSON、HTML/non-image result、black image、valid image、token log redaction、factory三分支、FinalBeauty failure lifecycle與 ComfyUI factory regression。
- `python -m pytest -q` 對全 repo額外收集兩個既有 `tools/*_test.py`，因環境未安裝 `cv2` 在 collection階段停止；Phase 2A 的 `tests/` 全部通過，此缺口不是本次 source regression。
- `python -m compileall .` exit 0。
- `node --check script.js`（UTF-8 module stdin等價執行）exit 0；`script.js` 未修改。
- `npm run build` exit 0，Vite 36 modules，SPA fallback成功。

### 尚未完成

- 尚未建立真正 Colab GPU notebook/FastAPI worker、公開 tunnel、模型下載或 live GPU render。
- 尚未執行真 Colab連線；本階段全部 remote測試使用本機 mock HTTP server，沒有預生成完成圖片。
- 前端、NOVA視覺、Workbench、Main Viewer、Cursor、local playback、GPT Brain、Planner、Tool Router與既有 workflow JSON均未修改。
- Phase 2B 沒有開始。

## 12. Phase 2A.5 — Fix cv2 Pytest Collection Blocker

- 根因：pytest 預設收集 `*_test.py`，因此 collection 階段會 import `tools/cut_transition_test.py` 與 `tools/talking_emphasis_transition_test.py`。兩個 optional 離線影片轉場工具原先在 module scope import `cv2`，缺少 OpenCV 的環境會在實際測試收集完成前失敗。這兩個模組不屬於 `agent_runtime` 啟動必要模組，只屬於 vision/video optional tooling。
- 修復前受影響 import：`tools/cut_transition_test.py:5`、`tools/talking_emphasis_transition_test.py:4`。
- 修復方式：改為明確的 `require_cv2()` lazy dependency guard，只在實際執行影像處理函式時載入。缺少 OpenCV 時會拋出附安裝指引的 `OptionalDependencyUnavailable`，不會阻擋 pytest collection 或 Agent Runtime 啟動。
- 後續 collection blocker：延後 OpenCV 載入後，同兩個 optional 模組另暴露 module-level `imageio_ffmpeg` 缺失；同樣改為各自 `write_video()` 內的明確 lazy guard，不吞錯誤、不產生假成功。
- 依賴決策：未新增 `opencv-python-headless`，因為這些程式是 optional offline video tools，而非正式 runtime dependency。
- Phase 2A regression：schema、client、provider、factory 共 22/22 passed。
- 全 repo pytest：22 passed，無 collection error。
- 驗證：`python -m compileall .` passed；`node --check script.js` passed；`npm run build` exit 0，36 modules transformed。
- Phase 2A 可建立 checkpoint；Phase 2B 尚未開始。

## 13. Phase 2B — Google Colab Live GPU Render

### Live runtime

- Colab runtime：Tesla T4（nominal 16 GB VRAM；實際 free VRAM 由 Notebook Runtime Check cell 動態輸出，不寫死）。
- 模型：`stabilityai/stable-diffusion-xl-base-1.0`，官方 model card 為 CreativeML Open RAIL++-M；Diffusers `StableDiffusionXLPipeline`、FP16、safetensors。
- 設定：Tesla T4 使用 1024×576、30 steps、guidance 6.5、attention slicing、VAE slicing；低於 14 GB VRAM 時改 768×432 並啟用 sequential CPU offload，絕不 CPU fallback 假完成。
- Tunnel：Cloudflare Quick Tunnel 臨時 HTTPS URL，Bearer 驗證成功；URL/token 未寫入 source、report 或 Git，僅存在 ignored `.env`。
- API：authenticated `GET /health`、`POST /render`、`GET /jobs/{job_id}`、`GET /jobs/{job_id}/result`、`GET /result/{job_id}`、`POST /jobs/{job_id}/cancel`，另保留 Phase 2A client 相容的 `DELETE /jobs/{job_id}`。
- Health 實測：HTTP 200，`available=true`、`gpu_available=true`、`model_loaded=true`、GPU=`Tesla T4`。

### First independent live render

- 第一次由本機 Phase 2A client 提交並完整下載的成功 job：`1ec31d7eddfe4e3396f695b5f50fbfb8`；task/job identity一致。
- 狀態：queued → loading_model → sampling → decoding → saving → completed。
- 模型輸出：1024×576，seed `1619228786`，GPU generation 24.15 秒，PNG 857,138 bytes。
- Quality Gate：pass；可解碼、尺寸有效、非全黑、非全白、非單色、mean為 finite。Artifact 位於 ignored `generated_assets/phase2b_live/`，不是預生成或舊圖片。

### NOVA end-to-end

- Agent Runtime provider=`colab`；DeterministicFallback 以明確 `interior design`/`architectural render` prompt 選擇室內工具，FinalBeautyRenderTool 使用 `ColabRenderProvider`。
- 後端成功 task `656ed3e78ae046f5937d755a51848d6e`，remote job `208f94e067dc47ada939206b062ed174`，640×384，generation 9.26 秒，Quality Gate pass，backend lifecycle=`completed`。
- Playwright 首頁端到端成功 task `bcd0edd9ba314e51847511d365bc1fe4`：單一 Main Result Viewer、phase=`final_image`、lifecycle=`DONE`、terminal=`true`、image load=`loaded`、preview visible、640×384、badge=`DONE`。
- Console errors=0、Page errors=0、asset 404=0；Return to NOVA成功。DONE只在本次圖片 load completed後出現。
- 中文-only prompt在既有 DeterministicFallback可能落入 general assistant；前端固定入口也需要 `render/3d/concept` 關鍵字才能選 design3d canvas。本階段遵守限制，未修改 GPT Brain、Planner、Router或 `script.js`，驗收 prompt明確包含 `interior design` 與 `architectural render`。

### Failure matrix

- 26 tests passed。已覆蓋 Notebook/tunnel unreachable、expired URL、wrong token、GPU unavailable、remote job failed、job timeout、HTML result、corrupt image、black image、missing config，以及 token log redaction。
- 所有 provider failure均回傳辨識碼或 unavailable狀態，不產生 ready/completed artifact、不切 local假圖；FinalBeauty failure沿既有 `beauty_render_failed` 進 task FAILED。
- 前端 terminal lock沿 Phase 0.5/0.6既有驗收保持不變；本階段未修改 Viewer、Workbench、media/terminal lock或 Quality Gate。

### Files and remaining scope

- 新增 `colab_notebooks/nova_colab_render_backend.ipynb`（14個清楚階段）與 `colab_notebooks/README.md`。
- `colab_render_client.py` 補讀 `NOVA_COLAB_MAX_RESULT_BYTES`；新增相應 failure/limit regression tests。
- 尚未完成的 Agent 模組仍包括動態 Room Schema、Moodboard、Zoning、家具配置、材質/燈光規劃、Browser/Computer adapters，以及真實 Cursor DOM操作。
- Phase 3 前置條件：Phase 2B diff/security review、重跑完整 tests/build、建立獨立 checkpoint；Cloudflare URL每次 Colab重啟都必須更新，不能視為永久 server。
- Phase 3 尚未開始；本階段未 commit、push 或 tag。
