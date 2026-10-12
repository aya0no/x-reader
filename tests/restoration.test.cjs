const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../x-reader.user.js'), 'utf8');
const start = source.indexOf('  const tryRestorePosition =');
const end = source.indexOf('  const CONFIG =', start);
let now = 1000, hasContent = false, scrolls = 0;
const root = { id: 'xra-root', isConnected: true, scrollTop: 0, scrollHeight: 600, clientHeight: 600, querySelector: () => hasContent ? {} : null, addEventListener() {} };
const context = vm.createContext({ Date: { now: () => now }, ROOT_ID: 'xra-root', currentPageKey: () => '/home',
 readingPositions: { '/home': { top: 2000, nativeTop: 4000, anchor: 'post-30', savedAt: 1000 } },
 isCurrentReaderRoot: node => node.isConnected && node.xraPath === '/home', readingItems: () => [], readingKey: () => '',
 setTimeout: () => 1, clearTimeout() {}, window: { innerHeight: 800, scrollTo: () => scrolls++, scrollBy: () => scrolls++ }, saveReadingPosition() {} });
vm.runInContext(source.slice(start, end) + '\nglobalThis.track = trackReadingPosition; globalThis.restore = tryRestorePosition;', context);
context.track(root); assert.equal(scrolls, 0, 'do not restore the native page during initial loading');
now = 2000; context.restore(root); assert.equal(scrolls, 0, 'no scroll requests without loaded content');
hasContent = true; context.restore(root); assert.equal(scrolls, 1, 'restore after content arrives');
root.isConnected = false; now = 3000; context.restore(root); assert.equal(scrolls, 1, 'detached page cannot scroll the new page');
root.isConnected = true; hasContent = false; now = 10000; context.restore(root);
assert.equal(root.xraRestore, null); assert.equal(scrolls, 1);
console.log('PASS: wait for content, cancel after page removal, bounded restoration timeout');
