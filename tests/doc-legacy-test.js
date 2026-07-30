/* Тест чтения старого формата .doc (Word 97-2003).
   Запуск: node doc-legacy-test.js [путь_к_файлу.doc]
   Нужны: npm i linkedom  (для эмуляции DOM в Node) */
const fs = require('fs');
const assert = require('assert');
const legacy = require('../js/doc.js');
const api = require('../js/app.js');
const { DOMParser } = require('linkedom');

/* --- 1. Синтетический тест разбора структуры таблицы --- */
// 3 колонки: время | сценарий | ассет; после каждой строки — метка конца строки
const cells = [
  'Time', 'Script', 'Asset', '',
  '00:05', 'First sentence.', 'clip A', '',
  '00:10', 'Second sentence.', '', '',
  '00:15', 'Third sentence.', 'clip C', '',
  '00:20', 'Fourth sentence.', '', ''
];
const found = legacy.findScriptColumn(cells);
assert(found, 'структура таблицы распознана');
assert.strictEqual(found.N, 3, '3 колонки');
assert.strictEqual(found.col, 1, 'сценарий во второй колонке');
assert.strictEqual(found.start, 0, 'таблица начинается с нулевой ячейки');
assert(found.rows >= 4, 'найдено не менее 4 строк данных');

const res = legacy.toHtml(cells.join('\x07'));
assert(res.detected, 'колонка найдена');
const txt = api.extractDocxText(res.html, { stripStrike: true }, DOMParser);
assert(txt.includes('First sentence.') && txt.includes('Fourth sentence.'), 'все реплики извлечены');
assert(!txt.includes('00:05') && !txt.includes('clip A'), 'колонки времени и ассетов отброшены');
console.log('SYNTHETIC TABLE OK');

/* --- 1b. Зачёркнутый текст и правки рецензирования в .doc --- */
const tb = fs.readFileSync(__dirname + '/fixtures/tracked.doc');
const tab = tb.buffer.slice(tb.byteOffset, tb.byteOffset + tb.byteLength);
const ex = legacy.extractTextEx(tab, { stripStrike: true });
assert(ex.hadStrike, 'зачёркивание в .doc распознано');
assert(ex.hadDel, 'tracked-удаление в .doc распознано');
assert(!ex.text.includes('DELETED-TRACKED'), 'tracked-удаление убрано');
assert(!ex.text.includes('STRIKE-FORMATTED'), 'зачёркнутый текст убран');
assert(ex.text.includes('INSERTED-TRACKED'), 'tracked-вставка сохранена (правка принята)');
assert(ex.text.includes('Normal start.') && ex.text.includes('Normal end.'), 'обычный текст цел');
// структура таблицы не развалилась после вырезок
const cellsT = ex.text.split('\x07');
assert(cellsT.some(c => c.trim() === 'Script'), 'заголовок Script на месте после вырезок');
const htmlT = legacy.toHtml(ex.text);
// в этой мини-фикстуре всего 2 строки данных — структура таблицы не
// подтверждается (нужно >= 3), поэтому берётся весь текст; вырезки уже убраны
assert(!htmlT.detected, 'на таблице из 2 строк подбор структуры не срабатывает');
const txtT = api.extractDocxText(htmlT.html, { stripStrike: true }, DOMParser);
assert(!txtT.includes('CELL-DELETED'), 'tracked-удаление внутри ячейки убрано');
assert(txtT.includes('CELL-INSERTED'), 'tracked-вставка внутри ячейки сохранена');
// без опции — зачёркнутое остаётся, tracked-удаление всё равно убирается
const ex2 = legacy.extractTextEx(tab, { stripStrike: false });
assert(ex2.text.includes('STRIKE-FORMATTED'), 'при выключенной опции зачёркнутое остаётся');
assert(!ex2.text.includes('DELETED-TRACKED'), 'tracked-удаление убирается всегда');
console.log('STRIKE / TRACKED CHANGES OK');

/* --- 2. Реальный файл (если передан путь) --- */
const path = process.argv[2];
if (!path) { console.log('LEGACY DOC TESTS OK (синтетика)'); process.exit(0); }

const buf = fs.readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const text = legacy.extractText(ab);
assert(text.length > 100, 'текст извлечён');
assert(!/\uFFFD{3}/.test(text), 'нет кракозябр (последовательностей \\uFFFD)');
const r2 = legacy.toHtml(text);
const script = api.extractDocxText(r2.html, { stripStrike: true }, DOMParser);
console.log('колонка найдена:', r2.detected, '| строк:', r2.rows, '| слов:', script.split(/\s+/).filter(Boolean).length);
assert(script.length > 200, 'сценарий не пустой');
assert(!/CHARTER|Course Title|Learning Type/i.test(script), 'служебная таблица CHARTER не попала в сценарий');
assert(!/^\d{2}:\d{2}$/m.test(script), 'колонка таймкодов не попала в сценарий');
console.log('LEGACY DOC TESTS OK (реальный файл)');
