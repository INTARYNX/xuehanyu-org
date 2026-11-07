import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Speech = createRequire(import.meta.url)('../speech.js');

const v = (name, lang) => ({ name, lang });

// La liste réelle d'un PC Windows sans pack chinois (celle qui rendait la prononciation muette).
const WINDOWS_NO_ZH = [
  v('Microsoft George - English (United Kingdom)', 'en-GB'), v('Microsoft Hazel - English (United Kingdom)', 'en-GB'),
  v('Microsoft Susan - English (United Kingdom)', 'en-GB'), v('Microsoft Guillaume - French (Switzerland)', 'fr-CH'),
];

test('a Windows PC with no Chinese pack gets "none": the user is told instead of hearing nothing', () => {
  assert.equal(Speech.verdict(WINDOWS_NO_ZH), 'none');
  assert.equal(Speech.pickVoice(WINDOWS_NO_ZH), null);
});

test('an empty list is "unknown": some browsers hide their voices but still speak with lang=zh-CN', () => {
  assert.equal(Speech.verdict([]), 'unknown');
  assert.equal(Speech.verdict(undefined), 'unknown');
});

test('Chinese voices are recognised by language tag or by name', () => {
  for (const voice of [v('Google 普通话（中国大陆）', 'zh-CN'), v('Microsoft Huihui - Chinese (Simplified, PRC)', 'zh-CN'),
    v('Tingting', 'zh_CN'), v('Android', 'cmn-Hans-CN'), v('Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', 'zh-CN'),
    v('Sinji', 'zh-HK'), v('Some voice', 'yue-HK'), v('Huihui Desktop', 'en-US'), v('Mandarin voice', '')]) {
    assert.equal(Speech.isChinese(voice), true, JSON.stringify(voice));
    assert.equal(Speech.verdict([voice]), 'ok');
  }
  for (const voice of [v('Microsoft Zira', 'en-US'), v('Thomas', 'fr-FR'), v('Kyoko', 'ja-JP'), v('Yuna', 'ko-KR'), null, undefined]) {
    assert.equal(Speech.isChinese(voice), false, JSON.stringify(voice));
  }
});

test('the mainland voice wins over Hong Kong / Taiwan ones, wherever it is in the list', () => {
  const list = [v('Sinji', 'zh-HK'), v('Meijia', 'zh-TW'), v('Tingting', 'zh-CN'), v('Samantha', 'en-US')];
  assert.equal(Speech.pickVoice(list).name, 'Tingting');
  assert.equal(Speech.pickVoice([v('Sinji', 'zh-HK'), v('Meijia', 'zh-TW')]).name, 'Sinji');
});

test('the help text matches the system', () => {
  assert.equal(Speech.platformOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156', 'Win32'), 'windows');
  assert.equal(Speech.platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), 'mac');
  assert.equal(Speech.platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), 'ios');
  assert.equal(Speech.platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)', 'iPhone', 5), 'ios');
  assert.equal(Speech.platformOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124', 'Linux armv8l'), 'android');
  assert.equal(Speech.platformOf('Mozilla/5.0 (X11; Linux x86_64) Firefox/126', 'Linux x86_64'), 'linux');
});

test('every French message has an English counterpart', () => {
  assert.deepEqual(Object.keys(Speech.T.fr).sort(), Object.keys(Speech.T.en).sort());
});

test('audioKey names a word file by its codepoints (same rule as scripts/build_audio.py)', () => {
  assert.equal(Speech.audioKey('爱'), '7231');
  assert.equal(Speech.audioKey('你好'), '4f60-597d');
  assert.equal(Speech.audioKey('𠮷'), '20bb7');           // beyond the BMP: one codepoint, not two surrogates
});
