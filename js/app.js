/* ============================================================
 * SRT ⇄ Script Compare
 * Сверка SRT-субтитров с утверждённым сценарием (Word) и сборка
 * исправленного SRT с нетронутыми тайм-кодами.
 * Все вычисления выполняются локально в браузере.
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- Нормализация символов ---------------- */

  // «Умные» кавычки/апострофы/пробелы приводим к простым —
  // такие различия не считаются правками.
  var CHAR_MAP = [
    [/[\u2019\u2018\u02BC\u00B4\u0060]/g, "'"],
    [/[\u201C\u201D\u00AB\u00BB]/g, '"'],
    [/[\u00A0\u2007\u202F]/g, ' '],
    [/\u2026/g, '...'],
    [/[\u200B\u200C\u200D\uFEFF]/g, '']
  ];

  function normChars(s) {
    for (var i = 0; i < CHAR_MAP.length; i++) {
      s = s.replace(CHAR_MAP[i][0], CHAR_MAP[i][1]);
    }
    return s;
  }

  // Ключ сравнения токена (кавычки/апострофы уравниваются, регистр — НЕТ)
  function normToken(s) {
    return normChars(s);
  }

  // Как токен из сценария попадает в итоговый SRT
  function normOutToken(s) {
    s = normChars(s);
    if (/^(--|\u2014|\u2013)$/.test(s)) return '-'; // одиночное тире дока -> "-"
    return s;
  }

  // Тире сценария: "слово -- слово", "слово—слово" -> "слово - слово"
  function normalizeDashes(s) {
    return s
      .replace(/\s*--\s*/g, ' - ')
      .replace(/\s*[\u2014\u2013]\s*/g, ' - ')
      // « -style» в доке = отдельное тире + слово: тире остаётся в своём
      // блоке, слово — в своём, текст не переезжает в чужой тайм-код
      .replace(/(\s)-(?=[A-Za-z\u0410-\u044f\u0401\u0451])/g, '$1- ');
  }

  // Вычищаем ссылки-комментарии Word из скопированного текста:
  // инлайновые [[ZD1]](#_msocom_1) и целые строки-тела комментариев (#_msoanchor_)
  function stripWordComments(s) {
    var lines = String(s || '').split(/\r?\n/).filter(function (ln) {
      return ln.indexOf('#_msoanchor_') === -1;
    });
    s = lines.join('\n');
    s = s.replace(/\[\[[^\[\]]{1,16}\]\]\(#_msocom_\d+\)/g, ' ');
    s = s.replace(/\(#_msocom_\d+\)/g, ' ');
    // вырезанный (зачёркнутый) текст в markdown-виде: providing~~ precise ~~optimal
    s = s.replace(/~~[\s\S]*?~~/g, ' ');
    s = s.replace(/[ \t]{2,}/g, ' ');
    return s;
  }

  // «...verbatim.Use this page» — в Word тут был перенос строки внутри абзаца
  // (Shift+Enter); при извлечении текста пробел терялся и слова склеивались.
  function splitGluedSentences(s) {
    return s.replace(
      /([a-z\u0430-\u044f\u0451\u00AE\u2122)\]])([.!?])([A-Z\u0410-\u042f\u0401][a-z\u0430-\u044f\u0451])/g,
      '$1$2 $3');
  }

  // Человеческие ошибки в доке после вырезок: «точка, за ней запятая» и
  // наоборот — невалидные сочетания. Троеточие «...» не трогаем.
  function fixPunctuationCollisions(s) {
    // приклеиваем «оторванные» знаки к предыдущему слову
    s = s.replace(/\s+,(?=\s|$)/g, ',');
    s = s.replace(/\s+\.(?!\.)(?=\s|$)/g, '.');
    // дубли
    s = s.replace(/,\s*,+/g, ',');
    s = s.replace(/\.\s+\.(?!\.)/g, '.');
    // «? ,» «! .» — остаётся ? / !
    s = s.replace(/([?!])\s*[,.](?!\.)/g, '$1');
    // «. ,» перед строчной — побеждает запятая; перед заглавной — точка
    s = s.replace(/\.\s*,\s*(?=[a-zа-яё])/g, ', ');
    s = s.replace(/\.\s*,\s*(?=["'«(]?[A-ZА-ЯЁ0-9])/g, '. ');
    // «, .» перед заглавной — точка; перед строчной — запятая
    s = s.replace(/,\s*\.(?!\.)\s*(?=["'«(]?[A-ZА-ЯЁ0-9])/g, '. ');
    s = s.replace(/,\s*\.(?!\.)\s*(?=[a-zа-яё])/g, ', ');
    return s;
  }

  /* ---------------- Разбор SRT ---------------- */

  var TIME_RE = /^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}.*$/;

  function parseSRT(text) {
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
    var blocks = [];
    var i = 0;
    while (i < lines.length) {
      while (i < lines.length && !lines[i].trim()) i++;
      if (i >= lines.length) break;

      if (/^\s*\d+\s*$/.test(lines[i]) && i + 1 < lines.length && TIME_RE.test(lines[i + 1])) {
        i++; // строка с номером — пропускаем, нумеруем заново на выходе
      }
      if (i < lines.length && TIME_RE.test(lines[i])) {
        var time = lines[i].trim();
        i++;
        var textLines = [];
        while (i < lines.length && lines[i].trim()) {
          textLines.push(lines[i].trim());
          i++;
        }
        blocks.push({ time: time, textLines: textLines });
      } else {
        i++; // мусорная строка вне блока
      }
    }

    // Плоский список слов + запоминаем, после какого слова был перенос строки
    var words = [];
    blocks.forEach(function (b, bi) {
      b.lineCount = Math.max(1, b.textLines.length);
      b.breakAfter = {}; // set: индекс слова -> true
      b.textLines.forEach(function (ln, li) {
        var ws = ln.split(/\s+/).filter(Boolean);
        ws.forEach(function (w, wi) {
          var idx = words.length;
          words.push({ text: w, blockIdx: bi });
          if (wi === ws.length - 1 && li < b.textLines.length - 1) {
            b.breakAfter[idx] = true;
          }
        });
      });
    });

    return { blocks: blocks, words: words };
  }

  /* ---------------- Дифф (алгоритм Майерса, по словам) ---------------- */

  function diffTokens(a, b, eq) {
    var N = a.length, M = b.length;
    if (!N && !M) return [];
    var MAX = N + M;
    var off = MAX + 1;
    var size = 2 * MAX + 3;
    var vs = [];
    var V = new Int32Array(size);
    var D = -1, d, k, x, y;

    outer:
    for (d = 0; d <= MAX; d++) {
      vs.push(V.slice(0));
      for (k = -d; k <= d; k += 2) {
        if (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) {
          x = V[off + k + 1];
        } else {
          x = V[off + k - 1] + 1;
        }
        y = x - k;
        while (x < N && y < M && eq(a[x], b[y])) { x++; y++; }
        V[off + k] = x;
        if (x >= N && y >= M) { D = d; break outer; }
      }
    }

    var ops = [];
    x = N; y = M;
    for (d = D; d > 0; d--) {
      var Vp = vs[d];
      k = x - y;
      var pk;
      if (k === -d || (k !== d && Vp[off + k - 1] < Vp[off + k + 1])) pk = k + 1;
      else pk = k - 1;
      var px = Vp[off + pk], py = px - pk;
      while (x > px && y > py) { ops.push({ t: 'eq', ai: x - 1, bi: y - 1 }); x--; y--; }
      if (x === px) { ops.push({ t: 'ins', bi: y - 1 }); y--; }
      else { ops.push({ t: 'del', ai: x - 1 }); x--; }
    }
    while (x > 0 && y > 0) { ops.push({ t: 'eq', ai: x - 1, bi: y - 1 }); x--; y--; }
    while (x > 0) ops.push({ t: 'del', ai: --x });
    while (y > 0) ops.push({ t: 'ins', bi: --y });
    return ops.reverse();
  }

  /* ---------------- Группировка правок ---------------- */

  // Подряд идущие del/ins образуют одну «правку», которую можно
  // включить/выключить кликом.
  var LONG_DELETE_OFF = 8; // чистое удаление >= N слов по умолчанию выключено

  function groupOps(ops) {
    var groups = [];
    var cur = null;
    ops.forEach(function (op) {
      if (op.t === 'eq') { cur = null; return; }
      if (!cur) {
        cur = { id: groups.length, applied: true, dels: 0, inss: 0 };
        groups.push(cur);
      }
      op.g = cur.id;
      if (op.t === 'del') cur.dels++; else cur.inss++;
    });
    // Длинные «чистые удаления» — скорее всего, в сценарии просто нет этой
    // части (вступление, имена спикеров) — по умолчанию НЕ применяем.
    groups.forEach(function (g) {
      if (g.inss === 0 && g.dels >= LONG_DELETE_OFF) g.applied = false;
    });
    return groups;
  }

  /* ---------------- Выравнивание замен по схожести ---------------- */

  function levDist(a, b) {
    var n = a.length, m = b.length;
    if (!n) return m;
    if (!m) return n;
    var prev = [], cur = [], i, j, t;
    for (j = 0; j <= m; j++) prev[j] = j;
    for (i = 1; i <= n; i++) {
      cur[0] = i;
      for (j = 1; j <= m; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      t = prev; prev = cur; cur = t;
    }
    return prev[m];
  }

  function tokenSim(a, b) {
    a = normToken(a).toLowerCase();
    b = normToken(b).toLowerCase();
    if (a === b) return 1;
    var sa = a.replace(/[^0-9a-z\u0430-\u044f\u0451]/g, '');
    var sb = b.replace(/[^0-9a-z\u0430-\u044f\u0451]/g, '');
    if (sa && sa === sb) return 0.95;
    var x = sa || a, y = sb || b;
    var M = Math.max(x.length, y.length) || 1;
    return Math.max(0, 1 - levDist(x, y) / M);
  }

  // Монотонное выравнивание (Нидлман-Вунш) вставляемых слов на удаляемые.
  // Возвращает map[j] = индекс удаляемого слова для j-го вставляемого.
  // Так «De Dion» встаёт на место «D-D-On» в СВОЁМ блоке, а «-style» — на
  // место «style» в следующем, и текст не переезжает в чужой тайм-код.
  function alignInsToDel(delToks, insToks) {
    var n = delToks.length, m = insToks.length, GAP = -0.35;
    var S = [], P = [], i, j;
    for (i = 0; i <= n; i++) {
      S.push(new Array(m + 1).fill(0));
      P.push(new Array(m + 1).fill(0));
    }
    for (i = 1; i <= n; i++) { S[i][0] = S[i - 1][0] + GAP; P[i][0] = 1; }
    for (j = 1; j <= m; j++) { S[0][j] = S[0][j - 1] + GAP; P[0][j] = 2; }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var diag = S[i - 1][j - 1] + tokenSim(delToks[i - 1], insToks[j - 1]);
        var up = S[i - 1][j] + GAP;
        var left = S[i][j - 1] + GAP;
        if (diag >= up && diag >= left) { S[i][j] = diag; P[i][j] = 0; }
        else if (up >= left) { S[i][j] = up; P[i][j] = 1; }
        else { S[i][j] = left; P[i][j] = 2; }
      }
    }
    var map = new Array(m).fill(-1);
    i = n; j = m;
    while (i > 0 || j > 0) {
      var p = (i > 0 && j > 0) ? P[i][j] : (i > 0 ? 1 : 2);
      if (p === 0) { map[j - 1] = i - 1; i--; j--; }
      else if (p === 1) i--;
      else j--;
    }
    var last = -1;
    for (j = 0; j < m; j++) { if (map[j] !== -1) last = map[j]; else if (last !== -1) map[j] = last; }
    for (j = m - 1; j >= 0; j--) { if (map[j] === -1) map[j] = (j < m - 1) ? map[j + 1] : 0; }
    return map;
  }

  /* ---------------- Сборка исправленного SRT ---------------- */

  function balanceWords(words, L) {
    L = Math.max(1, Math.min(L, words.length));
    if (L === 1) return [words.join(' ')];
    var total = words.join(' ').length;
    var target = total / L;
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var cand = cur ? cur + ' ' + words[i] : words[i];
      var wordsLeft = words.length - i;
      var linesLeft = L - lines.length;
      if (cur && lines.length < L - 1 && cand.length > target && wordsLeft >= linesLeft) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = cand;
      }
    }
    if (cur) lines.push(cur);
    while (lines.length > L) {
      var last = lines.pop();
      lines[lines.length - 1] += ' ' + last;
    }
    return lines;
  }

  function buildCorrected(srt, bTokens, ops, groups, opts) {
    opts = opts || {};
    var aw = srt.words;
    var perBlock = srt.blocks.map(function () { return []; });

    // Для каждой позиции операции — блок ближайшего СЛЕДУЮЩЕГО
    // «оригинального» слова (eq/del). Нужен для вставок на границе блоков.
    var nextOrig = new Array(ops.length + 1);
    nextOrig[ops.length] = -1;
    for (var q = ops.length - 1; q >= 0; q--) {
      nextOrig[q] = (ops[q].t !== 'ins') ? aw[ops[q].ai].blockIdx : nextOrig[q + 1];
    }

    var lastAi = -1;
    var i = 0;
    while (i < ops.length) {
      var op = ops[i];
      if (op.t === 'eq') {
        perBlock[aw[op.ai].blockIdx].push({ text: aw[op.ai].text, ai: op.ai });
        lastAi = op.ai;
        i++;
        continue;
      }
      // Группа правки целиком (подряд идущие del/ins одной группы)
      var g = groups[op.g];
      var dels = [], inss = [];
      var j = i;
      while (j < ops.length && ops[j].t !== 'eq' && ops[j].g === op.g) {
        if (ops[j].t === 'del') dels.push(ops[j].ai);
        else inss.push(ops[j].bi);
        j++;
      }
      var prevBlock = lastAi >= 0 ? aw[lastAi].blockIdx : (aw.length ? aw[0].blockIdx : 0);

      if (!g.applied) {
        // Правка выключена: оставляем слова из SRT как были
        dels.forEach(function (ai) {
          perBlock[aw[ai].blockIdx].push({ text: aw[ai].text, ai: ai });
        });
      } else if (dels.length) {
        // Замена: каждое вставляемое слово идёт в блок наиболее похожего
        // удаляемого (выравнивание по схожести, порядок монотонный) и
        // наследует его позицию строки
        var amap = alignInsToDel(
          dels.map(function (ai2) { return aw[ai2].text; }),
          inss.map(function (bi3) { return bTokens[bi3]; })
        );
        var usedDel = {};
        inss.forEach(function (bi2, idx) {
          var d = amap[idx];
          if (d < 0 || d >= dels.length) d = 0;
          var ai = dels[d];
          var first = !usedDel[d];
          usedDel[d] = true;
          perBlock[aw[ai].blockIdx].push({
            text: normOutToken(bTokens[bi2]),
            ai: first ? ai : null
          });
        });
      } else if (inss.length) {
        // Чистая вставка: обычно к предыдущему слову; но маркер «•» на
        // границе блоков относится к СЛЕДУЮЩЕМУ блоку
        var blk = prevBlock;
        var nb = nextOrig[j];
        if (nb >= 0 && nb !== prevBlock && normOutToken(bTokens[inss[0]]) === '\u2022') {
          blk = nb;
        }
        inss.forEach(function (bi2) {
          perBlock[blk].push({ text: normOutToken(bTokens[bi2]), ai: null });
        });
      }

      if (dels.length) lastAi = dels[dels.length - 1];
      i = j;
    }

    var outBlocks = [];
    srt.blocks.forEach(function (b, bi) {
      var es = perBlock[bi];
      if (!es.length) {
        if (opts.removeEmpty) return;
        outBlocks.push({ time: b.time, lines: [] });
        return;
      }
      var lines = [];
      var cur = [];
      var pending = false; // перенос строки «висит» до следующего оригинального слова
      es.forEach(function (e) {
        if (pending && e.ai !== null) {
          lines.push(cur.join(' '));
          cur = [];
          pending = false;
        }
        cur.push(e.text);
        if (e.ai !== null && b.breakAfter[e.ai]) pending = true;
      });
      if (cur.length) lines.push(cur.join(' '));
      var joined = es.map(function (e) { return e.text; }).join(' ');
      // Если исходный перенос строки «потерялся» (слово с переносом удалено),
      // а текст длинный — балансируем в исходное число строк.
      if (lines.length === 1 && b.lineCount > 1 && joined.length > 42) {
        lines = balanceWords(es.map(function (e) { return e.text; }), b.lineCount);
      }
      outBlocks.push({ time: b.time, lines: lines });
    });

    var n = 0;
    var parts = outBlocks.map(function (ob) {
      n++;
      return n + '\n' + ob.time + (ob.lines.length ? '\n' + ob.lines.join('\n') : '');
    });
    return parts.join('\n\n') + '\n';
  }

  /* ---------------- Извлечение текста из HTML (после mammoth) ---------------- */

  // Примечание: mammoth сам обрабатывает режим рецензирования Word:
  // tracked-вставки (w:ins) принимаются, tracked-удаления (w:del) отбрасываются.
  // Проверено экспериментально. Поэтому загрузка .docx безопаснее копипаста.

  function collectLines(root, out) {
    root.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6').forEach(function (el) {
      if (el.tagName !== 'LI' && el.closest('li')) return; // p внутри li — не дублируем
      var node = el;
      if (el.tagName === 'LI' && el.querySelector('ul,ol')) {
        node = el.cloneNode(true);
        node.querySelectorAll('ul,ol').forEach(function (x) { x.remove(); });
      }
      var raw = node.textContent.replace(/[ \t\u00A0]+/g, ' ');
      var pieces = raw.split(/\n+/).map(function (x) { return x.trim(); })
        .filter(function (x) { return x; });
      if (!pieces.length) return;
      if (el.tagName === 'LI') pieces[0] = '\u2022 ' + pieces[0]; // маркер -> "•"
      pieces.forEach(function (x) { out.push(x); });
    });
  }

  // Если документ — «мастер-таблица» со столбцом Script (#, Section, Script,
  // Asset...), берём только ячейки этого столбца. Иначе — весь документ.
  function extractDocxText(html, opts, DOMParserImpl) {
    opts = opts || {};
    var P = DOMParserImpl || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    var doc = new P().parseFromString(html, 'text/html');
    // Shift+Enter в Word = <br>: без этого «verbatim.» и «Use» склеятся
    doc.querySelectorAll('br').forEach(function (el) {
      el.replaceWith(doc.createTextNode('\n'));
    });
    if (opts.stripStrike !== false) {
      // заменяем пробелом, а не удаляем: если вычеркнуты и окружающие
      // пробелы ("providing~~ precise ~~optimal"), слова не должны склеиться
      doc.querySelectorAll('s,del,strike').forEach(function (el) {
        el.replaceWith(doc.createTextNode(' '));
      });
    }
    var out = [];
    var scriptCells = [];
    doc.querySelectorAll('table').forEach(function (tbl) {
      var rows = Array.prototype.slice.call(
        tbl.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr')
      );
      if (!rows.length) return;
      var headerRow = -1, colIdx = -1;
      for (var r = 0; r < Math.min(rows.length, 3) && colIdx === -1; r++) {
        var cells = rows[r].children;
        for (var c = 0; c < cells.length; c++) {
          var t = cells[c].textContent.replace(/\s+/g, ' ').trim().toLowerCase();
          if (t === 'script' || t.indexOf('script') === 0) {
            headerRow = r; colIdx = c; break;
          }
        }
      }
      if (colIdx === -1) return;
      for (var r2 = headerRow + 1; r2 < rows.length; r2++) {
        var cell = rows[r2].children[colIdx];
        if (cell) scriptCells.push(cell);
      }
    });
    if (scriptCells.length) {
      scriptCells.forEach(function (cell) {
        var before = out.length;
        collectLines(cell, out);
        if (out.length === before) {
          var t = cell.textContent.replace(/\s+/g, ' ').trim();
          if (t) out.push(t);
        }
      });
    } else {
      // от документа, а не от body: в Node-эмуляции DOM абзацы могут
      // лежать вне body, в браузере результат тот же
      collectLines(doc, out);
    }
    return out.join('\n');
  }

  /* ---------------- Экспорт для тестов (Node) ---------------- */

  var api = {
    normChars: normChars,
    normToken: normToken,
    normOutToken: normOutToken,
    normalizeDashes: normalizeDashes,
    parseSRT: parseSRT,
    diffTokens: diffTokens,
    groupOps: groupOps,
    buildCorrected: buildCorrected,
    balanceWords: balanceWords,
    extractDocxText: extractDocxText,
    stripWordComments: stripWordComments,
    splitGluedSentences: splitGluedSentences,
    fixPunctuationCollisions: fixPunctuationCollisions,
    tokenSim: tokenSim,
    alignInsToDel: alignInsToDel
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return; // Node — только логика, без UI

  /* ================= UI ================= */

  var state = {
    note: null,
    stats: null,
    srt: null,
    srtName: null,
    a: [],       // токены SRT
    b: [],       // токены сценария
    ops: [],
    groups: []
  };

  function $(id) { return document.getElementById(id); }

  function t(key, params) {
    return (window.I18N && window.I18N.t) ? window.I18N.t(key, params) : key;
  }

  var srtTA, docTA, diffView, outputTA, statsEl, appliedEl;

  function wordCount(s) {
    var m = String(s || '').trim();
    return m ? m.split(/\s+/).length : 0;
  }

  function updateCounts() {
    $('srtCount').textContent = t('words', { n: wordCount(srtTA.value) });
    $('docCount').textContent = t('words', { n: wordCount(docTA.value) });
  }

  /* ---------- Импорт файлов ---------- */

  function readTextFile(file, cb) {
    var r = new FileReader();
    r.onload = function () { cb(String(r.result)); };
    r.readAsText(file, 'utf-8');
  }

  // Коды ошибок из doc.js -> локализованный текст
  function errText(e) {
    var code = e && (e.code || e.message);
    if (/^E_[A-Z_]+$/.test(String(code))) {
      return t({
        E_NOT_DOC: 'errNotDoc', E_NO_STREAM: 'errNoStream',
        E_NOT_WORD: 'errNotWord', E_NO_TEXT: 'errNoText'
      }[code] || 'errNotWord');
    }
    return (e && e.message) ? e.message : String(e);
  }

  function noteText(key, params) {
    if (key !== '__doc__') return t(key, params);
    // составная заметка про .doc
    var p = params || {};
    var head = p.detected
      ? t('docHeadYes', { rows: p.rows, cols: p.cols })
      : t('docHeadNo');
    var cuts = [];
    if (p.hadStrike) cuts.push(t('cutStrike'));
    if (p.hadDel) cuts.push(t('cutDel'));
    var mid = cuts.length ? t('docCuts', { list: cuts.join(', ') }) : '';
    return head + mid + t('docBullets');
  }

  function showNote(key, params, kind) {
    var el = $('docNote');
    state.note = { key: key, params: params, kind: kind };
    el.textContent = noteText(key, params);
    el.className = 'note' + (kind ? ' ' + kind : '');
    el.hidden = false;
  }

  // Старый формат .doc (Word 97-2003) — бинарный, mammoth его не читает.
  function importLegacyDoc(file) {
    if (!window.LegacyDoc) {
      showNote('noLegacy', null, 'err');
      return;
    }
    file.arrayBuffer().then(function (buf) {
      var ex = window.LegacyDoc.extractTextEx(buf, {
        stripStrike: $('optStrike').checked
      });
      var res = window.LegacyDoc.toHtml(ex.text);
      docTA.value = extractDocxText(res.html, {
        stripStrike: $('optStrike').checked
      });
      updateCounts();
      showNote('__doc__', {
        detected: res.detected, rows: res.rows || 0, cols: res.columns || 0,
        hadStrike: ex.hadStrike, hadDel: ex.hadDel
      }, res.detected ? 'ok' : 'warn');
    }).catch(function (e) {
      showNote('docErr', { msg: errText(e) }, 'err');
    });
  }

  function importDocx(file) {
    if (!window.mammoth) {
      showNote('noMammoth', null, 'err');
      return;
    }
    file.arrayBuffer().then(function (buf) {
      return window.mammoth.convertToHtml({ arrayBuffer: buf });
    }).then(function (res) {
      docTA.value = extractDocxText(res.value, {
        stripStrike: $('optStrike').checked
      });
      updateCounts();
      showNote('docxOk', null, 'ok');
    }).catch(function (e) {
      showNote('docxErr', { msg: errText(e) }, 'err');
    });
  }

  /* ---------- Сравнение ---------- */

  function compare() {
    var srt = parseSRT(srtTA.value);
    if (!srt.blocks.length) {
      alert(t('alertNoSrt'));
      return;
    }
    state.srt = srt;
    state.a = srt.words.map(function (w) { return w.text; });

    var docText = stripWordComments(docTA.value);
    if ($('optDash').checked) docText = normalizeDashes(docText);
    docText = fixPunctuationCollisions(splitGluedSentences(normChars(docText)));
    state.b = docText.split(/\s+/).filter(Boolean);
    if (!state.b.length) {
      alert(t('alertNoDoc'));
      return;
    }

    state.ops = diffTokens(state.a, state.b, function (x, y) {
      return normToken(x) === normToken(y);
    });
    state.groups = groupOps(state.ops);

    renderDiff();
    renderStats();
    updateOutput();
    $('results').hidden = false;
    if ($('results').scrollIntoView) {
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderDiff() {
    var frag = document.createDocumentFragment();
    var curBlock = -1;
    state.ops.forEach(function (op) {
      var blockIdx = null;
      if (op.t === 'eq' || op.t === 'del') blockIdx = state.srt.words[op.ai].blockIdx;
      if (blockIdx !== null && blockIdx !== curBlock) {
        curBlock = blockIdx;
        var m = document.createElement('span');
        m.className = 'bm';
        m.textContent = String(curBlock + 1);
        m.title = t('blockTitle', { n: curBlock + 1 });
        frag.appendChild(m);
      }
      var sp = document.createElement('span');
      if (op.t === 'eq') {
        sp.className = 'eq';
        sp.textContent = state.a[op.ai];
      } else if (op.t === 'del') {
        sp.className = 'tok del' + (state.groups[op.g].applied ? '' : ' off');
        sp.dataset.g = op.g;
        sp.textContent = state.a[op.ai];
      } else {
        sp.className = 'tok ins' + (state.groups[op.g].applied ? '' : ' off');
        sp.dataset.g = op.g;
        sp.textContent = normOutToken(state.b[op.bi]);
      }
      if (op.t !== 'eq') {
        sp.title = t('editTitle', { n: op.g + 1 });
      }
      frag.appendChild(sp);
      frag.appendChild(document.createTextNode(' '));
    });
    diffView.replaceChildren(frag);
  }

  function renderStats() {
    var eq = 0, del = 0, ins = 0;
    state.ops.forEach(function (op) {
      if (op.t === 'eq') eq++; else if (op.t === 'del') del++; else ins++;
    });
    var sim = state.a.length + state.b.length
      ? Math.round((2 * eq / (state.a.length + state.b.length)) * 1000) / 10
      : 100;
    state.stats = { edits: state.groups.length, del: del, ins: ins, sim: sim };
    statsEl.textContent = t('statsLine', state.stats);
    updateAppliedCounter();
  }

  function updateAppliedCounter() {
    var on = state.groups.filter(function (g) { return g.applied; }).length;
    appliedEl.textContent = t('applied', { on: on, total: state.groups.length });
  }

  function toggleGroup(id) {
    var g = state.groups[id];
    g.applied = !g.applied;
    document.querySelectorAll('[data-g="' + id + '"]').forEach(function (sp) {
      sp.classList.toggle('off', !g.applied);
    });
    updateAppliedCounter();
    updateOutput();
  }

  function setAll(v) {
    state.groups.forEach(function (g) { g.applied = v; });
    document.querySelectorAll('.tok').forEach(function (sp) {
      sp.classList.toggle('off', !v);
    });
    updateAppliedCounter();
    updateOutput();
  }

  /* ---------- Результат ---------- */

  function updateOutput() {
    if (!state.srt) return;
    outputTA.value = buildCorrected(state.srt, state.b, state.ops, state.groups, {
      removeEmpty: $('optRemoveEmpty').checked
    });
  }

  function outFileName() {
    if (state.srtName) {
      return state.srtName.replace(/\.srt$/i, '') + '_CORRECTED.srt';
    }
    return 'corrected.srt';
  }

  function download() {
    var blob = new Blob([outputTA.value], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = outFileName();
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function copyOutput() {
    navigator.clipboard.writeText(outputTA.value).then(function () {
      var b = $('btnCopy');
      b.textContent = t('copied');
      setTimeout(function () { b.textContent = t('btnCopy'); }, 1500);
    });
  }

  /* ---------- Инициализация ---------- */

  function init() {
    srtTA = $('srtInput');
    docTA = $('docInput');
    diffView = $('diffView');
    outputTA = $('output');
    statsEl = $('stats');
    appliedEl = $('appliedCounter');

    $('srtFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      state.srtName = f.name;
      readTextFile(f, function (t) { srtTA.value = t; updateCounts(); });
    });

    $('docFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      if (/\.docx$/i.test(f.name)) importDocx(f);
      else if (/\.(doc|dot)$/i.test(f.name)) importLegacyDoc(f);
      else readTextFile(f, function (t) { docTA.value = t; updateCounts(); });
    });

    srtTA.addEventListener('input', updateCounts);
    docTA.addEventListener('input', updateCounts);

    $('btnCompare').addEventListener('click', compare);
    $('btnAll').addEventListener('click', function () { setAll(true); });
    $('btnNone').addEventListener('click', function () { setAll(false); });
    $('btnCopy').addEventListener('click', copyOutput);
    $('btnDownload').addEventListener('click', download);
    $('optRemoveEmpty').addEventListener('change', updateOutput);

    document.addEventListener('langchange', function () {
      updateCounts();
      if (state.note) {
        $('docNote').textContent = noteText(state.note.key, state.note.params);
      }
      if (state.srt) {
        renderDiff();
        if (state.stats) statsEl.textContent = t('statsLine', state.stats);
        updateAppliedCounter();
      }
    });

    diffView.addEventListener('click', function (e) {
      var sp = e.target.closest('[data-g]');
      if (sp) toggleGroup(Number(sp.dataset.g));
    });

    updateCounts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
