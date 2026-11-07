/**
 * tests/voices.test.mjs — La voix et le dialogue doivent dire la même chose du locuteur
 * ------------------------------------------------------------------------
 * Les répliques sont enregistrées avec une voix FÉMININE pour A et MASCULINE pour B
 * (scripts/build_audio.py : zf_003 / zm_012). Un dialogue qui contredit cela s'entend tout de suite :
 * « Madame, bonjour » dit à une voix d'homme, « Ravi de te rencontrer » dit par une voix de femme.
 *
 * Trois familles de contrôles, sur le chinois ET sur le français :
 *   - le titre d'adresse (先生 = monsieur, 女士 = madame) vise l'AUTRE interlocuteur ;
 *   - 你男朋友 / 你女朋友 : l'interlocuteur a un petit ami / une petite amie ;
 *   - les accords de « je suis … », « Ravi(e) », « tu es … » suivent le genre de celui dont on parle.
 *
 * Lancement :  node --test tests/voices.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lessons = JSON.parse(readFileSync(path.join(ROOT, 'lessons', 'hsk1.json'), 'utf8').replace(/^﻿/, '')).lessons;

const GENDER = { A: 'f', B: 'm' };                 // la convention des voix
const other = who => (who === 'A' ? 'B' : 'A');
const where = (l, i, e) => `${l.id}[${i}] ${e.who}: ${e.hanzi} | ${e.fr}`;

// Accords du français : [masculin, féminin]
const FORMS = [['ravi', 'ravie'], ['content', 'contente'], ['occupé', 'occupée'], ['étudiant', 'étudiante'],
  ['nouvel', 'nouvelle'], ['chinois', 'chinoise'], ['fatigué', 'fatiguée'], ['prêt', 'prête'], ['heureux', 'heureuse']];
const MASC = new Map(FORMS.map(([m, f]) => [m, f]));
const FEM = new Map(FORMS.map(([m, f]) => [f, m]));

/** Mots accordés dans « je suis … », « Ravi(e) de … » (le locuteur) et « tu es … », « Es-tu … » (l'interlocuteur). */
function agreement(fr) {
  const words = s => s.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ]+/g) || [];
  const speaker = [], addressee = [];
  const first = /(?:\bje suis|^ravi|\bravie? de)\s*((?:très |un |une |bien )?(?:[a-zà-ÿ]+))/gi;
  for (const m of fr.matchAll(first)) speaker.push(...words(m[0]));
  if (/^(bonjour ! )?ravie?\b/i.test(fr)) speaker.push(words(fr.replace(/^bonjour ! /i, ''))[0]);
  const second = /(?:\btu es|\bes-tu)\s*((?:un |une |très |bien )?(?:nouvel |nouvelle )?[a-zà-ÿ]+)/gi;
  for (const m of fr.matchAll(second)) addressee.push(...words(m[0]));
  return { speaker: [...new Set(speaker)], addressee: [...new Set(addressee)] };
}
const clashes = (list, gender) => list.filter(w => (gender === 'f' ? MASC.has(w) : FEM.has(w)));

test('a title of address (先生 / 女士) names the OTHER speaker\'s sex', () => {
  for (const l of lessons) l.exchanges.forEach((e, i) => {
    if (e.hanzi.includes('先生')) assert.equal(GENDER[other(e.who)], 'm', `先生 says “monsieur” to a woman: ${where(l, i, e)}`);
    if (e.hanzi.includes('女士')) assert.equal(GENDER[other(e.who)], 'f', `女士 says “madame” to a man: ${where(l, i, e)}`);
  });
});

test('你男朋友 / 你女朋友 fits the person being asked', () => {
  for (const l of lessons) l.exchanges.forEach((e, i) => {
    if (e.hanzi.includes('你男朋友')) assert.equal(GENDER[other(e.who)], 'f', `a man is asked about “his boyfriend”: ${where(l, i, e)}`);
    if (e.hanzi.includes('你女朋友')) assert.equal(GENDER[other(e.who)], 'm', `a woman is asked about “her girlfriend”: ${where(l, i, e)}`);
  });
});

test('French agreements follow the speaker\'s voice (je suis …, Ravi(e)) and the listener\'s (tu es …)', () => {
  for (const l of lessons) l.exchanges.forEach((e, i) => {
    const { speaker, addressee } = agreement(e.fr);
    assert.deepEqual(clashes(speaker, GENDER[e.who]), [], `agreement with the speaker: ${where(l, i, e)}`);
    assert.deepEqual(clashes(addressee, GENDER[other(e.who)]), [], `agreement with the listener: ${where(l, i, e)}`);
  });
});

test('the checks do catch the mistakes they are meant to catch', () => {
  // A = voix féminine : « Ravi » est une faute ; B = voix masculine : « occupée » en est une
  assert.deepEqual(clashes(agreement('Bonjour ! Ravi de te rencontrer.').speaker, 'f'), ['ravi']);
  assert.deepEqual(clashes(agreement('Moi aussi, je suis très occupée.').speaker, 'm'), ['occupée']);
  assert.deepEqual(clashes(agreement('Tu es un nouvel étudiant ?').addressee, 'f'), ['nouvel', 'étudiant']);
  assert.deepEqual(clashes(agreement('Je suis professeur.').speaker, 'f'), []);          // invariable
});
