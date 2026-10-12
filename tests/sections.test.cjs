const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../x-reader.user.js'), 'utf8');
const start = source.indexOf('  const CONFIG =');
const end = source.indexOf('  let activeSectionId =', start);
const settings = JSON.stringify([
  { id: 'list2', label: '映画', url: 'https://twitter.com/i/lists/123456789' },
  { id: 'list1', label: '悪いURL', url: 'https://example.org/list' }
]);
const location = { pathname: '/i/lists/123456789', search: '' };
const context = vm.createContext({ URL, location, isSearchPage: () => false, SECTION_SETTINGS_KEY: "xra-section-settings-v1", readSetting: () => settings });
vm.runInContext(source.slice(start, end) + '\nglobalThis.result = { CONFIG, normalizeSectionUrl, matchesSectionUrl, isReaderFeedPage };', context);
const { CONFIG, normalizeSectionUrl, matchesSectionUrl, isReaderFeedPage } = context.result;
assert.equal(CONFIG.sections[2].label, '映画');
assert.equal(CONFIG.sections[2].url, 'https://x.com/i/lists/123456789');
assert.equal(CONFIG.sections[1].label, '1', 'ignore invalid stored URL');
assert.equal(matchesSectionUrl(CONFIG.sections[2]), true);
assert.equal(isReaderFeedPage(), true);
assert.equal(normalizeSectionUrl('https://example.org/list'), null);
assert.equal(normalizeSectionUrl('https://x.com/'), null);
assert.equal(normalizeSectionUrl('https://evil@x.com/i/lists/1'), null);
assert.equal(normalizeSectionUrl('https://x.com/explore'), null);
assert.equal(normalizeSectionUrl('https://x.com/search?q=映画'), 'https://x.com/search?q=%E6%98%A0%E7%94%BB');
console.log('PASS: tab names, URL normalization, saved settings, invalid URL rejection and page matching');
