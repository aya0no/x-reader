// ==UserScript==
// @name         X Reader Accordion v7.0.4-step11-light
// @namespace    local.x-reader-accordion
// @version      7.0.4.13.2
// @description  専用の起動画面、表示切替、左右スワイプに対応したX Readerです。
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/aya0no/x-reader/main/x-reader.meta.js
// @downloadURL  https://raw.githubusercontent.com/aya0no/x-reader/main/x-reader.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const ROOT_ID = "xra-root";
  const STYLE_ID = "xra-style";
  const TOGGLE_ID = "xra-toggle";
  const CARD_ATTR = "data-xra-card";
  const DETAIL_ROOT_ID = "xra-detail-root";
  const BOOKMARKS_LIST_ID = "xra-bookmarks-list";
  const MEDIA_MODAL_ID = "xra-media-modal";
  const VIEW_TOGGLE_ID = "xra-view-toggle";
  const VIEW_MODE_KEY = "xra-feed-view-mode";
  const BOOT_STYLE_ID = "xra-boot-style";
  const BOOTING_CLASS = "xra-booting";
  const SWIPE_MIN_DISTANCE = 58;
  const SWIPE_EDGE_GUARD = 24;
  const SWIPE_MAX_DURATION = 800;

  let bootRemovalTimer = null;
  const shouldShowBootScreen = () => {
    if (/\/status\/\d+/.test(location.pathname)) return true;
    try { return localStorage.getItem("xra-enabled") !== "false"; } catch { return true; }
  };
  const hideBootScreen = () => {
    clearTimeout(bootRemovalTimer);
    bootRemovalTimer = null;
    document.documentElement?.classList.remove(BOOTING_CLASS);
    document.getElementById(BOOT_STYLE_ID)?.remove();
  };
  const showBootScreen = () => {
    const documentElement = document.documentElement;
    if (!documentElement || !shouldShowBootScreen()) return;
    const style = document.createElement("style");
    style.id = BOOT_STYLE_ID;
    style.textContent = `
      html.${BOOTING_CLASS}, html.${BOOTING_CLASS} body { background: #f7f7f5 !important; }
      html.${BOOTING_CLASS} body { overflow: hidden !important; }
      html.${BOOTING_CLASS} body > * { visibility: hidden !important; }
      html.${BOOTING_CLASS}::before {
        content: "X Reader";
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        padding-bottom: 26px;
        background: #f7f7f5;
        color: #171717;
        font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", sans-serif;
        font-size: 15px;
        font-weight: 650;
        letter-spacing: .12em;
      }
      html.${BOOTING_CLASS}::after {
        content: "";
        position: fixed;
        top: calc(50% + 21px);
        left: calc(50% - 38px);
        z-index: 2147483647;
        width: 76px;
        height: 1px;
        background: linear-gradient(90deg, #d8d8d4 0%, #d8d8d4 38%, #555 50%, #d8d8d4 62%, #d8d8d4 100%);
        background-size: 220% 100%;
        animation: xra-boot-line 1.05s ease-in-out infinite;
      }
      @keyframes xra-boot-line { from { background-position: 100% 0; } to { background-position: -100% 0; } }
      @media (prefers-reduced-motion: reduce) { html.${BOOTING_CLASS}::after { animation: none; } }
    `;
    documentElement.classList.add(BOOTING_CLASS);
    documentElement.appendChild(style);
    bootRemovalTimer = setTimeout(hideBootScreen, 7000);
  };

  showBootScreen();

  const CONFIG = {
    fontSize: 12.5,
    lineHeight: 1.5,
    imageWidth: 92,
    imageHeight: 72,
    monochrome: true,
    sections: [
      { id: "following", label: "ホーム", url: "https://x.com/home" },
      { id: "list1", label: "1", url: "https://x.com/i/lists/2082771236799840538" },
      { id: "list2", label: "2", url: "https://x.com/i/lists/962319313385308166" },
      { id: "stocks", label: "株", url: "https://x.com/i/lists/1581596744466321408" },
      { id: "recipes", label: "レシピ", url: "https://x.com/i/lists/1718964496667156737" }
    ]
  };

  let activeSectionId = "following";
  let renderTimer = null;
  let preloadLocked = false;

  const css = `
    #${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483000; overflow-y: auto; background: #f7f7f5; color: #171717; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", sans-serif; -webkit-overflow-scrolling: touch; }
    #${ROOT_ID} * { box-sizing: border-box; }
    .xra-header { position: fixed; top: 0; right: 0; left: 0; z-index: 20; display: flex; align-items: center; min-height: 46px; padding: 7px 10px; background: rgba(247,247,245,.96); border-bottom: 1px solid #ddd; backdrop-filter: blur(12px); }
    .xra-tabs { display: flex; gap: 6px; width: 100%; max-width: 680px; margin: 0 auto; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
    .xra-tabs::-webkit-scrollbar { display: none; }
    .xra-section-tab { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; min-height: 31px; padding: 0 11px; border: 1px solid #cececa; border-radius: 16px; background: #fff; color: #444; font-size: 11.5px; font-weight: 650; white-space: nowrap; }
    .xra-section-tab[data-active="true"] { border-color: #171717; background: #171717; color: #fff; }
    .xra-section-tab:active { transform: scale(.97); }
    .xra-sections { max-width: 680px; margin: 0 auto; padding-top: 46px; }
    .xra-section { display: none; }
    .xra-section[data-open="true"] { display: block; }
    .xra-content { display: block; }
    .xra-list { padding: 8px 0 76px; }
    .xra-card { position: relative; display: grid; grid-template-columns: minmax(0,1fr); gap: 8px; margin: 0 10px 8px; padding: 13px 14px; border: 1px solid #dededb; border-radius: 13px; background: #fff; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .xra-card.has-media { grid-template-columns: minmax(0,1fr) ${CONFIG.imageWidth}px; }
    .xra-main { min-width: 0; padding-right: 28px; }
    .xra-meta { display: flex; gap: 5px; min-height: 14px; margin-bottom: 3px; overflow: hidden; white-space: nowrap; }
    .xra-handle { overflow: hidden; font-size: 11.5px; font-weight: 650; text-overflow: ellipsis; }
    .xra-time { flex: 0 0 auto; color: #777; font-size: 10.5px; }
    .xra-text { display: -webkit-box; overflow: hidden; font-size: ${CONFIG.fontSize}px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; -webkit-box-orient: vertical; -webkit-line-clamp: 7; }
    .xra-media-list { width: ${CONFIG.imageWidth}px; height: ${CONFIG.imageHeight}px; align-self: start; overflow: hidden; border-radius: 8px; background: #eee; }
    .xra-media { display: none; width: 100%; height: 100%; padding: 0; overflow: hidden; border: 1px solid #d5d5d2; border-radius: 8px; background: #eee; cursor: zoom-in; }
    .xra-media:first-child { display: block; }
    .xra-media img { display: block; width: 100%; height: 100%; object-fit: cover; ${CONFIG.monochrome ? "filter: grayscale(1);" : ""} }
    .xra-link-card { display: block; width: 100%; margin-top: 8px; padding: 7px 8px; overflow: hidden; border: 1px solid #d8d8d5; border-radius: 9px; background: #fafaf8; color: #171717; text-align: left; }
    .xra-link-site { overflow: hidden; color: #777; font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
    .xra-link-title { display: -webkit-box; margin-top: 1px; overflow: hidden; font-size: 11.5px; font-weight: 650; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .xra-link-summary { display: -webkit-box; margin-top: 2px; overflow: hidden; color: #666; font-size: 10.5px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .xra-card-bookmark { position: absolute; top: 10px; right: 10px; display: flex; align-items: center; justify-content: center; width: 25px; height: 25px; padding: 0; border: 1px solid #cfcfcb; border-radius: 50%; background: rgba(255,255,255,.94); color: #333; }
    .xra-card.has-media .xra-card-bookmark { top: 12px; right: calc(${CONFIG.imageWidth}px + 22px); }
    .xra-card-bookmark svg { display: block; width: 13px; height: 13px; fill: currentColor; }
    .xra-card-bookmark[data-saved="true"] { border-color: #171717; background: #171717; color: #fff; }
    .xra-card-footer { display: none; }
    #${ROOT_ID}[data-view-mode="comfortable"] { background: #f3f3f1; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-list { padding: 8px 0 82px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-card { display: block; margin: 0 0 8px; padding: 18px 20px 22px; border: 0; border-bottom: 1px solid #dcdcd9; border-radius: 0; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-main { padding-right: 40px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-meta { min-height: 18px; margin-bottom: 11px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-handle { font-size: 13.5px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-time { display: none; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-text { display: block; overflow: visible; font-size: 15px; line-height: 1.65; -webkit-line-clamp: unset; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-link-card { margin-top: 13px; padding: 11px 12px; border-radius: 10px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-link-site { font-size: 10.5px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-link-title { margin-top: 3px; font-size: 14px; line-height: 1.45; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-link-summary { margin-top: 4px; font-size: 12px; line-height: 1.45; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); width: 100%; height: auto; margin-top: 15px; gap: 8px; overflow: visible; border-radius: 0; background: transparent; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media-list[data-count="1"] { grid-template-columns: 1fr; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media { display: block; width: 100%; height: auto; aspect-ratio: 1; border-radius: 10px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media-list[data-count="1"] .xra-media { aspect-ratio: 4/3; max-height: 440px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media-list[data-count="2"] .xra-media { aspect-ratio: 3/4; max-height: 460px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-media img { filter: none; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-card-bookmark,
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-card.has-media .xra-card-bookmark { top: 15px; right: 18px; width: 34px; height: 34px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-card-bookmark svg { width: 17px; height: 17px; }
    #${ROOT_ID}[data-view-mode="comfortable"] .xra-card-footer { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; margin-top: 13px; color: #666; }
    .xra-card-like { font-size: 12px; line-height: 1.35; }
    .xra-card-date { font-size: 11px; line-height: 1.35; }
    #${MEDIA_MODAL_ID} { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center; padding: 44px 18px calc(44px + env(safe-area-inset-bottom, 0px)); background: rgba(0,0,0,.76); }
    #${MEDIA_MODAL_ID} img { display: block; max-width: 88vw; max-height: 72vh; border: 1px solid #777; border-radius: 10px; background: #222; object-fit: contain; ${CONFIG.monochrome ? "filter: grayscale(1);" : ""} }
    #${MEDIA_MODAL_ID}[data-view-mode="comfortable"] img { filter: none; }
    .xra-media-close { position: absolute; top: calc(12px + env(safe-area-inset-top, 0px)); right: 14px; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid #888; border-radius: 50%; background: rgba(20,20,20,.86); color: #fff; font-size: 24px; font-weight: 300; line-height: 1; }
    .xra-message { padding: 22px 14px; color: #777; font-size: 11px; line-height: 1.6; text-align: center; }
    #${TOGGLE_ID} {
      position: fixed;
      right: 12px;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid #bdbdbd;
      border-radius: 50%;
      background: rgba(255,255,255,.96);
      color: #222;
      font-size: 0;
      box-shadow: 0 4px 14px rgba(0,0,0,.14);
      backdrop-filter: blur(12px);
      -webkit-tap-highlight-color: transparent;
    }

    #${TOGGLE_ID} svg {
      display: block;
      width: 20px;
      height: 20px;
      color: currentColor !important;
      fill: none !important;
      stroke: currentColor !important;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #${TOGGLE_ID}:active {
      transform: scale(.96);
    }

    #${VIEW_TOGGLE_ID} {
      position: fixed;
      right: 116px;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid #bdbdbd;
      border-radius: 50%;
      background: rgba(255,255,255,.96);
      color: #222;
      font-size: 0;
      box-shadow: 0 4px 14px rgba(0,0,0,.14);
      backdrop-filter: blur(12px);
      -webkit-tap-highlight-color: transparent;
    }

    #${VIEW_TOGGLE_ID} svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; }
    #${VIEW_TOGGLE_ID}[data-mode="comfortable"] { border-color: #171717; background: #171717; color: #fff; }
    #${VIEW_TOGGLE_ID}:active { transform: scale(.96); }

    /* Step4: 判定済みのメイン投稿だけ見た目を変更 */
    html.xra-detail-page,
    html.xra-detail-page body {
      background: #f7f7f7 !important;
      color: #171717 !important;
    }

    html.xra-detail-page article.xra-detail-main {
      margin: 0 !important;
      padding: 14px 12px 18px !important;
      border: 0 !important;
      background: #f7f7f7 !important;
      color: #171717 !important;
      box-shadow: none !important;
    }

    html.xra-detail-page article.xra-detail-main * {
      border-color: #dedede !important;
    }

    /* 名前とIDを同じ行へ */
    html.xra-detail-page article.xra-detail-main [data-testid="User-Name"] {
      display: flex !important;
      align-items: center !important;
      min-width: 0 !important;
      margin: 0 !important;
    }

    html.xra-detail-page article.xra-detail-main [data-testid="User-Name"] > div,
    html.xra-detail-page article.xra-detail-main [data-testid="User-Name"] > div > div {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 6px !important;
      min-width: 0 !important;
    }

    html.xra-detail-page article.xra-detail-main [data-testid="User-Name"] span {
      font-size: 12px !important;
      line-height: 1.3 !important;
    }

    html.xra-detail-page article.xra-detail-main [data-testid="Tweet-User-Avatar"] {
      width: 34px !important;
      height: 34px !important;
      margin-right: 8px !important;
    }

    /* 画像以外をモノクロへ */
    html.xra-detail-page article.xra-detail-main [data-testid="Tweet-User-Avatar"] img {
      filter: grayscale(1) !important;
    }

    html.xra-detail-page article.xra-detail-main svg {
      color: #666 !important;
      fill: currentColor !important;
    }

    html.xra-detail-page article.xra-detail-main a,
    html.xra-detail-page article.xra-detail-main a span {
      color: #555 !important;
    }

    html.xra-detail-page article.xra-detail-main [data-testid="tweetText"],
    html.xra-detail-page article.xra-detail-main [data-testid="tweetText"] span {
      color: #171717 !important;
      font-size: 14px !important;
      line-height: 1.62 !important;
      letter-spacing: .005em !important;
    }

    /* 投稿画像・動画は大きくカラーのまま */
    html.xra-detail-page article.xra-detail-main [data-testid="tweetPhoto"],
    html.xra-detail-page article.xra-detail-main [data-testid="videoPlayer"] {
      width: 100% !important;
      max-width: none !important;
      margin-top: 12px !important;
      border-radius: 10px !important;
      overflow: hidden !important;
    }

    html.xra-detail-page article.xra-detail-main [data-testid="tweetPhoto"] img,
    html.xra-detail-page article.xra-detail-main [data-testid="videoPlayer"] video {
      width: 100% !important;
      height: auto !important;
      max-height: none !important;
      object-fit: contain !important;
      filter: none !important;
    }

    /* Step5: メイン投稿以外・返信欄・標準操作を非表示 */
    html.xra-detail-page .xra-detail-hidden,
    html.xra-detail-page .xra-native-action-group,
    html.xra-detail-page .xra-native-meta-row,
    html.xra-detail-page article.xra-detail-main [data-testid="reply"],
    html.xra-detail-page article.xra-detail-main [data-testid="retweet"],
    html.xra-detail-page article.xra-detail-main [data-testid="like"],
    html.xra-detail-page article.xra-detail-main [data-testid="unlike"],
    html.xra-detail-page article.xra-detail-main [data-testid="bookmark"],
    html.xra-detail-page article.xra-detail-main [data-testid="removeBookmark"],
    html.xra-detail-page article.xra-detail-main [data-testid="share"],
    html.xra-detail-page article.xra-detail-main a[href*="/analytics"],
    html.xra-detail-page [data-testid="tweetTextarea_0"],
    html.xra-detail-page [data-testid="toolBar"],
    html.xra-detail-page [aria-label="返信をポスト"],
    html.xra-detail-page [aria-label="Post your reply"],
    html.xra-detail-page [data-testid="BottomBar"],
    html.xra-detail-page nav[aria-label="メインメニュー"],
    html.xra-detail-page nav[aria-label="Primary"] {
      display: none !important;
    }

    html.xra-detail-page #${TOGGLE_ID} {
      display: none !important;
    }

    .xra-detail-summary {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 12px;
      padding: 0 2px;
      color: #777;
      font-size: 11px;
      line-height: 1.4;
    }

    .xra-detail-like {
      color: #444;
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    /* Step6: X内部の配置に依存しない専用詳細画面 */
    #${DETAIL_ROOT_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483200;
      overflow-y: auto;
      background: #f7f7f7;
      color: #171717;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
        "Yu Gothic UI", "Yu Gothic", sans-serif;
      font-size: ${CONFIG.fontSize}px;
      line-height: ${CONFIG.lineHeight};
      -webkit-overflow-scrolling: touch;
    }

    #${DETAIL_ROOT_ID},
    #${DETAIL_ROOT_ID} * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
        "Yu Gothic UI", "Yu Gothic", sans-serif !important;
      font-style: normal !important;
    }

    .xra-detail-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      min-height: 46px;
      padding: 7px 10px;
      border-bottom: 1px solid #ddd;
      background: rgba(247,247,247,.96);
      backdrop-filter: blur(12px);
    }

    .xra-detail-back {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 32px;
      margin-right: 6px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #171717;
      font-size: 24px;
      line-height: 1;
    }

    .xra-detail-title {
      font-size: 14px;
      font-weight: 700;
    }

    .xra-detail-sheet {
      width: 100%;
      max-width: 720px;
      min-height: calc(100vh - 46px);
      margin: 0 auto;
      padding: 14px 12px 110px;
      background: #f7f7f7;
    }

    .xra-detail-profile {
      display: flex;
      align-items: center;
      min-width: 0;
      margin-bottom: 12px;
    }

    .xra-detail-avatar {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      margin-right: 8px;
      overflow: hidden;
      border-radius: 50%;
      background: #e6e6e6;
    }

    .xra-detail-avatar img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: grayscale(1);
    }

    .xra-detail-identity {
      display: flex;
      align-items: baseline;
      min-width: 0;
      gap: 6px;
      white-space: nowrap;
    }

    .xra-detail-name {
      overflow: hidden;
      color: #222;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.3;
      text-overflow: ellipsis;
    }

    .xra-detail-handle {
      overflow: hidden;
      color: #777;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.3;
      text-overflow: ellipsis;
    }

    .xra-detail-body {
      color: #171717;
      font-size: ${CONFIG.fontSize}px;
      font-weight: 400;
      line-height: ${CONFIG.lineHeight};
      letter-spacing: normal;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .xra-detail-media-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-top: 12px;
    }

    .xra-detail-media-list[data-count="2"],
    .xra-detail-media-list[data-count="3"],
    .xra-detail-media-list[data-count="4"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .xra-detail-media {
      width: 100%;
      overflow: hidden;
      border: 1px solid #ddd;
      border-radius: 10px;
      background: #eee;
    }

    .xra-detail-media img {
      display: block;
      width: 100%;
      height: auto;
      max-height: none;
      object-fit: contain;
      filter: none;
    }

    .xra-detail-footer {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      margin-top: 10px;
      padding: 0 2px;
    }

    .xra-detail-like {
      color: #444;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.3;
    }

    .xra-detail-date {
      color: #777;
      font-size: 10px;
      font-weight: 400;
      line-height: 1.3;
    }

    .xra-detail-loading {
      padding: 32px 14px;
      color: #777;
      font-size: 11px;
      text-align: center;
    }

    html.xra-detail-page #${TOGGLE_ID} {
      display: none !important;
    }

    .xra-detail-bookmark {
      position: fixed;
      right: 14px;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      padding: 0;
      border: 1px solid #bdbdbd;
      border-radius: 50%;
      background: rgba(255,255,255,.97);
      color: #222;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
        "Yu Gothic UI", "Yu Gothic", sans-serif !important;
      font-size: 0;
      line-height: 1;
      box-shadow: 0 4px 14px rgba(0,0,0,.14);
      backdrop-filter: blur(12px);
      -webkit-tap-highlight-color: transparent;
    }

    .xra-detail-bookmark svg {
      display: block;
      width: 22px;
      height: 22px;
      color: currentColor !important;
      fill: currentColor !important;
    }

    .xra-detail-bookmark svg path {
      fill: currentColor !important;
    }

    .xra-detail-bookmark[data-saved="true"] {
      border-color: #171717;
      background: #171717;
      color: #fff;
    }

    .xra-detail-bookmark:active {
      transform: scale(.96);
    }

    #${BOOKMARKS_LIST_ID} {
      position: fixed;
      right: 64px;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid #bdbdbd;
      border-radius: 50%;
      background: rgba(255,255,255,.96);
      color: #222;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
        "Yu Gothic UI", "Yu Gothic", sans-serif !important;
      font-size: 0;
      line-height: 1;
      box-shadow: 0 4px 14px rgba(0,0,0,.14);
      backdrop-filter: blur(12px);
      -webkit-tap-highlight-color: transparent;
    }

    #${BOOKMARKS_LIST_ID} svg {
      display: block;
      width: 19px;
      height: 19px;
      flex: 0 0 auto;
      color: currentColor !important;
      fill: currentColor !important;
    }

    #${BOOKMARKS_LIST_ID} svg path {
      fill: currentColor !important;
    }

    #${BOOKMARKS_LIST_ID}:active {
      transform: scale(.98);
    }

    html.xra-detail-page #${BOOKMARKS_LIST_ID},
    html.xra-detail-page #${VIEW_TOGGLE_ID} {
      display: none !important;
    }
  `;

  const addStyle = () => { if (!document.getElementById(STYLE_ID)) { const style = document.createElement("style"); style.id = STYLE_ID; style.textContent = css; document.documentElement.appendChild(style); } };
  const textOf = element => (element?.textContent || "").trim();
  const getHandle = article => { const userName = article.querySelector('[data-testid="User-Name"]'); if (!userName) return ""; return Array.from(userName.querySelectorAll("span")).map(textOf).find(text => text.startsWith("@")) || ""; };
  const getTime = article => { const time = article.querySelector("time"); return time ? textOf(time) : ""; };
  const getText = article => { const tweetText = article.querySelector('[data-testid="tweetText"]'); return (tweetText?.innerText || tweetText?.textContent || "").trim(); };
  const getPostUrl = article => { const link = article.querySelector('a[href*="/status/"]'); if (!link) return ""; const href = link.getAttribute("href") || ""; return href.startsWith("http") ? href : `${location.origin}${href}`; };
  const getMediaSources = article => {
    const candidates = [
      ...article.querySelectorAll('[data-testid="tweetPhoto"] img[src]'),
      ...article.querySelectorAll("video[poster]")
    ];
    const sources = [];
    for (const media of candidates) {
      if (media.closest('[data-testid="Tweet-User-Avatar"], [data-testid="UserAvatar-Container"]')) continue;
      const source = media.tagName === "VIDEO" ? media.poster || media.getAttribute("poster") || "" : media.currentSrc || media.src || media.getAttribute("src") || "";
      if (!source || source.includes("profile_images") || source.includes("emoji")) continue;
      sources.push(source);
    }
    const styledMedia = article.querySelector('[data-testid="videoPlayer"][style*="background-image"], [data-testid="videoPlayer"] [style*="background-image"]');
    const background = styledMedia?.style?.backgroundImage || "";
    const backgroundSource = background.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
    if (backgroundSource) sources.push(backgroundSource);
    return Array.from(new Set(sources));
  };
  const getLinkPreview = article => {
    const wrapper = article.querySelector('[data-testid="card.wrapper"]');
    if (!wrapper) return null;
    const isUsableLink = href => {
      if (!href) return false;
      try {
        const url = new URL(href, location.origin);
        if (!/^https?:$/.test(url.protocol)) return false;
        const host = url.hostname.replace(/^www\./, "");
        return host !== "x.com" && host !== "twitter.com" && !host.endsWith(".x.com") && !host.endsWith(".twitter.com");
      } catch { return false; }
    };
    const links = [wrapper.closest("a[href]"), ...wrapper.querySelectorAll("a[href]"), ...article.querySelectorAll("a[href]")].filter(Boolean);
    const anchor = links.find(link => isUsableLink(link.getAttribute("href") || ""));
    if (!anchor) return null;
    const href = anchor.getAttribute("href") || "";
    const url = new URL(href, location.origin).href;
    const rawLines = (wrapper.innerText || wrapper.textContent || "").split(/\n+/);
    const spanLines = Array.from(wrapper.querySelectorAll("span")).map(textOf);
    const ariaLabel = wrapper.getAttribute("aria-label") || "";
    const preferredLines = spanLines.filter(Boolean).length >= 2 ? spanLines : rawLines;
    const lines = Array.from(new Set([...preferredLines, ariaLabel].map(line => line.replace(/\s+/g, " ").trim()).filter(line => line && line !== "画像")));
    const domainLine = lines.find(line => /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i.test(line));
    const host = new URL(url).hostname.replace(/^www\./, "");
    const site = domainLine || host;
    const contentLines = lines.filter(line => line !== domainLine && line !== url && line !== href);
    return { url, site, title: contentLines[0] || "リンクを開く", summary: contentLines.slice(1).join(" ").slice(0, 180) };
  };
  const getLargeMediaUrl = source => {
    try {
      const url = new URL(source, location.href);
      if (url.hostname.endsWith("twimg.com")) url.searchParams.set("name", "large");
      return url.href;
    } catch { return source; }
  };
  const closeFeedMediaModal = () => {
    const modal = document.getElementById(MEDIA_MODAL_ID);
    if (!modal) return;
    modal.xraCleanup?.();
    modal.remove();
  };
  const openFeedMediaModal = source => {
    if (!source) return;
    closeFeedMediaModal();
    const modal = document.createElement("div"); modal.id = MEDIA_MODAL_ID; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-label", "投稿画像");
    modal.dataset.viewMode = document.getElementById(ROOT_ID)?.dataset.viewMode || "compact";
    const image = document.createElement("img"); image.src = getLargeMediaUrl(source); image.alt = "投稿画像";
    const close = document.createElement("button"); close.className = "xra-media-close"; close.type = "button"; close.setAttribute("aria-label", "閉じる"); close.textContent = "×";
    const onKeyDown = event => { if (event.key === "Escape") closeFeedMediaModal(); };
    modal.xraCleanup = () => document.removeEventListener("keydown", onKeyDown);
    modal.addEventListener("click", event => { if (event.target === modal) closeFeedMediaModal(); });
    close.addEventListener("click", closeFeedMediaModal);
    document.addEventListener("keydown", onKeyDown);
    modal.append(image, close); document.body.appendChild(modal);
  };
  const isPromoted = article => {
    const text = article.innerText || "";
    return ["プロモーション", "Promoted", "広告", "おすすめ", "Who to follow", "おすすめユーザー"]
      .some(word => text.includes(word));
  };
  const isReply = article => {
    if ((article.innerText||"").includes("返信先")) return true;
    if (article.querySelector('[data-testid="socialContext"]')) return true;
    return false;
  };

  const getPostKey = article => getPostUrl(article) || [getHandle(article), getTime(article), getText(article).slice(0,80), textOf(article.querySelector('[data-testid="card.wrapper"]')).slice(0,80)].join("|");
  const findSourceArticle = (original, key, postUrl) => {
    if (original?.isConnected) return original;
    return Array.from(document.querySelectorAll("article")).find(article => !article.closest(`#${ROOT_ID}`) && (postUrl ? getPostUrl(article) === postUrl : getPostKey(article) === key)) || null;
  };

  const createCard = article => {
    if (isPromoted(article) || isReply(article)) return null;
    const handle = getHandle(article), time = getTime(article), text = getText(article), postUrl = getPostUrl(article), mediaSources = getMediaSources(article), linkPreview = getLinkPreview(article), key = getPostKey(article);
    if (!handle && !text && !linkPreview) return null;
    const card = document.createElement("article"); card.className = `xra-card${mediaSources.length ? " has-media" : ""}`; card.setAttribute(CARD_ATTR, key);
    const main = document.createElement("div"); main.className = "xra-main";
    const meta = document.createElement("div"); meta.className = "xra-meta";
    const handleEl = document.createElement("div"); handleEl.className = "xra-handle"; handleEl.textContent = handle.replace(/^@/, "");
    const timeEl = document.createElement("div"); timeEl.className = "xra-time"; timeEl.textContent = time;
    const textEl = document.createElement("div"); textEl.className = "xra-text"; textEl.textContent = text;
    meta.append(handleEl, timeEl); main.appendChild(meta); if (text) main.appendChild(textEl);
    if (linkPreview) {
      const linkCard = document.createElement("button"); linkCard.className = "xra-link-card"; linkCard.type = "button"; linkCard.setAttribute("aria-label", `${linkPreview.title}を開く`);
      const site = document.createElement("div"); site.className = "xra-link-site"; site.textContent = linkPreview.site;
      const title = document.createElement("div"); title.className = "xra-link-title"; title.textContent = linkPreview.title;
      linkCard.append(site, title);
      if (linkPreview.summary) { const summary = document.createElement("div"); summary.className = "xra-link-summary"; summary.textContent = linkPreview.summary; linkCard.appendChild(summary); }
      linkCard.addEventListener("click", event => { event.stopPropagation(); location.href = linkPreview.url; });
      main.appendChild(linkCard);
    }
    card.appendChild(main);
    if (mediaSources.length) {
      const mediaList = document.createElement("div"); mediaList.className = "xra-media-list"; mediaList.dataset.count = String(mediaSources.length);
      mediaSources.forEach((source, index) => {
        const media = document.createElement("button"); media.className = "xra-media"; media.type = "button"; media.setAttribute("aria-label", `画像${index + 1}を拡大`);
        const img = document.createElement("img"); img.src = source; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
        media.appendChild(img); media.addEventListener("click", event => { event.stopPropagation(); openFeedMediaModal(source); }); mediaList.appendChild(media);
      });
      card.appendChild(mediaList);
    }
    const footer = document.createElement("div"); footer.className = "xra-card-footer";
    const like = document.createElement("div"); like.className = "xra-card-like"; like.textContent = `♡ ${getDetailLikeCount(article)}`;
    const date = document.createElement("div"); date.className = "xra-card-date"; date.textContent = formatDetailDate(article) || time;
    footer.append(like, date); card.appendChild(footer);
    if (findNativeBookmarkButton(article)) {
      const bookmark = document.createElement("button"); bookmark.className = "xra-card-bookmark"; bookmark.type = "button"; bookmark.appendChild(createFallbackBookmarkSvg());
      const syncBookmark = () => {
        const sourceArticle = findSourceArticle(article, key, postUrl);
        const nativeButton = findNativeBookmarkButton(sourceArticle);
        const saved = nativeButton?.getAttribute("data-testid") === "removeBookmark";
        bookmark.dataset.saved = String(saved);
        bookmark.setAttribute("aria-label", saved ? "ブックマークを解除" : "ブックマークに追加");
      };
      bookmark.addEventListener("click", event => {
        event.stopPropagation();
        const sourceArticle = findSourceArticle(article, key, postUrl);
        const nativeButton = findNativeBookmarkButton(sourceArticle);
        if (!nativeButton) return;
        nativeButton.click(); setTimeout(syncBookmark, 100); setTimeout(syncBookmark, 500);
      });
      syncBookmark(); card.appendChild(bookmark);
    }
    card.addEventListener("click", () => { if (postUrl) location.href = postUrl; });
    if (postUrl) { card.tabIndex = 0; card.setAttribute("role", "link"); card.addEventListener("keydown", event => { if (event.target === card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); location.href = postUrl; } }); }
    return card;
  };

  const currentSection = () => CONFIG.sections.find(section => section.id === activeSectionId);
  const renderCurrentFeed = () => {
    const section = currentSection();
    const list = document.querySelector(`.xra-section[data-section-id="${activeSectionId}"] .xra-list`);
    if (!section || !list) return;
    if (!section.url) { list.innerHTML = '<div class="xra-message">このリストのURLが未設定です。<br>スクリプト上部のCONFIG.sectionsへXリストURLを入力してください。</div>'; return; }
    const existing = new Set(Array.from(list.querySelectorAll(`[${CARD_ATTR}]`)).map(card => card.getAttribute(CARD_ATTR)));
    let added = 0;
    document.querySelectorAll("article").forEach(article => { if (article.closest(`#${ROOT_ID}`)) return; const key = getPostKey(article); if (!key || existing.has(key)) return; const card = createCard(article); if (!card) return; list.appendChild(card); existing.add(key); added += 1; });
    if (!list.querySelector(".xra-card") && !list.querySelector(".xra-message")) list.innerHTML = '<div class="xra-message">投稿を読み込んでいます</div>';
    if (added > 0) list.querySelector(".xra-message")?.remove();
  };

  const preloadNativeFeed = root => {
    if (preloadLocked || root.scrollHeight - root.scrollTop - root.clientHeight > 320) return;
    preloadLocked = true;
    window.scrollBy(0, Math.max(480, Math.round(window.innerHeight * .82)));
    setTimeout(() => { preloadLocked = false; renderCurrentFeed(); }, 650);
  };

  const switchSection = sectionId => {
    const section = CONFIG.sections.find(item => item.id === sectionId); if (!section) return;
    activeSectionId = sectionId;
    document.querySelectorAll(".xra-section").forEach(element => { element.dataset.open = String(element.dataset.sectionId === sectionId); });
    document.querySelectorAll(".xra-section-tab").forEach(button => { const active = button.dataset.sectionId === sectionId; button.dataset.active = String(active); button.setAttribute("aria-selected", String(active)); });
    const root = document.getElementById(ROOT_ID); if (root) root.scrollTop = 0;
    if (!section.url) { renderCurrentFeed(); return; }
    const target = new URL(section.url, location.origin), current = new URL(location.href);
    if (current.pathname !== target.pathname) { location.href = section.url; return; }
    renderCurrentFeed();
  };

  const createSection = section => {
    const panel = document.createElement("section"); panel.id = `xra-section-${section.id}`; panel.className = "xra-section"; panel.dataset.sectionId = section.id; panel.dataset.open = String(section.id === activeSectionId); panel.setAttribute("role", "tabpanel");
    const tab = document.createElement("button"); tab.className = "xra-section-tab"; tab.type = "button"; tab.dataset.sectionId = section.id; tab.dataset.active = String(section.id === activeSectionId); tab.setAttribute("role", "tab"); tab.setAttribute("aria-selected", String(section.id === activeSectionId)); tab.setAttribute("aria-controls", panel.id);
    const label = document.createElement("span"); label.textContent = section.label;
    tab.appendChild(label); tab.addEventListener("click", () => switchSection(section.id));
    const content = document.createElement("div"); content.className = "xra-content";
    const list = document.createElement("div"); list.className = "xra-list";
    content.appendChild(list); panel.appendChild(content); return { tab, panel };
  };

  const getSavedViewMode = () => localStorage.getItem(VIEW_MODE_KEY) === "comfortable" ? "comfortable" : "compact";
  const createViewModeSvg = targetMode => {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    const rows = targetMode === "comfortable" ? [[4,3,16,8],[4,13,16,8]] : [[4,3,16,4],[4,10,16,4],[4,17,16,4]];
    rows.forEach(([x,y,width,height]) => { const rect = document.createElementNS(namespace, "rect"); rect.setAttribute("x", String(x)); rect.setAttribute("y", String(y)); rect.setAttribute("width", String(width)); rect.setAttribute("height", String(height)); rect.setAttribute("rx", "1.5"); svg.appendChild(rect); });
    return svg;
  };
  const renderViewModeButton = (root, button) => {
    const mode = root.dataset.viewMode === "comfortable" ? "comfortable" : "compact";
    const targetMode = mode === "compact" ? "comfortable" : "compact";
    const label = targetMode === "comfortable" ? "ゆったり表示に切り替える" : "コンパクト表示に切り替える";
    button.dataset.mode = mode; button.setAttribute("aria-label", label); button.setAttribute("aria-pressed", String(mode === "comfortable")); button.title = targetMode === "comfortable" ? "ゆったり表示" : "コンパクト表示"; button.replaceChildren(createViewModeSvg(targetMode));
  };
  const createViewModeButton = root => {
    const button = document.createElement("button"); button.id = VIEW_TOGGLE_ID; button.type = "button";
    button.addEventListener("click", () => { const nextMode = root.dataset.viewMode === "comfortable" ? "compact" : "comfortable"; root.dataset.viewMode = nextMode; localStorage.setItem(VIEW_MODE_KEY, nextMode); renderViewModeButton(root, button); });
    renderViewModeButton(root, button); return button;
  };

  const addListSwipeNavigation = root => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let suppressClickUntil = 0;
    const isInteractiveTarget = target => target instanceof Element && Boolean(target.closest("button, a, input, textarea, select, [contenteditable='true']"));

    root.addEventListener("touchstart", event => {
      if (event.touches.length !== 1 || isInteractiveTarget(event.target)) { tracking = false; return; }
      const touch = event.touches[0];
      if (touch.clientX <= SWIPE_EDGE_GUARD || touch.clientX >= window.innerWidth - SWIPE_EDGE_GUARD) { tracking = false; return; }
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
    }, { passive: true });

    root.addEventListener("touchend", event => {
      if (!tracking || event.changedTouches.length !== 1) { tracking = false; return; }
      tracking = false;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Date.now() - startTime > SWIPE_MAX_DURATION || Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
      suppressClickUntil = Date.now() + 450;
      const currentIndex = CONFIG.sections.findIndex(section => section.id === activeSectionId);
      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextSection = CONFIG.sections[nextIndex];
      if (nextSection) switchSection(nextSection.id);
    }, { passive: true });

    root.addEventListener("touchcancel", () => { tracking = false; }, { passive: true });
    root.addEventListener("click", event => {
      if (Date.now() > suppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  };

  const createRoot = () => {
    if (document.getElementById(ROOT_ID)) { hideBootScreen(); return; }
    const root = document.createElement("div"); root.id = ROOT_ID; root.dataset.viewMode = getSavedViewMode();
    const header = document.createElement("header"); header.className = "xra-header";
    const tabs = document.createElement("nav"); tabs.className = "xra-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "リストを切り替える");
    const sections = document.createElement("main"); sections.className = "xra-sections";
    CONFIG.sections.forEach(section => { const elements = createSection(section); tabs.appendChild(elements.tab); sections.appendChild(elements.panel); });
    header.appendChild(tabs);

    const bookmarksList = document.createElement("button");
    bookmarksList.id = BOOKMARKS_LIST_ID;
    bookmarksList.type = "button";
    bookmarksList.setAttribute("aria-label", "ブックマーク一覧を開く");

    bookmarksList.appendChild(createFallbackBookmarkSvg());

    bookmarksList.addEventListener("click", () => {
      location.href = `${location.origin}/i/bookmarks`;
    });

    const viewModeButton = createViewModeButton(root);
    root.addEventListener("scroll", () => preloadNativeFeed(root), { passive: true });
    addListSwipeNavigation(root);
    root.append(header, sections, viewModeButton, bookmarksList); document.body.appendChild(root);
    renderCurrentFeed(); setTimeout(renderCurrentFeed, 400); setTimeout(renderCurrentFeed, 1000); setTimeout(renderCurrentFeed, 1800);
    hideBootScreen();
  };


  const createToggleSvg = mode => {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    if (mode === "normal") {
      // 通常表示へ戻す：ブラウザ画面風アイコン
      const rect = document.createElementNS(namespace, "rect");
      rect.setAttribute("x", "3");
      rect.setAttribute("y", "4");
      rect.setAttribute("width", "18");
      rect.setAttribute("height", "16");
      rect.setAttribute("rx", "2");

      const line = document.createElementNS(namespace, "path");
      line.setAttribute("d", "M3 8h18");

      const dot1 = document.createElementNS(namespace, "circle");
      dot1.setAttribute("cx", "6");
      dot1.setAttribute("cy", "6");
      dot1.setAttribute("r", ".5");
      dot1.setAttribute("fill", "currentColor");
      dot1.setAttribute("stroke", "none");

      const dot2 = document.createElementNS(namespace, "circle");
      dot2.setAttribute("cx", "8");
      dot2.setAttribute("cy", "6");
      dot2.setAttribute("r", ".5");
      dot2.setAttribute("fill", "currentColor");
      dot2.setAttribute("stroke", "none");

      svg.append(rect, line, dot1, dot2);
    } else {
      // 簡素表示へ切り替える：リーダー／リスト風アイコン
      const line1 = document.createElementNS(namespace, "path");
      line1.setAttribute("d", "M8 6h11");

      const line2 = document.createElementNS(namespace, "path");
      line2.setAttribute("d", "M8 12h11");

      const line3 = document.createElementNS(namespace, "path");
      line3.setAttribute("d", "M8 18h11");

      const dot1 = document.createElementNS(namespace, "circle");
      dot1.setAttribute("cx", "4.5");
      dot1.setAttribute("cy", "6");
      dot1.setAttribute("r", "1");

      const dot2 = document.createElementNS(namespace, "circle");
      dot2.setAttribute("cx", "4.5");
      dot2.setAttribute("cy", "12");
      dot2.setAttribute("r", "1");

      const dot3 = document.createElementNS(namespace, "circle");
      dot3.setAttribute("cx", "4.5");
      dot3.setAttribute("cy", "18");
      dot3.setAttribute("r", "1");

      svg.append(line1, line2, line3, dot1, dot2, dot3);
    }

    return svg;
  };

  const renderToggleButton = () => {
    const button = document.getElementById(TOGGLE_ID);
    if (!button) return;

    const readerIsOpen = Boolean(document.getElementById(ROOT_ID));
    const mode = readerIsOpen ? "normal" : "reader";
    const label = readerIsOpen ? "通常表示に戻す" : "簡素表示に切り替える";

    // 状態が変わった時だけSVGを書き換える。
    if (button.dataset.mode !== mode || !button.firstElementChild) {
      button.dataset.mode = mode;
      button.replaceChildren(createToggleSvg(mode));
    }

    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
    }
    if (button.title !== (readerIsOpen ? "通常表示" : "簡素表示")) {
      button.title = readerIsOpen ? "通常表示" : "簡素表示";
    }
  };

  const enableReader = () => { localStorage.setItem("xra-enabled", "true"); if (isDetailPage()) { closeFeedMediaModal(); document.getElementById(ROOT_ID)?.remove(); renderToggleButton(); return; } createRoot(); renderToggleButton(); };
  const disableReader = () => { localStorage.setItem("xra-enabled", "false"); closeFeedMediaModal(); document.getElementById(ROOT_ID)?.remove(); renderToggleButton(); };
  const addToggle = () => {
    let button = document.getElementById(TOGGLE_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = TOGGLE_ID;
      button.type = "button";
      button.addEventListener("click", () => {
        document.getElementById(ROOT_ID) ? disableReader() : enableReader();
      });
      document.body.appendChild(button);
    }
    renderToggleButton();
  };
  const detectInitialSection = () => { const currentPath = location.pathname; const matched = CONFIG.sections.find(section => { if (!section.url) return false; try { return new URL(section.url).pathname === currentPath; } catch { return false; } }); activeSectionId = matched?.id || "following"; };
  

// Step3: URLの投稿IDと一致するメイン投稿を赤枠で確認
  const getCurrentStatusId = () => {
    const match = location.pathname.match(/\/status\/(\d+)/);
    return match ? match[1] : "";
  };

  const isDetailPage = () => Boolean(getCurrentStatusId());

  const findMainDetailArticle = () => {
    const statusId = getCurrentStatusId();
    if (!statusId) return null;

    return Array.from(document.querySelectorAll("article")).find(article =>
      Array.from(article.querySelectorAll('a[href*="/status/"]')).some(link => {
        const href = link.getAttribute("href") || "";
        return href.includes(`/status/${statusId}`);
      })
    ) || null;
  };

  const markMainDetailArticle = () => {
    const target = findMainDetailArticle();
    const current = document.querySelector("article.xra-detail-main");

    if (current === target) return target;

    if (current) current.classList.remove("xra-detail-main");
    if (target) target.classList.add("xra-detail-main");
    return target;
  };


  const formatDetailDate = article => {
    const time = article?.querySelector("time");
    const datetime = time?.getAttribute("datetime");
    if (!datetime) return (time?.textContent || "").trim();

    const date = new Date(datetime);
    if (Number.isNaN(date.getTime())) return (time?.textContent || "").trim();

    const pad = value => String(value).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}・${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  };

  const getDetailLikeCount = article => {
    const button = article?.querySelector('[data-testid="like"], [data-testid="unlike"]');
    if (!button) return "0";

    const visibleText = (button.textContent || "").replace(/\s+/g, " ").trim();
    const visibleMatch = visibleText.match(/[\d,.]+(?:万|億)?/);
    if (visibleMatch) return visibleMatch[0];

    const aria = button.getAttribute("aria-label") || "";
    const ariaMatch = aria.match(/[\d,.]+(?:万|億)?/);
    return ariaMatch ? ariaMatch[0] : "0";
  };

  const getDetailIdentity = article => {
    const userName = article?.querySelector('[data-testid="User-Name"]');
    const spans = Array.from(userName?.querySelectorAll("span") || [])
      .map(span => (span.textContent || "").trim())
      .filter(Boolean);

    const handle = (spans.find(value => value.startsWith("@")) || "").replace(/^@/, "");
    const name = spans.find(value =>
      !value.startsWith("@") &&
      value !== "·" &&
      !/^\d+[smhd]$/.test(value) &&
      !/^\d+分$/.test(value) &&
      !/^\d+時間$/.test(value)
    ) || "";

    const avatar = article?.querySelector('[data-testid="Tweet-User-Avatar"] img');
    return {
      name,
      handle,
      avatarSrc: avatar?.currentSrc || avatar?.src || ""
    };
  };

  const getDetailMediaSources = article => {
    const sources = Array.from(
      article?.querySelectorAll('[data-testid="tweetPhoto"] img[src]') || []
    )
      .map(image => image.currentSrc || image.src || "")
      .filter(Boolean);

    return Array.from(new Set(sources));
  };


  const findNativeBookmarkButton = article => {
    return article?.querySelector(
      '[data-testid="bookmark"], [data-testid="removeBookmark"]'
    ) || null;
  };

  const createFallbackBookmarkSvg = () => {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS(namespace, "path");
    path.setAttribute(
      "d",
      "M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5V22l-8-5-8 5V4.5Zm2.5-.5a.5.5 0 0 0-.5.5v13.89l6-3.75 6 3.75V4.5a.5.5 0 0 0-.5-.5h-11Z"
    );
    svg.appendChild(path);
    return svg;
  };

  const syncDetailBookmarkButton = article => {
    const root = document.getElementById(DETAIL_ROOT_ID);
    const button = root?.querySelector(".xra-detail-bookmark");
    if (!button) return;

    const nativeButton = findNativeBookmarkButton(article);
    const saved = nativeButton?.getAttribute("data-testid") === "removeBookmark";
    const savedValue = String(saved);
    const label = saved ? "ブックマークを解除" : "ブックマークに追加";
    const iconKey = nativeButton ? nativeButton.getAttribute("data-testid") : "fallback";

    if (button.dataset.saved !== savedValue) {
      button.dataset.saved = savedValue;
    }
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
    }

    // 保存状態または取得元が変わった時だけSVGを複製する。
    if (button.dataset.iconKey === iconKey && button.firstElementChild) return;

    const nativeSvg = nativeButton?.querySelector("svg");
    const icon = nativeSvg ? nativeSvg.cloneNode(true) : createFallbackBookmarkSvg();
    icon.removeAttribute("style");
    icon.setAttribute("aria-hidden", "true");

    button.dataset.iconKey = iconKey;
    button.replaceChildren(icon);
  };

  const runDetailBookmark = article => {
    const nativeButton = findNativeBookmarkButton(article);
    if (!nativeButton) return;

    nativeButton.click();
    setTimeout(() => syncDetailBookmarkButton(article), 250);
    setTimeout(() => syncDetailBookmarkButton(article), 700);
  };

  const createDetailReader = article => {
    const statusId = getCurrentStatusId();
    const identity = getDetailIdentity(article);
    const bodyText = (article.querySelector('[data-testid="tweetText"]')?.innerText || "").trim();
    const mediaSources = getDetailMediaSources(article);
    const dateText = formatDetailDate(article);
    const likeText = getDetailLikeCount(article);

    let root = document.getElementById(DETAIL_ROOT_ID);
    if (root && root.dataset.statusId !== statusId) {
      root.remove();
      root = null;
    }

    if (!root) {
      root = document.createElement("div");
      root.id = DETAIL_ROOT_ID;
      root.dataset.statusId = statusId;

      const header = document.createElement("header");
      header.className = "xra-detail-header";

      const back = document.createElement("button");
      back.className = "xra-detail-back";
      back.type = "button";
      back.setAttribute("aria-label", "戻る");
      back.textContent = "←";
      back.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = `${location.origin}/home`;
      });

      const title = document.createElement("div");
      title.className = "xra-detail-title";
      title.textContent = "ポスト";

      header.append(back, title);

      const sheet = document.createElement("main");
      sheet.className = "xra-detail-sheet";

      const profile = document.createElement("div");
      profile.className = "xra-detail-profile";

      const avatar = document.createElement("div");
      avatar.className = "xra-detail-avatar";
      if (identity.avatarSrc) {
        const image = document.createElement("img");
        image.src = identity.avatarSrc;
        image.alt = "";
        avatar.appendChild(image);
      }

      const identityRow = document.createElement("div");
      identityRow.className = "xra-detail-identity";

      const name = document.createElement("div");
      name.className = "xra-detail-name";
      name.textContent = identity.name;

      const handle = document.createElement("div");
      handle.className = "xra-detail-handle";
      handle.textContent = identity.handle;

      identityRow.append(name, handle);
      profile.append(avatar, identityRow);

      const body = document.createElement("div");
      body.className = "xra-detail-body";
      body.textContent = bodyText;

      const mediaList = document.createElement("div");
      mediaList.className = "xra-detail-media-list";
      mediaList.dataset.count = String(mediaSources.length);

      mediaSources.forEach(source => {
        const media = document.createElement("div");
        media.className = "xra-detail-media";

        const image = document.createElement("img");
        image.src = source;
        image.alt = "";
        image.loading = "eager";

        media.appendChild(image);
        mediaList.appendChild(media);
      });

      const footer = document.createElement("div");
      footer.className = "xra-detail-footer";

      const like = document.createElement("div");
      like.className = "xra-detail-like";
      like.textContent = `♡ ${likeText}`;

      const date = document.createElement("div");
      date.className = "xra-detail-date";
      date.textContent = dateText;

      footer.append(like, date);
      sheet.append(profile);

      if (bodyText) sheet.append(body);
      if (mediaSources.length) sheet.append(mediaList);

      sheet.append(footer);
      const bookmark = document.createElement("button");
      bookmark.className = "xra-detail-bookmark";
      bookmark.type = "button";
      bookmark.setAttribute("aria-label", "ブックマークに追加");
      bookmark.addEventListener("click", () => runDetailBookmark(article));

      root.append(header, sheet, bookmark);
      document.body.appendChild(root);
      syncDetailBookmarkButton(article);
    } else {
      const like = root.querySelector(".xra-detail-like");
      const date = root.querySelector(".xra-detail-date");
      if (like) like.textContent = `♡ ${likeText}`;
      if (date) date.textContent = dateText;
      syncDetailBookmarkButton(article);
    }

    hideBootScreen();
    return root;
  };

  const simplifyDetailPage = () => {
    if (!isDetailPage()) return;

    const mainArticle = markMainDetailArticle();
    if (!mainArticle) return;

    createDetailReader(mainArticle);
  };

  const clearDetailSimplification = () => {
    document.getElementById(DETAIL_ROOT_ID)?.remove();
    document.querySelectorAll(".xra-detail-hidden").forEach(element => element.classList.remove("xra-detail-hidden"));
    document.querySelectorAll(".xra-native-action-group").forEach(element => element.classList.remove("xra-native-action-group"));
    document.querySelectorAll(".xra-native-meta-row").forEach(element => element.classList.remove("xra-native-meta-row"));
    document.querySelectorAll(".xra-detail-summary").forEach(element => element.remove());
  };

  const syncPageMode = () => {
    const detail = isDetailPage();
    document.documentElement.classList.toggle("xra-detail-page", detail);

    if (detail) {
      closeFeedMediaModal();
      document.getElementById(ROOT_ID)?.remove();
      renderToggleButton();
      simplifyDetailPage();
      return;
    }

    clearDetailSimplification();
    document.querySelector("article.xra-detail-main")?.classList.remove("xra-detail-main");
    if (localStorage.getItem("xra-enabled") !== "false" && !document.getElementById(ROOT_ID)) {
      enableReader();
    } else if (!document.getElementById(ROOT_ID)) {
      hideBootScreen();
    }
  };

  const isOwnedUiNode = node => {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;

    if (!element) return false;

    return Boolean(
      element.matches?.(
        `#${ROOT_ID}, #${DETAIL_ROOT_ID}, #${TOGGLE_ID}, #${BOOKMARKS_LIST_ID}, #${MEDIA_MODAL_ID}, #${VIEW_TOGGLE_ID}`
      ) ||
      element.closest?.(
        `#${ROOT_ID}, #${DETAIL_ROOT_ID}, #${TOGGLE_ID}, #${BOOKMARKS_LIST_ID}, #${MEDIA_MODAL_ID}, #${VIEW_TOGGLE_ID}`
      )
    );
  };

  const isOwnUiMutation = mutation => {
    if (isOwnedUiNode(mutation.target)) return true;

    const changedNodes = [
      ...Array.from(mutation.addedNodes || []),
      ...Array.from(mutation.removedNodes || [])
    ];

    return changedNodes.length > 0 && changedNodes.every(isOwnedUiNode);
  };

  let lastUrl = location.href;
const start = () => {
    addStyle();
    detectInitialSection();
    addToggle();
    syncPageMode();

    const observer = new MutationObserver(mutations => {
      // 自分で追加したボタンや専用画面だけの変化では再処理しない。
      if (mutations.length && mutations.every(isOwnUiMutation)) return;

      if (!document.getElementById(TOGGLE_ID)) addToggle();

      if (location.href !== lastUrl) {
        lastUrl = location.href;
        detectInitialSection();
        syncPageMode();
      }

      if (isDetailPage()) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(simplifyDetailPage, 140);
      } else if (document.getElementById(ROOT_ID)) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderCurrentFeed, 160);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 以前は500msごとに画面全体を再判定していたが、
    // 軽量版ではURLが変わった時だけ安全確認する。
    setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      detectInitialSection();
      syncPageMode();
    }, 1000);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
