/* ============================================================
 * Локализация интерфейса: English / Українська / Русский.
 * Выбор запоминается в localStorage, при первом заходе берётся
 * из языка браузера.
 * ============================================================ */
(function () {
  'use strict';

  var SRT_PH = '1\n00:00:06,300 --> 00:00:09,970\nBatteries are a consumable part that will\neventually need replacement...\n\n2\n...';

  var DICT = {};

  /* ---------------------------- English ---------------------------- */
  DICT.en = {
    title: 'SRT ⇄ Script Compare — check subtitles against the script',
    sub: 'Check SRT subtitles against the approved Word script. Time codes stay untouched, only the text changes.',

    step1: 'Paste your data',
    srtPanel: 'SRT file (as is, with time codes)',
    srtLoad: 'Load .srt',
    srtPh: SRT_PH,
    docPanel: 'Script (text from Word)',
    docLoad: 'Load .docx / .doc',
    docPh: 'Loading a .docx works best — only the Script column of the master table is taken, struck-through text and unresolved tracked changes are dropped, insertions accepted.\n\nIf you paste text from Word by hand: accept or reject the tracked changes in Word first (otherwise deleted text is copied along with the rest) and copy only the Script column.',

    optStrike: 'Drop <s>struck-through</s> text (cut fragments) when importing',
    optDash: 'Convert script dashes «—», «--» to « - »',
    optRemoveEmpty: 'Remove empty subtitle blocks from the result',
    btnCompare: 'Compare',

    step2: 'Edits',
    step2note: '— click a highlight to switch that edit on or off',
    btnAll: 'Apply all',
    btnNone: 'Clear all',
    legendDel: 'removed from the SRT',
    legendIns: 'added from the script',
    legendOff: 'edit switched off',
    legendBlock: 'subtitle block number',
    step3: 'Finished SRT',
    step3note: '— time codes untouched, blocks renumbered',
    btnCopy: 'Copy',
    btnDownload: 'Download .srt',

    words: 'words: {n}',
    statsLine: 'Edits: {edits} • words removed: {del} • words added: {ins} • match: {sim}%',
    applied: 'Edits applied: {on} / {total}',
    blockTitle: 'Subtitle block {n}',
    editTitle: 'Edit #{n} — click to apply or undo',
    copied: 'Copied ✓',

    alertNoSrt: 'No subtitle blocks found in the left field. Paste the whole contents of the .srt file, time codes included.',
    alertNoDoc: 'The right field is empty — paste the script text or load a .docx / .doc file.',

    noMammoth: 'The .docx reader failed to load. It needs internet access the first time the page opens. You can also paste the script text by hand.',
    docxOk: 'The .docx has been read: struck-through text and tracked changes are handled, the Script column is isolated (if the document has one).',
    docxErr: 'Could not read the .docx: {msg}',

    noLegacy: 'The .doc reader failed to load. Reload the page, or save the file as .docx.',
    docHeadYes: 'Legacy .doc (Word 97-2003): the script column has been extracted (rows: {rows}, table columns: {cols}). ',
    docHeadNo: 'Legacy .doc (Word 97-2003): the script column could not be identified, so the whole text was extracted — delete the extra lines by hand. ',
    docCuts: 'Recognised and removed: {list}. ',
    cutStrike: 'struck-through fragments',
    cutDel: 'deletions from tracked changes',
    docBullets: 'Note: bullet markers («•») are not stored in .doc text — if the script has lists, add «•» by hand or save the file as .docx in Word.',
    docErr: 'Could not read the .doc: {msg}. Save the file as .docx in Word and load it again.',

    errNotDoc: 'the file does not look like a Word 97-2003 (.doc) document',
    errNoStream: 'the file has no WordDocument stream',
    errNotWord: 'this is not a Word document',
    errNoText: 'the document text could not be located',

    rulesSummary: 'Rules built into the tool',
    r1: 'Time codes and block boundaries come from the source SRT and never change; blocks in the result are renumbered from 1.',
    r2: 'Smart quotes and apostrophes (’ “ ”), non-breaking spaces and «…» are not treated as differences — the spelling from the SRT is kept.',
    r3: 'Struck-through text in a .docx marks fragments cut from the video, so it is dropped on import.',
    r4: 'Unresolved Word tracked changes are handled automatically when you load a .docx: deletions are dropped, insertions accepted. Copying text out of Word by hand does not do that — deleted text lands in the clipboard as well, so prefer loading the file.',
    r5: 'The legacy <b>.doc</b> format (Word 97-2003) is supported too: it is read directly, the script column is found from the table structure, and struck-through text and tracked changes are recognised as well. The only difference from .docx — bullet markers «•» are not stored in .doc text and have to be added by hand.',
    r6: 'If the document is a master table with a «Script» column (#, Section, Script, Asset…), only that column is imported; other columns and tables are ignored.',
    r7: 'Bulleted lists from a .docx keep their «•» marker.',
    r8: 'Single dashes in the script («--», «—») become « - ». A hyphen stranded in front of a word («… De Dion -style») is split off: the dash stays in its own block, the word in its own.',
    r9: '<b>Text never moves into another time code:</b> replacement words are spread across blocks by similarity to the words they replace, not one after another. «De Dion» takes the place of «D-D-On» in its own block, «style» stays in the next one.',
    r10: '<b>Punctuation collisions</b> left behind by cuts in the doc are repaired: «. ,» and «, .» are impossible — one mark survives (a comma before a lowercase letter, a period before a capital). An ellipsis «...» is left alone.',
    r11: '<b>Cut text does not glue neighbouring words together:</b> «providing~~ precise ~~optimal» gives «providing optimal», not «providingoptimal».',
    r12: '<b>A line break inside a Word paragraph</b> (Shift+Enter) does not glue sentences together: «score.It» → «score. It», «verbatim.Use» → «verbatim. Use». Domains (H-D.com) and abbreviations (H.O.G.) are untouched.',
    r13: 'Word comment references in pasted text (<code>[[ZD1]](#_msocom_1)</code>) and the lines holding their contents are removed automatically.',
    r14: 'Long fragments (8+ words) that are in the SRT but missing from the script (intros, speaker introductions) are <b>not</b> deleted by default — click such an edit to apply it if you do want it gone.',
    r15: 'Any edit can be switched off with a click — for example when the script has a typo while the SRT is right (model numbers, URLs and phone numbers are usually more reliable in the SRT).',
    r16: 'Line breaks inside a block keep their original positions; if edits make a line collapse, the block is re-wrapped into its original number of lines.',

    footer: 'Runs entirely in your browser — no files are sent anywhere.'
  };

  /* --------------------------- Українська --------------------------- */
  DICT.uk = {
    title: 'SRT ⇄ Script Compare — звірка субтитрів зі сценарієм',
    sub: 'Звірка SRT-субтитрів із затвердженим сценарієм (Word). Тайм-коди залишаються недоторканими, змінюється лише текст.',

    step1: 'Вставте дані',
    srtPanel: 'SRT-файл (як є, з тайм-кодами)',
    srtLoad: 'Завантажити .srt',
    srtPh: SRT_PH,
    docPanel: 'Сценарій (текст із Word)',
    docLoad: 'Завантажити .docx / .doc',
    docPh: 'Найкраще завантажити .docx — із мастер-таблиці автоматично візьметься лише колонка Script, перекреслене та неприйняті правки рецензування будуть відкинуті, вставки — прийняті.\n\nЯкщо вставляєте текст вручну з Word: спершу прийміть або відхиліть правки рецензування в самому Word (інакше видалений текст скопіюється разом зі звичайним) і копіюйте лише колонку Script.',

    optStrike: 'Прибирати <s>перекреслений</s> текст (вирізані фрагменти) під час імпорту',
    optDash: 'Тире сценарію «—», «--» приводити до « - »',
    optRemoveEmpty: 'Вилучати порожні блоки субтитрів із результату',
    btnCompare: 'Порівняти',

    step2: 'Правки',
    step2note: '— клік на підсвітці вмикає або вимикає правку',
    btnAll: 'Застосувати всі',
    btnNone: 'Зняти всі',
    legendDel: 'вилучається з SRT',
    legendIns: 'додається зі сценарію',
    legendOff: 'правку вимкнено',
    legendBlock: 'номер блоку субтитрів',
    step3: 'Готовий SRT',
    step3note: '— тайм-коди недоторкані, нумерацію оновлено',
    btnCopy: 'Копіювати',
    btnDownload: 'Завантажити .srt',

    words: 'слів: {n}',
    statsLine: 'Правок: {edits} • вилучається слів: {del} • додається слів: {ins} • збіг: {sim}%',
    applied: 'Застосовано правок: {on} / {total}',
    blockTitle: 'Блок субтитрів №{n}',
    editTitle: 'Правка №{n} — клік: застосувати або скасувати',
    copied: 'Скопійовано ✓',

    alertNoSrt: 'У лівому полі не знайдено блоків субтитрів. Вставте вміст .srt файлу повністю, разом із тайм-кодами.',
    alertNoDoc: 'Праве поле порожнє — вставте текст сценарію або завантажте файл .docx / .doc.',

    noMammoth: 'Модуль читання .docx не завантажився. Для нього потрібен інтернет під час першого відкриття сторінки. Також можна вставити текст сценарію вручну.',
    docxOk: 'Файл .docx прочитано: перекреслений текст і правки рецензування опрацьовано, колонку Script виділено (якщо вона є в документі).',
    docxErr: 'Не вдалося прочитати .docx: {msg}',

    noLegacy: 'Модуль читання .doc не завантажився. Онови сторінку або збережи файл як .docx.',
    docHeadYes: 'Формат .doc (Word 97-2003): колонку зі сценарієм видобуто (рядків: {rows}, колонок таблиці: {cols}). ',
    docHeadNo: 'Формат .doc (Word 97-2003): колонку зі сценарієм визначити не вдалося, тому видобуто весь текст — вилучіть зайві рядки вручну. ',
    docCuts: 'Розпізнано та прибрано: {list}. ',
    cutStrike: 'перекреслені фрагменти',
    cutDel: 'видалення з режиму рецензування',
    docBullets: 'Зверніть увагу: маркери списків («•») у форматі .doc не зберігаються в тексті — якщо в сценарії є списки, додайте «•» вручну або збережіть файл у Word як .docx.',
    docErr: 'Не вдалося прочитати .doc: {msg}. Збережіть файл у Word як .docx і завантажте знову.',

    errNotDoc: 'файл не схожий на документ Word 97-2003 (.doc)',
    errNoStream: 'у файлі немає потоку WordDocument',
    errNotWord: 'це не документ Word',
    errNoText: 'не вдалося знайти текст документа',

    rulesSummary: 'Правила звірки, закладені в інструмент',
    r1: 'Тайм-коди та поділ на блоки беруться з початкового SRT і не змінюються; нумерація блоків у результаті починається заново з 1.',
    r2: '«Розумні» лапки й апострофи (’ “ ”), нерозривні пробіли та «…» не вважаються відмінностями — у результаті залишається варіант із SRT.',
    r3: 'Перекреслений текст у .docx — це вирізані з відео фрагменти, тому під час імпорту він відкидається.',
    r4: 'Неприйняті правки рецензування Word під час завантаження .docx опрацьовуються автоматично: видалене відкидається, вставлене приймається. Під час копіювання тексту з Word вручну так не вийде — видалений текст потрапить у буфер обміну, тому краще завантажувати файл.',
    r5: 'Підтримується й старий формат <b>.doc</b> (Word 97-2003): він читається напряму, колонка зі сценарієм визначається за структурою таблиці, перекреслений текст і правки рецензування також розпізнаються. Єдина відмінність від .docx — маркери списків «•» у .doc не зберігаються в тексті, тож їх доведеться додати вручну.',
    r6: 'Якщо документ — мастер-таблиця зі стовпцем «Script» (#, Section, Script, Asset…), під час імпорту береться лише цей стовпець; інші колонки та таблиці ігноруються.',
    r7: 'Марковані списки з .docx переносяться з маркером «•».',
    r8: 'Одиничні тире сценарію («--», «—») перетворюються на « - ». Відірваний дефіс («… De Dion -style») відокремлюється від слова: тире залишається у своєму блоці, слово — у своєму.',
    r9: '<b>Текст не переїжджає в чужий тайм-код:</b> слова заміни розподіляються по блоках за схожістю з тими, які замінюють, а не поспіль. «De Dion» стає на місце «D-D-On» у своєму блоці, «style» залишається в наступному.',
    r10: '<b>Пунктуаційні колізії</b> після вирізок у документі виправляються: «. ,» та «, .» неможливі — залишається один знак (перед малою літерою кома, перед великою точка). Три точки «...» не змінюються.',
    r11: '<b>Вирізаний текст не склеює сусідні слова:</b> «providing~~ precise ~~optimal» дає «providing optimal», а не «providingoptimal».',
    r12: '<b>Перенесення рядка всередині абзацу Word</b> (Shift+Enter) не склеює речення: «score.It» → «score. It», «verbatim.Use» → «verbatim. Use». Домени (H-D.com) й абревіатури (H.O.G.) не змінюються.',
    r13: 'Посилання на коментарі Word у вставленому тексті (<code>[[ZD1]](#_msocom_1)</code>) та рядки з їхнім вмістом вилучаються автоматично.',
    r14: 'Довгі фрагменти (8+ слів), які є в SRT, але відсутні у сценарії (вступи, представлення спікерів), за замовчуванням <b>не</b> вилучаються — увімкніть таку правку кліком, якщо вилучити все ж потрібно.',
    r15: 'Кожну правку можна вимкнути кліком — наприклад, якщо у сценарії є друкарська помилка, а в SRT написано правильно (номери моделей, URL, телефони найчастіше точніші в SRT).',
    r16: 'Перенесення рядків усередині блоку зберігаються на початкових позиціях; якщо через правки рядок «злипся», блок автоматично перебивається на початкову кількість рядків.',

    footer: 'Працює повністю у браузері — файли нікуди не надсилаються.'
  };

  /* ---------------------------- Русский ---------------------------- */
  DICT.ru = {
    title: 'SRT ⇄ Script Compare — сверка субтитров со сценарием',
    sub: 'Сверка SRT-субтитров с утверждённым сценарием (Word). Тайм-коды остаются нетронутыми, меняется только текст.',

    step1: 'Вставьте данные',
    srtPanel: 'SRT-файл (как есть, с тайм-кодами)',
    srtLoad: 'Загрузить .srt',
    srtPh: SRT_PH,
    docPanel: 'Сценарий (текст из Word)',
    docLoad: 'Загрузить .docx / .doc',
    docPh: 'Лучше загрузите .docx — из мастер-таблицы автоматически возьмётся только колонка Script, зачёркнутое и непринятые правки рецензирования будут отброшены, вставки — приняты.\n\nЕсли вставляете текст вручную из Word: сначала примите или отклоните правки рецензирования в самом Word (иначе удалённый текст скопируется вместе с обычным) и копируйте только колонку Script.',

    optStrike: 'Убирать <s>зачёркнутый</s> текст (вырезанные фрагменты) при импорте',
    optDash: 'Тире сценария «—», «--» приводить к « - »',
    optRemoveEmpty: 'Удалять пустые блоки субтитров из результата',
    btnCompare: 'Сравнить',

    step2: 'Правки',
    step2note: '— клик по подсветке включает или выключает правку',
    btnAll: 'Применить все',
    btnNone: 'Снять все',
    legendDel: 'убирается из SRT',
    legendIns: 'добавляется из сценария',
    legendOff: 'правка выключена',
    legendBlock: 'номер блока субтитров',
    step3: 'Готовый SRT',
    step3note: '— тайм-коды не тронуты, нумерация обновлена',
    btnCopy: 'Копировать',
    btnDownload: 'Скачать .srt',

    words: 'слов: {n}',
    statsLine: 'Правок: {edits} • удаляется слов: {del} • добавляется слов: {ins} • совпадение: {sim}%',
    applied: 'Применено правок: {on} / {total}',
    blockTitle: 'Блок субтитров №{n}',
    editTitle: 'Правка №{n} — клик: применить или отменить',
    copied: 'Скопировано ✓',

    alertNoSrt: 'В левом поле не найдено блоков субтитров. Вставьте содержимое .srt файла целиком, вместе с тайм-кодами.',
    alertNoDoc: 'Правое поле пустое — вставьте текст сценария или загрузите файл .docx / .doc.',

    noMammoth: 'Модуль чтения .docx не загрузился. Ему нужен интернет при первом открытии страницы. Либо вставьте текст сценария вручную.',
    docxOk: 'Файл .docx прочитан: зачёркнутый текст и правки рецензирования обработаны, колонка Script выделена (если она есть в документе).',
    docxErr: 'Не удалось прочитать .docx: {msg}',

    noLegacy: 'Модуль чтения .doc не загрузился. Обновите страницу или сохраните файл как .docx.',
    docHeadYes: 'Формат .doc (Word 97-2003): колонка со сценарием извлечена (строк: {rows}, колонок таблицы: {cols}). ',
    docHeadNo: 'Формат .doc (Word 97-2003): колонку со сценарием определить не удалось, поэтому извлечён весь текст — удалите лишние строки вручную. ',
    docCuts: 'Распознано и убрано: {list}. ',
    cutStrike: 'зачёркнутые фрагменты',
    cutDel: 'удаления из режима рецензирования',
    docBullets: 'Учтите: маркеры списков («•») в формате .doc не хранятся в тексте — если в сценарии есть списки, добавьте «•» вручную или сохраните файл в Word как .docx.',
    docErr: 'Не удалось прочитать .doc: {msg}. Сохраните файл в Word как .docx и загрузите снова.',

    errNotDoc: 'файл не похож на документ Word 97-2003 (.doc)',
    errNoStream: 'в файле нет потока WordDocument',
    errNotWord: 'это не документ Word',
    errNoText: 'не удалось найти текст документа',

    rulesSummary: 'Правила сверки, заложенные в инструмент',
    r1: 'Тайм-коды и разбиение на блоки берутся из исходного SRT и не меняются; нумерация блоков в результате идёт заново с 1.',
    r2: '«Умные» кавычки и апострофы (’ “ ”), неразрывные пробелы и «…» не считаются различиями — в результате остаётся вариант из SRT.',
    r3: 'Зачёркнутый текст в .docx — это вырезанные из видео фрагменты, при импорте он отбрасывается.',
    r4: 'Непринятые правки рецензирования Word при загрузке .docx обрабатываются автоматически: удалённое отбрасывается, вставленное принимается. При ручном копировании текста из Word так не получится — удалённый текст попадёт в буфер обмена, поэтому предпочитайте загрузку файла.',
    r5: 'Поддерживается и старый формат <b>.doc</b> (Word 97-2003): он читается напрямую, колонка со сценарием определяется по структуре таблицы, зачёркнутый текст и правки рецензирования тоже распознаются. Единственное отличие от .docx — маркеры списков «•» в .doc не хранятся в тексте и их придётся добавить вручную.',
    r6: 'Если документ — мастер-таблица со столбцом «Script» (#, Section, Script, Asset…), при импорте берётся только этот столбец; остальные колонки и таблицы игнорируются.',
    r7: 'Маркированные списки из .docx переносятся с маркером «•».',
    r8: 'Одиночные тире сценария («--», «—») превращаются в « - ». Оторванный дефис («… De Dion -style») отделяется от слова: тире остаётся в своём блоке, слово — в своём.',
    r9: '<b>Текст не переезжает в чужой тайм-код:</b> заменяющие слова распределяются по блокам по схожести с заменяемыми, а не подряд. «De Dion» встаёт вместо «D-D-On» в своём блоке, «style» остаётся в следующем.',
    r10: '<b>Пунктуационные коллизии</b> после вырезок в документе исправляются: «. ,» и «, .» невозможны — остаётся один знак (перед строчной буквой запятая, перед заглавной точка). Троеточие «...» не трогается.',
    r11: '<b>Вырезанный текст не склеивает соседние слова:</b> «providing~~ precise ~~optimal» даёт «providing optimal», а не «providingoptimal».',
    r12: '<b>Перенос строки внутри абзаца Word</b> (Shift+Enter) не склеивает предложения: «score.It» → «score. It», «verbatim.Use» → «verbatim. Use». Домены (H-D.com) и аббревиатуры (H.O.G.) не затрагиваются.',
    r13: 'Ссылки на комментарии Word во вставленном тексте (<code>[[ZD1]](#_msocom_1)</code>) и строки с их содержимым удаляются автоматически.',
    r14: 'Длинные фрагменты (8+ слов), которые есть в SRT, но отсутствуют в сценарии (вступления, представления спикеров), по умолчанию <b>не</b> удаляются — включите такую правку кликом, если удалить всё же нужно.',
    r15: 'Каждую правку можно выключить кликом — например, если в сценарии опечатка, а в SRT написано верно (номера моделей, URL, телефоны чаще правильнее в SRT).',
    r16: 'Переносы строк внутри блока сохраняются на исходных позициях; если из-за правок строка «слиплась», блок автоматически перебивается на исходное число строк.',

    footer: 'Работает полностью в браузере — файлы никуда не отправляются.'
  };

  /* ---------------------------- Механика ---------------------------- */

  var LANGS = ['en', 'uk', 'ru'];
  var cur = 'en';

  function detect() {
    try {
      var saved = localStorage.getItem('srtcmp.lang');
      if (saved && DICT[saved]) return saved;
    } catch (e) { /* localStorage может быть недоступен */ }
    var n = String(navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (n.indexOf('ru') === 0) return 'ru';
    if (n.indexOf('uk') === 0) return 'uk';
    return 'en';
  }

  function t(key, params) {
    var s = (DICT[cur] && DICT[cur][key]) || DICT.en[key] || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(params[k]));
      });
    }
    return s;
  }

  function apply() {
    document.documentElement.lang = cur;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      var on = b.getAttribute('data-lang') === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLang(l) {
    if (!DICT[l] || l === cur) return;
    cur = l;
    try { localStorage.setItem('srtcmp.lang', l); } catch (e) { /* игнорируем */ }
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
  }

  cur = detect();

  window.I18N = {
    t: t, apply: apply, setLang: setLang, langs: LANGS,
    get lang() { return cur; }
  };

  function init() {
    apply();
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
