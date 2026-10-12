const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../x-reader.user.js'), 'utf8');
const extract = (name, next) => source.slice(source.indexOf(`  const ${name} =`), source.indexOf(next, source.indexOf(`  const ${name} =`)));
class Element {
  constructor() { this.children = []; this.dataset = {}; this.events = {}; }
  appendChild(node) { node.parent = this; this.children.push(node); }
  remove() { this.parent.children = this.parent.children.filter(n => n !== this); }
  setAttribute() {}
  addEventListener(type, fn) { this.events[type] = fn; }
  querySelector() { return this.children.find(n => n.className === 'xra-message'); }
}
let now = 1000, reloads = 0, native = 0;
const reader = { owned: true }, nativeMain = { owned: false }, root = { xraCreatedAt: 1000 };
const context = vm.createContext({ Date: { now: () => now }, ROOT_ID: 'root', isOwnedUiNode: n => n.owned,
 document: { querySelectorAll: () => [reader, nativeMain], body: {}, getElementById: () => root, createElement: () => new Element() },
 location: { reload: () => reloads++ }, disableReader: () => native++ });
vm.runInContext(extract('nativeContentScope', '  // Xの探索画面') + '\nglobalThis.scope = nativeContentScope; globalThis.render = renderLoadState;', context);
assert.equal(context.scope(), nativeMain, 'ignore Reader main when native content arrives after overlay');
const list = new Element(); context.render(list, '投稿');
assert.equal(list.children[0].dataset.phase, 'pending');
now = 9000; context.render(list, '投稿');
assert.equal(list.children.length, 1);
assert.equal(list.children[0].dataset.phase, 'timeout');
const actions = list.children[0].children[0].children;
actions[0].events.click(); actions[1].events.click();
assert.equal(reloads, 2); assert.equal(native, 1);
context.render(list, '投稿'); assert.equal(list.children.length, 1, 'no repeated message replacement');
for (const [name, end, read, selector] of [
 ['renderExploreTopics', '  const renderNotifications', 'readExploreTopics', '.xra-trend-item'],
 ['renderNotifications', '  const renderCurrentFeed', null, '.xra-notification-item']
]) {
 const ctx = vm.createContext({ ...context, readExploreTopics: () => [], nativeContentScope: () => ({ querySelectorAll: () => [] }), renderLoadState: () => { throw Error('loaded items must be preserved'); } });
 vm.runInContext(extract(name, end) + `\nglobalThis.render = ${name};`, ctx);
 ctx.render({ querySelector: value => value === selector ? {} : null });
}
console.log('PASS: native scope, loading timeout, retry, native fallback, preserving loaded topics/notifications');
