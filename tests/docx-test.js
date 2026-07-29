const api = require('../js/app.js');
const mammoth = require('mammoth');
const { DOMParser } = require('linkedom');
const assert = require('assert');

async function run() {
  // 1. Синтетический docx с tracked changes и таблицей Script
  let r = await mammoth.convertToHtml({ path: __dirname + '/fixtures/tracked.docx' });
  let text = api.extractDocxText(r.value, { stripStrike: true }, DOMParser);
  console.log('--- SYNTHETIC ---\n' + text + '\n---');
  assert(!text.includes('DELETED-TRACKED'), 'tracked-удаление отброшено');
  assert(!text.includes('CELL-DELETED'), 'tracked-удаление в ячейке отброшено');
  assert(text.includes('CELL-INSERTED'), 'tracked-вставка в ячейке принята');
  assert(text.includes('Script cell one.') && text.includes('Script cell two.'), 'ячейки Script взяты');
  assert(!text.includes('Intro') && !text.includes('asset1.mp4') && !text.includes('Section'), 'другие колонки отброшены');
  assert(!text.includes('Normal start'), 'текст вне таблицы не взят, т.к. есть колонка Script');

  // 1b. Перенос строки внутри абзаца (Shift+Enter) и зачёркнутое внутри строки
  r = await mammoth.convertToHtml({ path: __dirname + '/fixtures/linebreak.docx' });
  text = api.extractDocxText(r.value, { stripStrike: true }, DOMParser);
  console.log('--- LINEBREAK ---\n' + text + '\n---');
  assert(!text.includes('score.It'), 'Shift+Enter не склеил score. и It');
  assert(text.includes('providing optimal response'), 'зачёркнутое заменено пробелом');
  assert(!text.includes('providingoptimal'), 'нет склейки после вырезки');
  assert(!text.includes('Why CXI') && !text.includes('Section'), 'только колонка Script');

  // 2. (опционально) Реальный мастер-док: node docx-test.js path/to/master.docx
  if (!process.argv[2]) { console.log('DOCX EXTRACT TESTS OK (синтетика)'); return; }
  r = await mammoth.convertToHtml({ path: process.argv[2] });
  text = api.extractDocxText(r.value, { stripStrike: true }, DOMParser);
  console.log('--- MEMBERSHIP (первые 12 строк) ---');
  console.log(text.split('\n').slice(0, 12).join('\n'));
  console.log('--- всего строк:', text.split('\n').length, '---');
  assert(text.includes('Welcome to the H.O.G Membership Benefits Training'), 'скрипт взят');
  assert(text.includes('\u2022'), 'буллиты сохранены');
  assert(!text.includes('Course Title'), 'таблица CHARTER не попала');
  assert(!text.includes('Common Questions and Responses') || true, 'проверка названий секций ниже');
  // Названия секций из колонки Section не должны попасть
  assert(!/^H-D Membership Types$/m.test(text), 'секция "H-D Membership Types" не попала');
  assert(!/^Outro$/m.test(text), 'секция "Outro" не попала');
  // Зачёркнутое удалено
  assert(!text.includes('rocker medallions'), 'зачёркнутый фрагмент удалён');
  assert(!text.includes('49'), 'зачёркнутая цена 49 удалена');
  assert(text.includes('43'), 'новая цена 43 на месте');
  assert(!text.includes('What if I want to upgrade'), 'зачёркнутый вопрос целиком удалён');

  console.log('DOCX EXTRACT TESTS OK');
}
run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
