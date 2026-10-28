import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('first launch migrates English browser default to Arabic and preserves an explicit later choice', async () => {
  const source = await fs.readFile(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
  const saved = new Map();
  let locale = 'en';
  const document = { documentElement: { lang: '', dir: '' } };
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, document,
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) },
    require: name => name === '$app/environment' ? { browser: true } : name === 'svelte/store' ? {
      writable: value => ({ value, set(next) { this.value = next; }, update(fn) { this.value = fn(this.value); } }), get: store => store.value
    } : { getLocale: () => locale, setLocale: next => { locale = next; }, getTextDirection: next => next === 'ar' ? 'rtl' : 'ltr' }
  });
  exports.syncLocale();
  assert.equal(locale, 'ar'); assert.equal(document.documentElement.dir, 'rtl');
  exports.updateLocale('en'); exports.syncLocale();
  assert.equal(locale, 'en'); assert.equal(document.documentElement.lang, 'en');
});

test('Arabic messages preserve interpolation arguments from English', async () => {
  const read = async name => JSON.parse(await fs.readFile(new URL(`../messages/${name}.json`, import.meta.url), 'utf8'));
  const ar = await read('ar'); const en = await read('en');
  const args = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(m => m[1]).sort();
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) assert.deepEqual(args(ar[key]), args(en[key]), key);
});
