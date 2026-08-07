// ==UserScript==
// @name         X Reader Accordion v7.0.4-step11-light
// @namespace    local.x-reader-accordion
// @version      7.0.4.11.2
// @description  Step11のモノクロ切替アイコンを維持し、不要なSVG再生成と定期再処理を抑えた軽量版です。
// @match        https://x.com/*
// @match        https://twitter.com/*
// @updateURL    https://raw.githubusercontent.com/aya0no/x-reader/main/x-reader.meta.js
// @downloadURL  https://raw.githubusercontent.com/aya0no/x-reader/main/x-reader.user.js
// @run-at       document-idle
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

  const CONFIG = {
    fontSize: 12.5,
    lineHeight: 1.5,
    imageWidth: 84,
    imageHeight: 64,
    monochrome: true,
    sections: [
      { id: "following", label: "フォロー中", url: "https://x.com/home" },
      { id: "it", label: "IT", url: "" },
      { id: "nail", label: "ネイル", url: "" },
      { id: "movie", label: "映画", url: "" },
      { id: "investment", label: "投資", url: "" }
    ]
  };

  let activeSectionId = "following";
  let renderTimer = null;

  const css = `
    #${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483000; overflow-y: auto; background: #f7f7f7; color: #171717; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", sans-serif; -webkit-overflow-scrolling: touch; }
    #${ROOT_ID} * { box-sizing: border-box; }
    .xra-header { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; min-height: 46px; padding: 7px 12px; background: rgba(247,247,247,.96); border-bottom: 1px solid #ddd; backdrop-filter: blur(12px); }
    .xra-title { font-size: 14px; font-weight: 700; }
    .xra-close { height: 30px; padding: 0 10px; border: 1px solid #cfcfcf; border-radius: 15px; background: #fff; color: #222; font-size: 11px; }
    .xra-sections { max-width: 720px; margin: 0 auto; background: #fff; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; }
    .xra-section { border-bottom: 1px solid #ddd; }
    .xra-section-button { display: flex; align-items: center; width: 100%; min-height: 42px; padding: 0 12px; border: 0; background: #fff; color: #171717; font-size: 12px; font-weight: 650; text-align: left; }
    .xra-arrow { display: inline-block; width: 18px; margin-right: 4px; font-size: 11px; transition: transform .15s ease; }
    .xra-section[data-open="false"] .xra-arrow { transform: rotate(-90deg); }
    .xra-content { display: none; }
    .xra-section[data-open="true"] .xra-content { display: block; }
    .xra-status { padding: 6px 12px; border-top: 1px solid #eee; border-bottom: 1px solid #eee; background: #fafafa; color: #777; font-size: 10px; text-align: center; }
    .xra-card { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; padding: 7px 10px; border-bottom: 1px solid #e2e2e2; background: #fff; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .xra-main { min-width: 0; }
    .xra-meta { display: flex; gap: 5px; min-height: 14px; margin-bottom: 2px; overflow: hidden; white-space: nowrap; }
    .xra-handle { overflow: hidden; font-size: 11px; font-weight: 650; text-overflow: ellipsis; }
    .xra-time { flex: 0 0 auto; color: #777; font-size: 10px; }
    .xra-text { display: -webkit-box; overflow: hidden; font-size: ${CONFIG.fontSize}px; line-height: 1.42; white-space: pre-wrap; word-break: break-word; -webkit-box-orient: vertical; -webkit-line-clamp: 7; }
    .xra-media { width: ${CONFIG.imageWidth}px; height: ${CONFIG.imageHeight}px; align-self: center; overflow: hidden; border: 1px solid #ddd; border-radius: 7px; background: #eee; }
    .xra-media img { display: block; width: 100%; height: 100%; object-fit: cover; ${CONFIG.monochrome ? "filter: grayscale(1);" : ""} }
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
      right: 66px;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 44px;
      padding: 0 13px;
      border: 1px solid #bdbdbd;
      border-radius: 22px;
      background: rgba(255,255,255,.96);
      color: #222;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
        "Yu Gothic UI", "Yu Gothic", sans-serif !important;
      font-size: 11px;
      font-weight: 650;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0,0,0,.14);
      backdrop-filter: blur(12px);
      -webkit-tap-highlight-color: transparent;
    }

    #${BOOKMARKS_LIST_ID} svg {
      display: block;
      width: 16px;
      height: 16px;
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

    html.xra-detail-page #${BOOKMARKS_LIST_ID} {
      display: none !important;
    }
  `;

  const addStyle = () => { if (!document.getElementById(STYLE_ID)) { const style = document.createElement("style"); style.id = STYLE_ID; style.textContent = css; document.documentElement.appendChild(style); } };
  const textOf = element => (element?.textContent || "").trim();
  const getHandle = article => { const userName = article.querySelector('[data-testid="User-Name"]'); if (!userName) return ""; return Array.from(userName.querySelectorAll("span")).map(textOf).find(text => text.startsWith("@")) || ""; };
  const getTime = article => { const time = article.querySelector("time"); return time ? textOf(time) : ""; };
  const getText = article => { const tweetText = article.querySelector('[data-testid="tweetText"]'); return tweetText ? tweetText.innerText.trim() : ""; };
  const getPostUrl = article => { const link = article.querySelector('a[href*="/status/"]'); if (!link) return ""; const href = link.getAttribute("href") || ""; return href.startsWith("http") ? href : `${location.origin}${href}`; };
  const getMediaSource = article => { const images = Array.from(article.querySelectorAll("img[src]")).filter(img => { const src = img.currentSrc || img.src || ""; if (!src || src.includes("profile_images") || src.includes("emoji")) return false; if (img.closest('[data-testid="Tweet-User-Avatar"]')) return false; return true; }); const image = images.find(img => { const rect = img.getBoundingClientRect(); return rect.width > 70 || rect.height > 70; }); return image ? image.currentSrc || image.src : ""; };
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

  const getPostKey = article => getPostUrl(article) || [getHandle(article), getTime(article), getText(article).slice(0,80)].join("|");

  const createCard = article => {
    if (isPromoted(article) || isReply(article)) return null;
    const handle = getHandle(article), time = getTime(article), text = getText(article), postUrl = getPostUrl(article), mediaSrc = getMediaSource(article);
    if (!handle && !text) return null;
    const card = document.createElement("article"); card.className = "xra-card"; card.setAttribute(CARD_ATTR, getPostKey(article));
    const main = document.createElement("div"); main.className = "xra-main";
    const meta = document.createElement("div"); meta.className = "xra-meta";
    const handleEl = document.createElement("div"); handleEl.className = "xra-handle"; handleEl.textContent = handle || "@unknown";
    const timeEl = document.createElement("div"); timeEl.className = "xra-time"; timeEl.textContent = time;
    const textEl = document.createElement("div"); textEl.className = "xra-text"; textEl.textContent = text;
    meta.append(handleEl, timeEl); main.append(meta, textEl); card.appendChild(main);
    if (mediaSrc) { const media = document.createElement("div"); media.className = "xra-media"; const img = document.createElement("img"); img.src = mediaSrc; img.alt = ""; img.loading = "lazy"; media.appendChild(img); card.appendChild(media); }
    card.addEventListener("click", () => { if (postUrl) location.href = postUrl; });
    return card;
  };

  const currentSection = () => CONFIG.sections.find(section => section.id === activeSectionId);
  const renderCurrentFeed = () => {
    const section = currentSection();
    const list = document.querySelector(`.xra-section[data-section-id="${activeSectionId}"] .xra-list`);
    const status = document.querySelector(`.xra-section[data-section-id="${activeSectionId}"] .xra-status`);
    if (!section || !list || !status) return;
    if (!section.url) { list.innerHTML = '<div class="xra-message">このリストのURLが未設定です。<br>スクリプト上部のCONFIG.sectionsへXリストURLを入力してください。</div>'; status.textContent = "未設定"; return; }
    const existing = new Set(Array.from(list.querySelectorAll(`[${CARD_ATTR}]`)).map(card => card.getAttribute(CARD_ATTR)));
    let added = 0;
    document.querySelectorAll("article").forEach(article => { if (article.closest(`#${ROOT_ID}`)) return; const key = getPostKey(article); if (!key || existing.has(key)) return; const card = createCard(article); if (!card) return; list.appendChild(card); existing.add(key); added += 1; });
    if (!list.querySelector(".xra-card") && !list.querySelector(".xra-message")) list.innerHTML = '<div class="xra-message">投稿を読み込んでいます</div>';
    if (added > 0) list.querySelector(".xra-message")?.remove();
    status.textContent = `${list.querySelectorAll(".xra-card").length}件を表示中`;
  };

  const switchSection = sectionId => {
    const section = CONFIG.sections.find(item => item.id === sectionId); if (!section) return;
    activeSectionId = sectionId;
    document.querySelectorAll(".xra-section").forEach(element => { element.dataset.open = String(element.dataset.sectionId === sectionId); });
    if (!section.url) { renderCurrentFeed(); return; }
    const target = new URL(section.url, location.origin), current = new URL(location.href);
    if (current.pathname !== target.pathname) { location.href = section.url; return; }
    renderCurrentFeed();
  };

  const createSection = section => {
    const wrapper = document.createElement("section"); wrapper.className = "xra-section"; wrapper.dataset.sectionId = section.id; wrapper.dataset.open = String(section.id === activeSectionId);
    const button = document.createElement("button"); button.className = "xra-section-button"; button.type = "button"; button.innerHTML = `<span class="xra-arrow">▼</span><span>${section.label}</span>`; button.addEventListener("click", () => switchSection(section.id));
    const content = document.createElement("div"); content.className = "xra-content";
    const status = document.createElement("div"); status.className = "xra-status"; status.textContent = section.url ? "投稿を読み込んでいます" : "未設定";
    const list = document.createElement("div"); list.className = "xra-list";
    content.append(status, list); wrapper.append(button, content); return wrapper;
  };

  const createRoot = () => {
    if (document.getElementById(ROOT_ID)) return;
    const root = document.createElement("div"); root.id = ROOT_ID;
    const header = document.createElement("header"); header.className = "xra-header";
    const title = document.createElement("div"); title.className = "xra-title"; title.textContent = "フィード";
    const close = document.createElement("button"); close.className = "xra-close"; close.type = "button"; close.textContent = "通常表示"; close.addEventListener("click", disableReader);
    header.append(title, close);
    const sections = document.createElement("main"); sections.className = "xra-sections"; CONFIG.sections.forEach(section => sections.appendChild(createSection(section)));

    const bookmarksList = document.createElement("button");
    bookmarksList.id = BOOKMARKS_LIST_ID;
    bookmarksList.type = "button";
    bookmarksList.setAttribute("aria-label", "ブックマーク一覧を開く");

    const bookmarksIcon = createFallbackBookmarkSvg();
    const bookmarksLabel = document.createElement("span");
    bookmarksLabel.textContent = "ブックマーク一覧";
    bookmarksList.append(bookmarksIcon, bookmarksLabel);

    bookmarksList.addEventListener("click", () => {
      location.href = `${location.origin}/i/bookmarks`;
    });

    root.append(header, sections, bookmarksList); document.body.appendChild(root);
    renderCurrentFeed(); setTimeout(renderCurrentFeed, 400); setTimeout(renderCurrentFeed, 1000); setTimeout(renderCurrentFeed, 1800);
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

  const enableReader = () => { localStorage.setItem("xra-enabled", "true"); if (isDetailPage()) { document.getElementById(ROOT_ID)?.remove(); renderToggleButton(); return; } createRoot(); renderToggleButton(); };
  const disableReader = () => { localStorage.setItem("xra-enabled", "false"); document.getElementById(ROOT_ID)?.remove(); renderToggleButton(); };
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

    const handle = spans.find(value => value.startsWith("@")) || "";
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
      document.getElementById(ROOT_ID)?.remove();
      renderToggleButton();
      simplifyDetailPage();
      return;
    }

    clearDetailSimplification();
    document.querySelector("article.xra-detail-main")?.classList.remove("xra-detail-main");
    if (localStorage.getItem("xra-enabled") !== "false" && !document.getElementById(ROOT_ID)) {
      enableReader();
    }
  };

  const isOwnedUiNode = node => {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;

    if (!element) return false;

    return Boolean(
      element.matches?.(
        `#${ROOT_ID}, #${DETAIL_ROOT_ID}, #${TOGGLE_ID}, #${BOOKMARKS_LIST_ID}`
      ) ||
      element.closest?.(
        `#${ROOT_ID}, #${DETAIL_ROOT_ID}, #${TOGGLE_ID}, #${BOOKMARKS_LIST_ID}`
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
