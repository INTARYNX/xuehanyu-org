/**
 * tests/app-tone.test.mjs — Tests d'intégration de la couche applicative
 * ------------------------------------------------------------------------
 * Charge `app.js` dans un DOM simulé et vérifie la logique « ton » de
 * l'interface : ton de référence (forme citée), sandhi affiché à titre
 * informatif, notation (grades), bandeau de mesures, rendu du graphique.
 *
 * Lancement :  node --test tests/app-tone.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import ToneDSP from '../tone-dsp.js';

// ---------------------------------------------------------------------------
// DOM simulé
// ---------------------------------------------------------------------------

function makeCtx() {
  const state = {};
  return new Proxy({}, {
    get(_t, prop) {
      if (prop in state) return state[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'getImageData') {
        return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)) });
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      return () => {};
    },
    set(_t, prop, value) { state[prop] = value; return true; }
  });
}

function makeElement(id) {
  const el = {
    id,
    className: '',
    textContent: '',
    style: {},
    clientWidth: 300,
    width: 320,
    height: 90,
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
    },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return makeElement(''); },
    querySelectorAll() { return []; },
    getContext() { return makeCtx(); },
    focus() {},
    setAttribute() {},
    getAttribute() { return null; }
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(v) {
      html = String(v);
      // Les éléments créés par innerHTML deviennent adressables par id.
      for (const m of html.matchAll(/id="([^"]+)"/g)) registry.set(m[1], makeElement(m[1]));
    }
  });
  return el;
}

const registry = new Map();

const document = {
  getElementById(id) {
    if (!registry.has(id)) registry.set(id, makeElement(id));
    return registry.get(id);
  },
  querySelector() { return makeElement(''); },
  querySelectorAll() { return []; },
  createElement(tag) { return makeElement(tag); },
  addEventListener() {},
  body: makeElement('body'),
  documentElement: makeElement('html')
};

const sandbox = {
  document,
  console,
  ToneDSP,
  location: { search: '' },
  URLSearchParams,
  navigator: { mediaDevices: { getUserMedia: () => Promise.reject(new Error('no mic')) } },
  speechSynthesis: { getVoices: () => [], speak() {}, addEventListener() {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  fetch: () => Promise.reject(new Error('offline')),
  window: {
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    addEventListener() {},
    requestAnimationFrame: () => 0
  }
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;

// Expose les symboles internes pour les assertions.
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const exposed = `
globalThis.__app = {
  startToneDetection, renderTonePractice, renderToneActions, showResultFeedback,
  drawExpectedCurve, drawLiveCurve, gradeTone, getExpectedTones, applySandhi,
  stopToneSession, TONE_SHAPES, TONE_NAMES, TONE_MIN_CONFIDENCE,
  get toneSession() { return toneSession; }
};`;

vm.createContext(sandbox);
vm.runInContext(source + exposed, sandbox, { filename: 'app.js' });

const app = sandbox.__app;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('l’application se charge sans erreur et expose le module DSP', () => {
  assert.ok(app, 'app.js n’a pas été chargé');
  assert.equal(typeof sandbox.ToneDSP.analyze, 'function');
});

test('le ton de référence est la FORME CITÉE (pas le sandhi)', () => {
  // nǐ (3) hǎo (3) : le sandhi du mot entier transforme le premier en 2,
  // mais la syllabe est pratiquée isolément → le ton de référence reste 3.
  const expected = app.getExpectedTones('nǐ hǎo');
  assert.equal(expected[0].tone, 3);
  assert.equal(expected[1].tone, 3);

  const sandhi = app.applySandhi(expected);
  assert.equal(sandhi[0].tone, 2, 'le sandhi 3-3 doit rester informatif');
  assert.equal(sandhi[1].tone, 3);
});

test('startToneDetection : la section s’ouvre et affiche la syllabe et son ton', async () => {
  await app.startToneDetection('nǐ hǎo');
  const section = document.getElementById('toneSection');
  assert.ok(section.classList.contains('visible'), 'la section n’est pas visible');
  assert.ok(section.innerHTML.includes('nǐ'), 'la syllabe n’est pas affichée');
  assert.ok(section.innerHTML.includes('creusé'), 'le nom du ton n’est pas affiché');
  assert.ok(section.innerHTML.includes('v'), 'le symbole du ton n’est pas affiché');
  // Le sandhi est signalé mais n’est pas le ton de référence.
  assert.ok(section.innerHTML.includes('sandhi-tag'), 'le sandhi informatif n’est pas signalé');
});

test('le sandhi n’apparaît pas quand il ne change rien', async () => {
  await app.startToneDetection('mā ma');
  const section = document.getElementById('toneSection');
  assert.ok(!section.innerHTML.includes('sandhi-tag'), 'un sandhi inexistant est affiché');
});

test('gradeTone : parfait, proche, faux et incertain', () => {
  assert.equal(app.gradeTone(4, 4, 0.9), 'perfect');
  assert.equal(app.gradeTone(1, 4, 0.9), 'close');   // plat ↔ tombant
  assert.equal(app.gradeTone(2, 4, 0.9), 'wrong');   // montant ↔ tombant
  assert.equal(app.gradeTone(null, 4, 0), 'unclear'); // aucun ton décidable
  assert.equal(app.gradeTone(4, 4, 0.2), 'unclear');  // confiance trop faible
});

test('showResultFeedback : bandeau de mesures et état « incertain »', () => {
  const status = document.getElementById('toneStatus');

  app.showResultFeedback({
    detected: 4, grade: 'perfect', hint: '',
    features: { fStartHz: 141.6, fEndHz: 118.2, slope: -3.1, durationMs: 342 },
    confidence: 0.82, reason: 'falling'
  }, { tone: 4, syllable: 'mà' }, { expected: 'attendu', yours: 'le tien' });

  assert.ok(status.className.includes('grade-perfect'));
  assert.ok(status.innerHTML.includes('142 Hz'), 'la F0 de début est absente');
  assert.ok(status.innerHTML.includes('118 Hz'), 'la F0 de fin est absente');
  assert.ok(status.innerHTML.includes('342 ms'), 'la durée est absente');
  assert.ok(status.innerHTML.includes('82 %'), 'la confiance est absente');

  app.showResultFeedback({
    detected: null, grade: 'unclear', hint: '',
    features: null, confidence: 0, reason: 'no-voice'
  }, { tone: 4, syllable: 'mà' }, { expected: 'attendu', yours: 'le tien' });

  assert.ok(status.className.includes('grade-unclear'));
  assert.ok(status.innerHTML.toLowerCase().includes('signal'), 'le message d’absence de signal est absent');
});

test('drawExpectedCurve : rendu sur l’échelle en demi-tons sans exception', () => {
  app.drawExpectedCurve(4, [3, 2, 1, 0, -1, -2, -3]);
  app.drawExpectedCurve(2, null);
  app.drawExpectedCurve(null, null);
});

test('drawLiveCurve : aperçu temps réel à partir de trames', () => {
  const frames = [
    { t: 0, freq: 150, clarity: 0.9, rms: 0.05 },
    { t: 17, freq: 160, clarity: 0.9, rms: 0.05 },
    { t: 34, freq: 170, clarity: 0.9, rms: 0.05 },
    { t: 51, freq: 180, clarity: 0.9, rms: 0.05 }
  ];
  app.drawLiveCurve(frames, 2);
});

test('stopToneSession : libère le micro sans erreur quand aucune session n’est active', () => {
  app.stopToneSession();
});
