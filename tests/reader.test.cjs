const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "playwright") : "playwright");
const script = fs.readFileSync(path.join(__dirname, "../x-reader.user.js"), "utf8");
const identity = (handle = "reader", name = "テスト投稿者") => `<div data-testid="User-Name"><a href="/${handle}"><span>${name}</span></a><span>@${handle}</span></div>`;
const photos = count => `<div data-testid="tweetPhoto">${Array.from({ length: count }, (_, i) => `<img src="https://x.com/fixture-${i + 1}.svg" width="320" height="200">`).join("")}</div>`;
const quote = (id = "9900", text = "引用元の本文", count = 1) => `<div role="link" data-quote>${identity("quoted", "引用元")}<a href="/quoted/status/${id}"><time datetime="2026-10-09T02:00:00Z">1日前</time></a>${text ? `<div data-testid="tweetText">${text}</div>` : ""}${photos(count)}</div>`;
const post = (id, options = {}) => `<article data-native="${id}">${options.repost ? '<div data-testid="socialContext">someoneがリポスト</div>' : ""}${identity()}${options.text === "" ? "" : `<div data-testid="tweetText">${options.text || `投稿${id}の本文です。見た目を保ったまま読むテストです。`}</div>`}${options.quote || ""}${photos(options.images || 0)}<a href="/reader/status/${id}"><time datetime="2026-10-10T01:30:00Z">1時間</time></a><button data-testid="like">12</button><button data-testid="bookmark" onclick="this.dataset.testid = this.dataset.testid === 'bookmark' ? 'removeBookmark' : 'bookmark'">保存</button></article>`;
const homePosts = Array.from({ length: 30 }, (_, i) => post(String(1000 - i), { text: i === 0 ? "おすすめのレシピも消さずに表示" : undefined, images: i === 0 ? 3 : 0, repost: i === 1 })).join("");
const main = post("5000", { text: '本文と<a href="https://example.org/story">関連リンク</a>', quote: quote(), images: 2 });
const detailPosts = post("4900", { quote: quote("5000", "別の投稿がこの投稿を引用しているケース", 0) }) + main + post("5001", { quote: quote("9901", "返信の引用", 2) }) + post("5002", { images: 2 });
const shell = body => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;overflow-x:hidden}main>section>article{min-height:340px;padding:16px;overflow-wrap:anywhere}img{max-width:100%;object-fit:cover}</style></head><body><main data-testid="primaryColumn"><section id="native-timeline">${body}</section></main></body></html>`;
const errors = [];
let activePage;
let passed = 0;
const check = async (name, run) => { await run(); console.log(`PASS ${name}`); passed++; };

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(".svg")) { await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#d8d8d5"/><circle cx="160" cy="100" r="50" fill="#888"/></svg>' }); return; }
    const body = url.pathname.includes("/status/5000") ? detailPosts : url.pathname.includes("/status/6000") ? post("6000") : /\/status\//.test(url.pathname) ? post(url.pathname.split("/").pop()) : homePosts;
    await route.fulfill({ contentType: "text/html", body: shell(body) });
  });
  await context.addInitScript({ content: script });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("https://x.com/home");
  await page.waitForSelector(".xra-card");

  await check("fixed tabs, no counts, cards and reposts preserved", async () => {
    assert.deepEqual(await page.locator(".xra-section-tab").allTextContents(), ["ホーム", "1", "2", "株", "レシピ", "検索"]);
    assert.equal(await page.locator(".xra-card").count(), 30);
    assert.equal(await page.locator(".xra-header").evaluate(node => getComputedStyle(node).position), "fixed");
    assert.equal(await page.locator(".xra-handle").first().textContent(), "reader");
    const overlap = await page.locator(".xra-card").first().evaluate(card => { const a = card.querySelector(".xra-card-bookmark").getBoundingClientRect(), b = card.querySelector(".xra-media-list").getBoundingClientRect(); return a.right > b.left; });
    assert.equal(overlap, false);
  });

  await check("multi-image gallery, keyboard, touch and focus", async () => {
    await page.locator(".xra-media").first().focus();
    await page.locator(".xra-media").first().click();
    assert.equal(await page.locator("#xra-media-modal img").getAttribute("src"), "https://x.com/fixture-1.svg");
    await page.getByRole("button", { name: "次の画像", exact: true }).click();
    assert.equal(await page.locator("#xra-media-modal img").getAttribute("src"), "https://x.com/fixture-2.svg");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#xra-media-modal img").getAttribute("src"), "https://x.com/fixture-3.svg");
    await page.locator("#xra-media-modal").evaluate(node => { const touch = (x, type) => new TouchEvent(type, { bubbles: true, touches: type === "touchstart" ? [new Touch({ identifier: 1, target: node, clientX: x, clientY: 250 })] : [], changedTouches: [new Touch({ identifier: 1, target: node, clientX: x, clientY: 250 })] }); node.dispatchEvent(touch(80, "touchstart")); node.dispatchEvent(touch(250, "touchend")); });
    assert.equal(await page.locator("#xra-media-modal img").getAttribute("src"), "https://x.com/fixture-2.svg");
    assert.equal(page.url(), "https://x.com/home");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#xra-media-modal").count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.className), "xra-media");
  });

  await check("restore reading position after post navigation", async () => {
    await page.locator("#xra-root").evaluate(node => { node.scrollTop = 740; });
    await page.waitForTimeout(250);
    const before = await page.locator("#xra-root").evaluate(node => node.scrollTop);
    const target = page.locator(".xra-card").nth(9);
    await target.dispatchEvent("click");
    await page.waitForURL(/\/status\//);
    await page.waitForSelector("#xra-detail-root");
    await page.goBack();
    await page.waitForSelector(".xra-card");
    await page.waitForFunction(value => Math.abs(document.getElementById("xra-root").scrollTop - value) < 4, before);
  });

  await check("independent list positions and density switch anchor", async () => {
    await page.getByRole("tab", { name: "1", exact: true }).click();
    await page.waitForURL(/2082771236799840538/);
    await page.waitForSelector(".xra-card");
    assert.equal(await page.locator("#xra-root").evaluate(node => node.scrollTop), 0);
    await page.locator("#xra-root").evaluate(node => { node.scrollTop = 450; });
    await page.waitForTimeout(250);
    await page.getByRole("tab", { name: "ホーム", exact: true }).click();
    await page.waitForURL("https://x.com/home");
    await page.waitForFunction(() => document.getElementById("xra-root")?.scrollTop > 700);
    const anchor = await page.locator("#xra-root").evaluate(node => Array.from(node.querySelectorAll(".xra-card")).find(item => item.getBoundingClientRect().bottom > 48).getAttribute("data-xra-card"));
    await page.locator("#xra-view-toggle").click();
    assert.equal(await page.locator("#xra-root").getAttribute("data-view-mode"), "comfortable");
    const anchorAfter = await page.locator("#xra-root").evaluate(node => Array.from(node.querySelectorAll(".xra-card")).find(item => item.getBoundingClientRect().bottom > 48).getAttribute("data-xra-card"));
    assert.equal(anchorAfter, anchor);
    await page.getByRole("tab", { name: "1", exact: true }).click();
    await page.waitForURL(/2082771236799840538/);
    await page.waitForFunction(() => document.getElementById("xra-root")?.scrollTop > 200);
  });

  await check("active tab goes to top and refreshes without added toolbar", async () => {
    await page.getByRole("tab", { name: "1", exact: true }).click();
    assert.equal(await page.locator("#xra-root").evaluate(node => node.scrollTop), 0);
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("tab", { name: "1", exact: true }).click()]);
    await page.waitForSelector(".xra-card");
    assert.equal(await page.locator("#xra-root").evaluate(node => node.scrollTop), 0);
  });

  await check("list swipe changes lists, edge swipe and vertical scroll do not", async () => {
    const gesture = async (startX, startY, endX, endY) => page.locator(".xra-text").first().evaluate((node, points) => { const touch = (x, y, type) => new TouchEvent(type, { bubbles: true, touches: type === "touchstart" ? [new Touch({ identifier: 1, target: node, clientX: x, clientY: y })] : [], changedTouches: [new Touch({ identifier: 1, target: node, clientX: x, clientY: y })] }); node.dispatchEvent(touch(points[0], points[1], "touchstart")); node.dispatchEvent(touch(points[2], points[3], "touchend")); }, [startX, startY, endX, endY]);
    await gesture(2, 200, 150, 200);
    assert.match(page.url(), /2082771236799840538/);
    await gesture(150, 350, 145, 150);
    assert.match(page.url(), /2082771236799840538/);
    await gesture(280, 200, 110, 205);
    await page.waitForURL(/962319313385308166/);
  });

  await page.goto("https://x.com/reader/status/5000");
  await page.waitForSelector(".xra-detail-reply");
  await check("main post and quoted post stay separate", async () => {
    assert.equal(await page.locator(".xra-detail-body").textContent(), "本文と関連リンク");
    assert.equal(await page.locator(".xra-detail-quote-slot .xra-detail-quote-text").textContent(), "引用元の本文");
    assert.equal(await page.locator(".xra-detail-media-list img").count(), 2);
    assert.equal(await page.locator(".xra-detail-quote-slot img").count(), 1);
    assert.equal(await page.locator(".xra-detail-body a").getAttribute("href"), "https://example.org/story");
    assert.equal(await page.locator(".xra-detail-reply").count(), 2);
    assert.deepEqual(await page.locator(".xra-detail-reply").evaluateAll(nodes => nodes.map(node => node.dataset.statusId)), ["5001", "5002"]);
  });

  await check("detail image gallery is color and stays in detail", async () => {
    await page.locator(".xra-detail-media-list img").first().click();
    assert.equal(await page.locator("#xra-media-modal").getAttribute("data-view-mode"), "comfortable");
    await page.getByRole("button", { name: "次の画像", exact: true }).click();
    await page.keyboard.press("Escape");
    assert.equal(page.url(), "https://x.com/reader/status/5000");
  });

  await check("bookmark action still uses native X button", async () => {
    await page.locator(".xra-detail-bookmark").click();
    await page.waitForFunction(() => document.querySelector(".xra-detail-bookmark")?.dataset.saved === "true");
    assert.equal(await page.locator('[data-native="5000"] [data-testid="removeBookmark"]').count(), 1);
  });

  await check("late reply text and images update without duplicating cards", async () => {
    await page.locator('[data-native="5001"] [data-testid="tweetText"]').first().evaluate(node => { node.textContent = "後から読み込まれた返信の全文"; });
    await page.waitForFunction(() => document.querySelector('.xra-detail-reply[data-status-id="5001"] .xra-detail-reply-text')?.textContent === "後から読み込まれた返信の全文");
    assert.equal(await page.locator(".xra-detail-reply").count(), 2);
  });

  await check("native virtualization retains old replies and loads more", async () => {
    await page.locator('[data-native="5000"]').evaluate(node => node.remove());
    await page.locator('[data-native="5001"]').evaluate(node => node.remove());
    await page.locator("#native-timeline").evaluate((node, html) => node.insertAdjacentHTML("beforeend", html), post("5003", { text: "追加された返信" }));
    await page.waitForFunction(() => document.querySelectorAll(".xra-detail-reply").length === 3);
    assert.equal(await page.locator(".xra-detail-body").textContent(), "本文と関連リンク");
    assert.deepEqual(await page.locator(".xra-detail-reply").evaluateAll(nodes => nodes.map(node => node.dataset.statusId)), ["5001", "5002", "5003"]);
    await page.getByRole("button", { name: "続きを読み込む", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".xra-detail-replies-load").disabled);
  });

  await check("empty reply view settles and allows retry", async () => {
    await page.goto("https://x.com/reader/status/6000");
    await page.waitForSelector(".xra-detail-replies-load");
    await page.waitForFunction(() => document.querySelector(".xra-detail-loading")?.textContent === "表示できる返信がまだありません");
    assert.equal(await page.getByRole("button", { name: "再読み込み", exact: true }).count(), 1);
  });

  await check("media-only quoted post and late main text", async () => {
    await page.locator('[data-native="6000"]').evaluate((node, html) => { node.querySelector('[data-testid="tweetText"]').remove(); node.insertAdjacentHTML("afterbegin", html); }, "");
    await page.locator('[data-native="6000"]').evaluate((node, html) => node.insertAdjacentHTML("beforeend", html), quote("9902", "", 1));
    await page.waitForFunction(() => document.querySelector(".xra-detail-quote-slot img"));
    assert.equal(await page.locator(".xra-detail-media-list img").count(), 0);
    await page.locator('[data-native="6000"]').evaluate(node => node.insertAdjacentHTML("afterbegin", '<div data-testid="tweetText">遅れて届いた本文</div>'));
    await page.waitForFunction(() => document.querySelector(".xra-detail-body")?.textContent === "遅れて届いた本文");
  });

  await check("quote image click does not navigate; quote card does", async () => {
    await page.locator(".xra-detail-quote-slot img").click();
    await page.waitForSelector("#xra-media-modal");
    assert.equal(page.url(), "https://x.com/reader/status/6000");
    await page.keyboard.press("Escape");
    await page.locator(".xra-detail-quote-slot .xra-detail-quote").click({ position: { x: 8, y: 8 } });
    await page.waitForURL("https://x.com/quoted/status/9902");
  });

  await check("storage failure still allows reading and view switching", async () => {
    const privatePage = await context.newPage();
    privatePage.on("pageerror", error => errors.push(error.message));
    await privatePage.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("unavailable", "QuotaExceededError"); }; Storage.prototype.getItem = () => { throw new DOMException("blocked", "SecurityError"); }; });
    await privatePage.goto("https://x.com/home");
    await privatePage.waitForSelector(".xra-card");
    await privatePage.locator("#xra-view-toggle").click();
    assert.equal(await privatePage.locator("#xra-root").getAttribute("data-view-mode"), "comfortable");
    await privatePage.close();
  });

  await check("small mobile widths do not overflow", async () => {
    await page.goto("https://x.com/reader/status/5000");
    await page.waitForSelector("#xra-detail-root");
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 812 });
      assert.equal(await page.locator("#xra-detail-root").evaluate(node => node.scrollWidth <= node.clientWidth), true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
  });

  await check("pagehide keeps positions saved by another history page", async () => {
    await page.evaluate(() => { const saved = JSON.parse(sessionStorage.getItem("xra-reading-positions-v1") || "{}"); saved["/i/lists/other-history"] = { top: 321, savedAt: Date.now() }; sessionStorage.setItem("xra-reading-positions-v1", JSON.stringify(saved)); window.dispatchEvent(new Event("pagehide")); });
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("xra-reading-positions-v1"))["/i/lists/other-history"].top), 321);
  });

  await page.goto("https://x.com/home");
  await page.waitForSelector(".xra-card");
  await page.locator("#xra-root").evaluate(node => { node.xraRestore = null; node.scrollTop = 0; node.dataset.viewMode = "compact"; });
  const output = process.env.XRA_QA_DIR;
  if (output) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "feed.png") });
    await page.goto("https://x.com/reader/status/5000");
    await page.waitForSelector(".xra-detail-quote-slot img");
    await page.locator("#xra-detail-root").evaluate(node => { node.xraRestore = null; node.scrollTop = 0; });
    await page.screenshot({ path: path.join(output, "detail.png") });
  }
  assert.deepEqual(errors, []);
  console.log(`All ${passed} browser checks passed; no page errors.`);
  await browser.close();
})().catch(async error => { if (activePage && process.env.XRA_QA_DIR) { fs.mkdirSync(process.env.XRA_QA_DIR, { recursive: true }); await activePage.screenshot({ path: path.join(process.env.XRA_QA_DIR, "failure.png") }); } console.error(error); process.exit(1); });
