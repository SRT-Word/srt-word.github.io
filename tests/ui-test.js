/* Проверка локализации в реальном DOM (jsdom): переключение языков,
   отсутствие непереведённых ключей, работа сравнения на всех языках */
const fs = require('fs');
const assert = require('assert');
const { JSDOM } = require('jsdom');
const B = __dirname + '/../';

const html = fs.readFileSync(B + 'index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.eval(fs.readFileSync(B + 'js/i18n.js', 'utf8'));
w.eval(fs.readFileSync(B + 'js/doc.js', 'utf8'));
w.eval(fs.readFileSync(B + 'js/app.js', 'utf8'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

const d = w.document;
const txt = () => d.body.textContent;

// 1. Кнопки переключателя в нужном порядке
const langs = [...d.querySelectorAll('[data-lang]')].map(b => b.getAttribute('data-lang'));
assert.deepStrictEqual(langs, ['en', 'uk', 'ru'], 'порядок: английский, украинский, русский');
assert.deepStrictEqual([...d.querySelectorAll('[data-lang]')].map(b => b.textContent),
  ['EN', 'УКР', 'РУС'], 'подписи кнопок');

// 2. По умолчанию (язык браузера в jsdom = en) активен английский
assert.strictEqual(w.I18N.lang, 'en', 'по умолчанию английский');
assert.strictEqual(d.querySelector('[data-lang="en"]').classList.contains('on'), true, 'кнопка EN активна');
assert.strictEqual(d.documentElement.lang, 'en', 'lang в html');
assert(d.title.includes('subtitles'), 'заголовок страницы переведён: ' + d.title);
assert(txt().includes('Paste your data'), 'английский шаг 1');
assert(txt().includes('words: 0'), 'счётчик слов по-английски');

// 3. Переключение на все три языка: нет пустых элементов и «сырых» ключей
const marks = { en: 'Paste your data', uk: 'Вставте дані', ru: 'Вставьте данные' };
['uk', 'ru', 'en'].forEach(function (l) {
  d.querySelector('[data-lang="' + l + '"]').click();
  assert.strictEqual(w.I18N.lang, l, 'язык переключился на ' + l);
  assert.strictEqual(d.documentElement.lang, l, 'html lang = ' + l);
  assert(txt().includes(marks[l]), 'текст на языке ' + l);
  assert.strictEqual(d.querySelector('[data-lang="' + l + '"]').classList.contains('on'), true, 'кнопка ' + l + ' активна');
  // все ключи заполнены
  d.querySelectorAll('[data-i18n],[data-i18n-html]').forEach(function (el) {
    const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-html');
    const v = el.textContent.trim();
    assert(v.length > 0, 'пустой перевод ключа ' + key + ' в языке ' + l);
    assert(v !== key, 'ключ ' + key + ' не переведён в языке ' + l);
  });
  d.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    assert(el.placeholder && el.placeholder.length > 5, 'placeholder пуст в языке ' + l);
  });
});

// 4. Сравнение работает и статистика переводится
d.querySelector('[data-lang="ru"]').click();
d.getElementById('srtInput').value = '1\n00:00:01,000 --> 00:00:02,000\nHello world this is\na test of subtitles\n';
d.getElementById('docInput').value = 'Hello world, this is a test of subtitles.';
d.getElementById('btnCompare').click();
assert.strictEqual(d.getElementById('results').hidden, false, 'результаты показаны');
const out = d.getElementById('output').value;
assert(out.includes('00:00:01,000 --> 00:00:02,000'), 'тайм-код на месте');
assert(out.includes('Hello world, this is'), 'правка применена');
assert(d.getElementById('stats').textContent.startsWith('Правок:'), 'статистика по-русски: ' + d.getElementById('stats').textContent);
assert(d.getElementById('appliedCounter').textContent.includes('Применено'), 'счётчик по-русски');
const tooltipRu = d.querySelector('#diffView .tok').getAttribute('title');
assert(tooltipRu.includes('Правка'), 'подсказка по-русски: ' + tooltipRu);

// 5. Смена языка после сравнения перерисовывает статистику и подсказки
d.querySelector('[data-lang="en"]').click();
assert(d.getElementById('stats').textContent.startsWith('Edits:'), 'статистика перерисована: ' + d.getElementById('stats').textContent);
assert(d.getElementById('appliedCounter').textContent.includes('applied'), 'счётчик перерисован');
assert(d.querySelector('#diffView .tok').getAttribute('title').includes('Edit #'), 'подсказки перерисованы');
assert.strictEqual(d.getElementById('output').value, out, 'результат SRT не изменился при смене языка');

// 6. Выбор языка сохраняется
assert.strictEqual(w.localStorage.getItem('srtcmp.lang'), 'en', 'язык сохранён в localStorage');

console.log('UI / I18N TESTS OK');
