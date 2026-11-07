import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Pwa = createRequire(import.meta.url)('../pwa.js');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const full = { hasSW: true, hasPush: true, hasNotification: true, permission: 'default', subscribed: false, standalone: false, canPrompt: false, platform: '', touchPoints: 0 };

test('iPhone in a Safari tab: manual install steps, no push yet (PushManager absent)', () => {
  const d = Pwa.decide({ ...full, ua: IPHONE, platform: 'iPhone', touchPoints: 5, hasPush: false });
  assert.equal(d.install, 'ios');
  assert.equal(d.push, 'needs-install');
  assert.equal(d.visible, true);
});

test('iPhone with the app on the home screen: push can be turned on, install is done', () => {
  const d = Pwa.decide({ ...full, ua: IPHONE, platform: 'iPhone', touchPoints: 5, standalone: true });
  assert.equal(d.install, 'done');
  assert.equal(d.push, 'off');
});

test('iPadOS reports as a Mac but has touch points', () => {
  assert.equal(Pwa.isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), true);
  assert.equal(Pwa.isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), false);
});

test('Android Chrome: native install prompt when available, menu hint otherwise', () => {
  assert.equal(Pwa.decide({ ...full, ua: ANDROID, canPrompt: true }).install, 'prompt');
  assert.equal(Pwa.decide({ ...full, ua: ANDROID }).install, 'menu');
});

test('push states: off, on, denied', () => {
  assert.equal(Pwa.decide({ ...full, ua: ANDROID }).push, 'off');
  assert.equal(Pwa.decide({ ...full, ua: ANDROID, permission: 'granted', subscribed: true }).push, 'on');
  assert.equal(Pwa.decide({ ...full, ua: ANDROID, permission: 'granted', subscribed: false }).push, 'off');
  assert.equal(Pwa.decide({ ...full, ua: ANDROID, permission: 'denied' }).push, 'denied');
});

test('no push support and nothing to install: the card stays hidden', () => {
  const d = Pwa.decide({ ...full, ua: DESKTOP, hasPush: false });
  assert.equal(d.push, 'unsupported');
  assert.equal(d.install, 'none');
  assert.equal(d.visible, false);
});

test('installed desktop app with push support still shows the reminder', () => {
  const d = Pwa.decide({ ...full, ua: DESKTOP, standalone: true });
  assert.equal(d.install, 'done');
  assert.equal(d.visible, true);
});

test('urlB64ToBytes decodes a base64url VAPID key', () => {
  const bytes = Pwa.urlB64ToBytes('AQID_w'); // 01 02 03 ff
  assert.deepEqual([...bytes], [1, 2, 3, 255]);
});

test('validTime accepts HH:MM only', () => {
  for (const ok of ['00:00', '07:30', '19:00', '23:59']) assert.equal(Pwa.validTime(ok), true, ok);
  for (const bad of ['24:00', '7:30', '19:60', '', null, '19:00:00']) assert.equal(Pwa.validTime(bad), false, String(bad));
});

test('every French string has an English counterpart', () => {
  assert.deepEqual(Object.keys(Pwa.T.fr).sort(), Object.keys(Pwa.T.en).sort());
});
