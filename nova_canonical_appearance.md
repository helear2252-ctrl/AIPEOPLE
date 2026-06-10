# NOVA AI Canonical Appearance Style Guide

本文件定義並規範了 **NOVA AI** 的官方標準外觀形象（Canonical Appearance）。未來所有與 NOVA 相關的專案與介面（如 **GitHub Pages**、**Streamlit 應用**、**Digital Human Workspace**、以及 **Chat Interface**）均應遵循此視覺標準。

---

## 1. 核心形象定義 (Official Avatar)

NOVA 的官方預設形象為一位具有專業感、親和力與智慧感的女性數位助理。

![NOVA Canonical Avatar](assets/nova_avatar.png)

* **人物外型 (Character Features)**：
  * **族裔與年齡**：年輕的東亞女性（East Asian Female）。
  * **髮型**：深色（黑色或深褐）長捲髮，自然垂肩。
  * **表情**：溫暖、自信且微帶親和力的微笑，眼神直視使用者，建立信任感。
  * **服裝與配飾**：深色（黑色或深藍色）專業西裝外套（Blazer），內搭白色 V 領襯衫或上衣。配戴細緻極簡的銀色墜飾項鍊。

---

## 2. 場景與光影標準 (Scene & Lighting)

NOVA 所在的背景並非單調的純色，而是一個具有層次感與深度感的商務辦公場景：

* **背景環境 (Background)**：
  * 高階行政辦公室的角落（Corner Office），透過大片落地玻璃窗可看見夜晚的都市天際線（City Skyline at Night）。
  * 窗外燈光應有顯著的淺景深模糊效果（Bokeh / Depth of Field Blur），使數位人主體顯得更加突出。
  * 室內裝飾應包含溫暖的檯燈、深色桌椅，以及簡約的藝術畫作。
* **光影風格 (Lighting Aesthetics)**：
  * **主體光 (Key Light)**：前方明亮柔和的白光，均勻照亮面部與表情。
  * **輪廓光 (Rim Light)**：右側檯燈散發出溫暖的金色/琥珀色光源，照亮髮絲與肩膀邊緣，與背景的冷調形成鮮明對比。
  * **對比風格**：經典的**冷暖雙色溫對比**（深藍色背景 vs. 暖金黃色檯燈光暈）。

---

## 3. 標準色彩系統 (Color Palette)

介面設計應呼應場景色彩，採取深色科技毛玻璃風格（Sci-Fi Glassmorphism）：

| 色樣 | 顏色名稱            | HEX 代碼  | 建議用途                               |
| :--- | :------------------ | :-------- | :------------------------------------- |
| ⬛    | **Midnight Dark**   | `#080C14` | 頁面主背景色、極深底色                 |
| 🌌    | **Deep Space Blue** | `#101726` | 卡片背景、面板背景（半透明）           |
| 🔹    | **Electric Cyan**   | `#00A3FF` | 主按鈕、高亮狀態、發光線條、動態音波   |
| 🔸    | **Warm Amber**      | `#FFB703` | 警告提示、檯燈光暈點綴色               |
| ◽    | **Clean White**     | `#FFFFFF` | 主要文字、主要圖示（配合不同不透明度） |

---

## 4. UI 與視覺元素規範 (UI & Layout Guidelines)

所有 NOVA 介面在開發時，皆須符合以下 UI 規範：

### A. 毛玻璃面板 (Glassmorphism Panels)
所有浮動卡片、控制台與對話框，應使用半透明毛玻璃特效：
```css
.glass-panel {
  background: rgba(16, 23, 38, 0.6);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 163, 255, 0.05);
}
```

### B. 按鈕設計 (Buttons)
* **主要行動按鈕 (Primary CTA)**：如 `Start Chat`，使用帶有藍色漸層（`#0077B6` 到 `#00A3FF`）的實色按鈕，滑鼠懸停時觸發發光擴散效果（Glow effect）。
* **次要按鈕 (Secondary CTA)**：半透明描邊，滑鼠懸停時背景微幅變亮。

### C. 語音波形 (Audio Waveform)
* 用於展示 NOVA 正在聆聽或說話的動態波形，應呈對稱分佈。
* 顏色使用 **Electric Cyan (`#00A3FF`)**，並配合漸層與發光效果。
* 運動狀態應為平滑的波浪形起伏，避免生硬的方塊跳動。

### D. 對話字幕 (Subtitles)
* 字幕字體應使用簡約的無襯線字體（如 `Inter` 或 `Segoe UI`）。
* 字幕背景需有微弱的陰影或漸層，確保在各種複雜的背景下皆有極佳的可讀性。

---

## 5. 各平台套用建議 (Platform Guidelines)

* **Streamlit App**：使用自訂 CSS 覆寫預設佈局，將 NOVA Avatar 置於側邊欄或中央，並以 `#101726` 作為背景色。
* **GitHub Pages**：首頁首屏應 100% 寬高填滿，呈現沉浸式 Digital Human 形象，底層置入對話與功能按鈕。
* **Chat Interface**：NOVA 形象置於畫面上半部或右側，對話氣泡使用半透明毛玻璃質感。
