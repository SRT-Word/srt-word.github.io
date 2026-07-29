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

/* ---------- Тест 5: замены не переезжают в чужой тайм-код (De Dion) ---------- */
const srt5 = api.parseSRT(`12
00:01:12,100 --> 00:01:18,040
The new suspension architecture replaces the
previous live axle with a D-D-On

13
00:01:18,040 --> 00:01:23,100
style suspension, light and rigid swing arm
assembly, keeping the rear frame
`);
const doc5raw = 'The new suspension architecture replaces the previous live axle with a De Dion -style suspension, light and rigid swingarm assembly keeping the rear frame';
let d5 = api.stripWordComments(doc5raw);
d5 = api.normalizeDashes(d5);
d5 = api.fixPunctuationCollisions(api.splitGluedSentences(api.normChars(d5)));
const b5 = d5.split(/\s+/).filter(Boolean);
const a5 = srt5.words.map(w => w.text);
const ops5 = api.diffTokens(a5, b5, (x, y) => api.normToken(x) === api.normToken(y));
const g5 = api.groupOps(ops5);
const out5 = api.buildCorrected(srt5, b5, ops5, g5, { removeEmpty: true });
console.log('--- T5 OUTPUT ---\n' + out5 + '--- END ---');
const blocks5 = out5.trim().split('\n\n').map(x => x.split('\n'));
const b12text = blocks5[0].slice(2).join(' ');
const b13text = blocks5[1].slice(2).join(' ');
assert(b12text.endsWith('with a De Dion -'), 'блок 12 заканчивается на "De Dion -", получено: ' + b12text);
assert(!/\bDion\b/.test(b13text), 'Dion не переехал в блок 13');
assert(b13text.startsWith('style suspension,'), 'блок 13 начинается со "style suspension,", получено: ' + b13text);
assert(!/\bstyle\b/.test(b12text), 'style не переехал в блок 12');
assert(b13text.includes('swingarm assembly keeping'), 'swingarm заменён, запятая убрана');

/* ---------- Тест 6: пунктуационные коллизии после вырезок ---------- */
assert.strictEqual(
  api.fixPunctuationCollisions('helmets. , so access is quick'),
  'helmets, so access is quick', '". ," перед строчной -> запятая');
assert.strictEqual(
  api.fixPunctuationCollisions('dry and ready. , And for riders'),
  'dry and ready. And for riders', '". ," перед заглавной -> точка');
assert.strictEqual(
  api.fixPunctuationCollisions('providing precise, . Short rides'),
  'providing precise. Short rides', '", ." перед заглавной -> точка');
assert.strictEqual(
  api.fixPunctuationCollisions('conditions, . the road'),
  'conditions, the road', '", ." перед строчной -> запятая');
assert.strictEqual(
  api.fixPunctuationCollisions('Wait... And more...'),
  'Wait... And more...', 'троеточие не тронуто');
assert.strictEqual(
  api.fixPunctuationCollisions('is quick? , and ready'),
  'is quick? and ready', '"? ," -> "?"');
assert.strictEqual(
  api.fixPunctuationCollisions('raingear , dry'),
  'raingear, dry', 'оторванная запятая приклеена');

/* ---------- Тест 7: чистка Word-комментариев из вставленного текста ---------- */
const dirty = `the Grand Tour-Pak[[ZD1]](#_msocom_1)  is available for Trike, giving you secure storage.
 [[ZD1]](#_msoanchor_1)"available on.........." not on all models as OEM
 [[SJ3]](#_msoanchor_3)[@Nixdorf, Mike](mailto:m@x.com) -- thanks for this question...
The next real line stays.`;
const cleaned = api.stripWordComments(dirty);
assert(!cleaned.includes('msocom') && !cleaned.includes('msoanchor'), 'ссылки комментариев удалены');
assert(!cleaned.includes('not on all models'), 'строка-тело комментария удалена');
assert(!cleaned.includes('thanks for this question'), 'вторая строка-тело удалена');
assert(cleaned.includes('the Grand Tour-Pak is available'), 'основной текст цел, пробелы сжаты: ' + JSON.stringify(cleaned.slice(0, 60)));
assert(cleaned.includes('The next real line stays.'), 'обычные строки не тронуты');


/* ---------- Тест 8: вырезка ~~ ~~ не склеивает слова (providing optimal) ---------- */
const srt8 = api.parseSRT(`20
00:01:56,400 --> 00:02:00,980
and right emulsion shocks enhance ride
performance by providing precise optimal response
`);
const doc8 = 'The left and right emulsion shocks enhance ride performance by providing~~ precise ~~optimal response across diverse road conditions.';
let d8 = api.stripWordComments(doc8);
d8 = api.fixPunctuationCollisions(api.splitGluedSentences(api.normChars(d8)));
assert(d8.includes('providing optimal response'), 'зачёркнутое заменено пробелом, не склейка: ' + d8);
const b8 = d8.split(/\s+/).filter(Boolean);
const a8 = srt8.words.map(w => w.text);
const ops8 = api.diffTokens(a8, b8, (x, y) => api.normToken(x) === api.normToken(y));
const g8 = api.groupOps(ops8);
const out8 = api.buildCorrected(srt8, b8, ops8, g8, { removeEmpty: true });
assert(out8.includes('by providing optimal response'), 'в SRT "providing optimal", а не "providingoptimal"');
assert(!out8.includes('providingoptimal'), 'нет склейки');

/* ---------- Тест 9: перенос строки внутри абзаца Word (score.It) ---------- */
assert.strictEqual(api.splitGluedSentences('CXI is not just a score.It shows where'),
  'CXI is not just a score. It shows where', 'score.It разделено');
assert.strictEqual(api.splitGluedSentences('customer verbatim.Use this page'),
  'customer verbatim. Use this page', 'verbatim.Use разделено');
assert.strictEqual(api.splitGluedSentences('survey health.It shows your'),
  'survey health. It shows your', 'health.It разделено');
assert.strictEqual(api.splitGluedSentences('Tour-Pak\u00AE.Short morning rides'),
  'Tour-Pak\u00AE. Short morning rides', 'после ® тоже разделяется');
assert.strictEqual(api.splitGluedSentences('go to H-D.com for info'),
  'go to H-D.com for info', 'домен H-D.com не тронут');
assert.strictEqual(api.splitGluedSentences('the H.O.G. Ride 365'),
  'the H.O.G. Ride 365', 'аббревиатура H.O.G. не тронута');

/* ---------- Тест 10: оторванный дефис не тянет слово в чужой блок ---------- */
assert.strictEqual(api.normalizeDashes('with a De Dion -style suspension'),
  'with a De Dion - style suspension', '" -style" -> " - style"');
assert.strictEqual(api.normalizeDashes('Capacity -- the ability'),
  'Capacity - the ability', '"--" -> " - "');
assert.strictEqual(api.normalizeDashes('energy-energy to a chemical'),
  'energy-energy to a chemical', 'дефис внутри слова не тронут');
assert.strictEqual(api.normalizeDashes('long-term loyalty'),
  'long-term loyalty', 'составное слово не тронуто');

console.log('ALL ASSERTS OK (v2)');
