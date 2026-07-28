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
      .replace(/\s*[\u2014\u2013]\s*/g, ' - ');
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
        // Замена: i-е вставляемое слово идёт в блок i-го удаляемого и
        // наследует его позицию строки (хвост — в блок последнего удаляемого)
        inss.forEach(function (bi2, idx) {
          var ai = dels[Math.min(idx, dels.length - 1)];
          perBlock[aw[ai].blockIdx].push({
            text: normOutToken(bTokens[bi2]),
            ai: idx < dels.length ? ai : null
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
      var t = node.textContent.replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (el.tagName === 'LI') t = '\u2022 ' + t; // маркер списка -> "•"
      out.push(t);
    });
  }

  // Если документ — «мастер-таблица» со столбцом Script (#, Section, Script,
  // Asset...), берём только ячейки этого столбца. Иначе — весь документ.
  function extractDocxText(html, opts, DOMParserImpl) {
    opts = opts || {};
    var P = DOMParserImpl || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    var doc = new P().parseFromString(html, 'text/html');
    if (opts.stripStrike !== false) {
      doc.querySelectorAll('s,del,strike').forEach(function (el) { el.remove(); });
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
      collectLines(doc.body, out);
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
    extractDocxText: extractDocxText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return; // Node — только логика, без UI

  /* ================= UI ================= */

  var state = {
    srt: null,
    srtName: null,
    a: [],       // токены SRT
    b: [],       // токены сценария
    ops: [],
    groups: []
  };

  function $(id) { return document.getElementById(id); }

  var srtTA, docTA, diffView, outputTA, statsEl, appliedEl;

  function wordCount(s) {
    var m = String(s || '').trim();
    return m ? m.split(/\s+/).length : 0;
  }

  function updateCounts() {
    $('srtCount').textContent = wordCount(srtTA.value) + ' слов';
    $('docCount').textContent = wordCount(docTA.value) + ' слов';
  }

  /* ---------- Импорт файлов ---------- */

  function readTextFile(file, cb) {
    var r = new FileReader();
    r.onload = function () { cb(String(r.result)); };
    r.readAsText(file, 'utf-8');
  }

  function importDocx(file) {
    if (!window.mammoth) {
      alert('Библиотека mammoth не загрузилась. Для чтения .docx нужен доступ в интернет при первом открытии страницы. Либо вставьте текст сценария вручную.');
      return;
    }
    file.arrayBuffer().then(function (buf) {
      return window.mammoth.convertToHtml({ arrayBuffer: buf });
    }).then(function (res) {
      docTA.value = extractDocxText(res.value, {
        stripStrike: $('optStrike').checked
      });
      updateCounts();
    }).catch(function (e) {
      alert('Не удалось прочитать .docx: ' + e.message);
    });
  }

  /* ---------- Сравнение ---------- */

  function compare() {
    var srt = parseSRT(srtTA.value);
    if (!srt.blocks.length) {
      alert('Не удалось найти блоки субтитров в левом поле. Вставьте содержимое .srt файла целиком (с тайм-кодами).');
      return;
    }
    state.srt = srt;
    state.a = srt.words.map(function (w) { return w.text; });

    var docText = docTA.value;
    if ($('optDash').checked) docText = normalizeDashes(docText);
    docText = normChars(docText);
    state.b = docText.split(/\s+/).filter(Boolean);
    if (!state.b.length) {
      alert('Правое поле пустое — вставьте текст сценария или загрузите .docx.');
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
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        m.title = 'Блок субтитров №' + (curBlock + 1);
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
        sp.title = 'Правка #' + (op.g + 1) + ' — клик: применить/отменить';
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
    statsEl.textContent =
      'Правок: ' + state.groups.length +
      ' • удаляется слов: ' + del +
      ' • добавляется слов: ' + ins +
      ' • совпадение: ' + sim + '%';
    updateAppliedCounter();
  }

  function updateAppliedCounter() {
    var on = state.groups.filter(function (g) { return g.applied; }).length;
    appliedEl.textContent = 'Применено правок: ' + on + ' / ' + state.groups.length;
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
      var t = b.textContent;
      b.textContent = 'Скопировано ✓';
      setTimeout(function () { b.textContent = t; }, 1500);
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
