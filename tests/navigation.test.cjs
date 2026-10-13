const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../x-reader.user.js'), 'utf8');
const extract = (name, end) => source.slice(source.indexOf(`  const ${name} =`), source.indexOf(`  const ${end} =`, source.indexOf(`  const ${name} =`)));
let now = 1000, clicks = 0, assigns = 0, saved = 0, nativeScrolls = 0;
let nextTimer = 1;
const timers = new Map();
const setTimeoutFake = (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, at: now + delay }); return id; };
const advance = ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } };
const link = (href, owned = false) => ({ getAttribute: () => href, closest: () => owned ? {} : null, click: () => { clicks++; } });
let links = [link('/ngmkkrm', true), link('/ngmkkrm')];
const location = { origin: 'https://x.com', href: 'https://x.com/home', pathname: '/home', assign: () => { assigns++; } };
const root = { id: 'xra-root', isConnected: true, xraPath: '/home', xraRestore: {}, xraLoadTimers: [], scrollHeight: 900, scrollTop: 300, clientHeight: 600, querySelector: () => ({}) };
let restoredOld = 0;
root.xraRestoreTimer = setTimeoutFake(() => restoredOld++, 500);
root.xraLoadTimers.push(setTimeoutFake(() => restoredOld++, 1000));
const context = vm.createContext({ URL, Date: { now: () => now }, location, ROOT_ID: 'xra-root', DETAIL_ROOT_ID: 'xra-detail-root', CARD_ATTR: 'data-xra-card',
 document: { querySelectorAll: () => links, getElementById: id => id === root.id ? root : null },
 setTimeout: setTimeoutFake, clearTimeout: id => timers.delete(id), saveCurrentPosition: () => { saved++; }, currentPageKey: () => location.pathname,
 readSetting: () => 'true', history: { length: 1 }, window: { scrollBy: () => nativeScrolls++ },
 detectInitialSection() {}, syncPageMode() {}, isDetailPage: () => false, renderCurrentFeed() {} });
vm.runInContext('let readerGeneration = 0, renderTimer = null, preloadLocked = false, detailPreloadLocked = false, navigationPending = null; let lastUrl = location.href;\n' +
 extract('cancelReaderActivity', 'tryRestorePosition') + extract('preloadNativeFeed', 'switchSection') + extract('syncReaderRoute', 'start') +
 '\nglobalThis.api = { go: navigateReader, sync: syncReaderRoute, preload: preloadNativeFeed, locked: () => preloadLocked };', context);
const api = context.api;
api.go('https://x.com/ngmkkrm'); api.go('https://x.com/ngmkkrm');
assert.equal(clicks, 1, 'two taps produce one native navigation');
assert.equal(assigns, 0); assert.equal(saved, 1); assert.equal(root.xraRestore, null);
advance(1000); assert.equal(restoredOld, 0, 'old restore and startup timers were cancelled');
location.href = 'https://x.com/ngmkkrm'; location.pathname = '/ngmkkrm'; api.sync();
root.xraPath = location.pathname;
api.preload(root); assert.equal(api.locked(), true);
advance(300);
links = []; api.go('https://x.com/i/lists/123'); assert.equal(assigns, 1);
location.href = 'https://x.com/i/lists/123'; location.pathname = '/i/lists/123'; api.sync(); root.xraPath = location.pathname;
api.preload(root); assert.equal(api.locked(), true);
advance(350); assert.equal(api.locked(), true, 'old page timer cannot unlock a new page request');
advance(300); assert.equal(api.locked(), false);
assert.equal(nativeScrolls, 2);
console.log('PASS: duplicate navigation blocked, old timers cancelled, preload callback isolated by page');
