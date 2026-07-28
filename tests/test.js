const api = require('../js/app.js');
const assert = require('assert');

/* ---------- Тест 1: замены через границу блоков, тире, кавычки, пустые блоки ---------- */
const srtText = `1
00:00:01,000 --> 00:00:02,000
Hello world this is
a test of subtitles

2
00:00:02,000 --> 00:00:03,000
second block goes here fine
and don't stop now

3
00:00:03,000 --> 00:00:03,500

`;

const docRaw = `Hello world, this is a test of subtitles.
Second block: goes right here fine — and don\u2019t stop now`;

const srt = api.parseSRT(srtText);
let docText = api.normChars(api.normalizeDashes(docRaw));
const b = docText.split(/\s+/).filter(Boolean);
const a = srt.words.map(w => w.text);
const ops = api.diffTokens(a, b, (x, y) => api.normToken(x) === api.normToken(y));
const groups = api.groupOps(ops);
const out = api.buildCorrected(srt, b, ops, groups, { removeEmpty: true });
console.log('--- T1 OUTPUT ---\n' + out + '--- END ---');

assert(out.includes('Hello world, this is\na test of subtitles.'), 'замена в блоке 1 + перенос сохранён');
assert(out.includes('Second block: goes right here fine -\nand don\'t stop now'), 'вставки на своей строке, тире дока -> "-", апостроф из SRT');
assert(!/\n\n3\n/.test(out) && out.trim().split('\n\n').length === 2, 'пустой блок удалён');
assert(out.startsWith('1\n00:00:01,000'), 'нумерация с 1');

/* ---------- Тест 2: буллит на границе блоков уходит в следующий блок ---------- */
const srt2 = api.parseSRT(`1
00:00:01,000 --> 00:00:02,000
benefits include Partner
Benefits and Rallies

2
00:00:02,000 --> 00:00:03,000
Access exclusive things
from partners today
`);
const doc2 = 'benefits include Partner Benefits and Rallies \u2022 Access exclusive things from partners today';
const b2 = api.normChars(doc2).split(/\s+/).filter(Boolean);
const a2 = srt2.words.map(w => w.text);
const ops2 = api.diffTokens(a2, b2, (x, y) => api.normToken(x) === api.normToken(y));
const groups2 = api.groupOps(ops2);
const out2 = api.buildCorrected(srt2, b2, ops2, groups2, { removeEmpty: true });
console.log('--- T2 OUTPUT ---\n' + out2 + '--- END ---');
assert(out2.includes('\n\u2022 Access exclusive things'), 'буллит прикреплён к следующему блоку');
assert(out2.includes('Benefits and Rallies\n\n2'), 'первый блок не получил буллит');

/* ---------- Тест 3: длинное чистое удаление по умолчанию выключено ---------- */
const srt3 = api.parseSRT(`1
00:00:01,000 --> 00:00:02,000
Hi I am Jeff a staff engineer
here at the company for years

2
00:00:02,000 --> 00:00:03,000
The product is great
`);
const b3 = 'The product is great'.split(/\s+/);
const a3 = srt3.words.map(w => w.text);
const ops3 = api.diffTokens(a3, b3, (x, y) => api.normToken(x) === api.normToken(y));
const groups3 = api.groupOps(ops3);
assert(groups3.length === 1 && groups3[0].applied === false, 'длинное удаление по умолчанию OFF');
const out3 = api.buildCorrected(srt3, b3, ops3, groups3, { removeEmpty: true });
assert(out3.includes('Hi I am Jeff'), 'вступление сохранено при OFF');
groups3[0].applied = true;
const out3b = api.buildCorrected(srt3, b3, ops3, groups3, { removeEmpty: true });
assert(!out3b.includes('Jeff') && out3b.startsWith('1\n00:00:02,000'), 'при ON вступление удалено, пустой блок выпал, нумерация с 1');
console.log('--- T3 OK ---');

/* ---------- Тест 4: перенос строки при удалении слова-носителя переноса ---------- */
const srt4 = api.parseSRT(`1
00:00:01,000 --> 00:00:02,000
alpha beta gamma delta epsilon zeta
eta theta iota kappa lambda mu
`);
const b4 = 'alpha beta gamma delta epsilon eta theta iota kappa lambda mu'.split(/\s+/); // zeta удалена
const a4 = srt4.words.map(w => w.text);
const ops4 = api.diffTokens(a4, b4, (x, y) => x === y);
const g4 = api.groupOps(ops4);
const out4 = api.buildCorrected(srt4, b4, ops4, g4, { removeEmpty: true });
console.log('--- T4 OUTPUT ---\n' + out4 + '--- END ---');
const lines4 = out4.trim().split('\n');
assert(lines4.length === 4, 'блок перебит на 2 строки после потери переноса');

console.log('ALL ASSERTS OK');
