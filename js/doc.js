/* ============================================================
 * Чтение старого формата .doc (Word 97-2003) в браузере.
 * Без внешних библиотек: разбор контейнера OLE2/CFB, потока
 * WordDocument и таблицы кусков (piece table), затем сборка
 * псевдо-HTML, который дальше обрабатывается как .docx.
 * ============================================================ */
(function () {
  'use strict';

  var SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
  var FREE = 0xFFFFFFFF, ENDCHAIN = 0xFFFFFFFE;

  /* ---------------- Контейнер OLE2 / CFB ---------------- */

  function Cfb(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), i;
    for (i = 0; i < 8; i++) {
      if (u8[i] !== SIG[i]) throw new Error('файл не похож на Word 97-2003 (.doc)');
    }
    var secSize = 1 << dv.getUint16(0x1E, true);
    var miniSecSize = 1 << dv.getUint16(0x20, true);
    var dirStart = dv.getUint32(0x30, true);
    var miniCutoff = dv.getUint32(0x38, true) || 4096;
    var miniFatStart = dv.getUint32(0x3C, true);
    var difatStart = dv.getUint32(0x44, true);

    function secOff(s) { return (s + 1) * secSize; }

    // список секторов FAT: 109 в заголовке + цепочка DIFAT
    var fatSects = [];
    for (i = 0; i < 109; i++) {
      var s0 = dv.getUint32(0x4C + i * 4, true);
      if (s0 === FREE || s0 === ENDCHAIN) break;
      fatSects.push(s0);
    }
    var ds = difatStart, guard = 0;
    while (ds !== FREE && ds !== ENDCHAIN && guard++ < 100000) {
      var base = secOff(ds), per = secSize / 4 - 1;
      for (i = 0; i < per; i++) {
        var v = dv.getUint32(base + i * 4, true);
        if (v !== FREE && v !== ENDCHAIN) fatSects.push(v);
      }
      ds = dv.getUint32(base + secSize - 4, true);
    }

    var fat = [];
    fatSects.forEach(function (fs) {
      var b = secOff(fs);
      if (b + secSize > u8.length) return;
      for (var k = 0; k < secSize / 4; k++) fat.push(dv.getUint32(b + k * 4, true));
    });

    function readChain(start, size) {
      var sects = [], s = start, g = 0;
      while (s !== ENDCHAIN && s !== FREE && s < fat.length && g++ < 200000) {
        sects.push(s);
        s = fat[s];
      }
      var out = new Uint8Array(sects.length * secSize);
      sects.forEach(function (sc, k) {
        var b = secOff(sc);
        if (b + secSize <= u8.length) out.set(u8.subarray(b, b + secSize), k * secSize);
      });
      return (size && size < out.length) ? out.subarray(0, size) : out;
    }

    var miniFat = [];
    if (miniFatStart !== ENDCHAIN && miniFatStart !== FREE) {
      var mf = readChain(miniFatStart);
      var mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
      for (i = 0; i + 4 <= mf.length; i += 4) miniFat.push(mdv.getUint32(i, true));
    }

    var dirBytes = readChain(dirStart);
    var entries = [];
    for (var off = 0; off + 128 <= dirBytes.length; off += 128) {
      var e = new DataView(dirBytes.buffer, dirBytes.byteOffset + off, 128);
      var nameLen = e.getUint16(0x40, true), name = '';
      for (var c = 0; c + 2 <= Math.max(0, nameLen - 2); c += 2) {
        name += String.fromCharCode(e.getUint16(c, true));
      }
      entries.push({
        name: name, type: e.getUint8(0x42),
        start: e.getUint32(0x74, true), size: e.getUint32(0x78, true)
      });
    }
    var root = entries.filter(function (x) { return x.type === 5; })[0];
    var miniStream = root ? readChain(root.start) : new Uint8Array(0);

    function readMini(start, size) {
      var out = new Uint8Array(size), pos = 0, s = start, g = 0;
      while (s !== ENDCHAIN && s !== FREE && pos < size && g++ < 200000) {
        var b = s * miniSecSize, len = Math.min(miniSecSize, size - pos);
        if (b + len <= miniStream.length) out.set(miniStream.subarray(b, b + len), pos);
        pos += len;
        s = miniFat[s];
      }
      return out;
    }

    this.stream = function (name) {
      var en = entries.filter(function (x) { return x.name === name && x.type === 2; })[0];
      if (!en) return null;
      return en.size < miniCutoff ? readMini(en.start, en.size) : readChain(en.start, en.size);
    };
  }

  /* ---------------- Декодирование ---------------- */

  var CP1252_HI = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178
  };

  function decodeCp1252(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      out += String.fromCharCode(b >= 0x80 && b <= 0x9F ? (CP1252_HI[b] || b) : b);
    }
    return out;
  }

  function decodeUtf16(bytes) {
    var out = '', n = bytes.length - 1;
    for (var i = 0; i + 1 <= n; i += 2) {
      out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    }
    return out;
  }

  /* ---------------- Свойства символов: зачёркивание и правки ----------------
   * Опкоды определены экспериментально на файлах с известными правками:
   *   0x0837 — зачёркнутый текст (жирный 0x0835 не путается)
   *   0x0800 — удаление в режиме рецензирования (отбрасываем)
   *   0x0801 — вставка в режиме рецензирования (принимаем, т.е. оставляем)
   */

  var F_STRIKE = 1, F_DEL = 2;

  function chpxFlags(sp) {
    var out = 0, i = 0;
    var dv = new DataView(sp.buffer, sp.byteOffset, sp.byteLength);
    while (i + 2 <= sp.length) {
      var op = dv.getUint16(i, true);
      i += 2;
      var spra = (op >> 13) & 7, size;
      if (spra === 0 || spra === 1) size = 1;
      else if (spra === 2 || spra === 4 || spra === 5) size = 2;
      else if (spra === 3) size = 4;
      else if (spra === 7) size = 3;
      else {                                  // переменная длина
        if (i >= sp.length) break;
        size = sp[i];
        i += 1;
      }
      var val = i < sp.length ? sp[i] : 0;
      if (val === 1 || val === 0x81) {
        if (op === 0x0837) out |= F_STRIKE;
        else if (op === 0x0800) out |= F_DEL;
      }
      i += size;
    }
    return out;
  }

  function chpxRuns(wd, dv, tbl) {
    var runs = [];
    if (!tbl) return runs;
    var fcPlc = dv.getInt32(0x0FA, true), lcbPlc = dv.getInt32(0x0FE, true);
    if (fcPlc < 0 || lcbPlc < 12 || fcPlc + lcbPlc > tbl.length) return runs;
    var plc = tbl.subarray(fcPlc, fcPlc + lcbPlc);
    var pdv = new DataView(plc.buffer, plc.byteOffset, plc.byteLength);
    var m = Math.floor((lcbPlc - 4) / 8), i;
    for (i = 0; i < m; i++) {
      var pn = pdv.getUint32(4 * (m + 1) + i * 4, true) & 0x3FFFFF;
      var off = pn * 512;                     // страницы FKP всегда по 512 байт
      if (off + 512 > wd.length) continue;
      var page = wd.subarray(off, off + 512);
      var gdv = new DataView(page.buffer, page.byteOffset, 512);
      var crun = page[511];
      if (!crun || 4 * (crun + 1) + crun > 511) continue;
      for (var k = 0; k < crun; k++) {
        var rgb = page[4 * (crun + 1) + k];
        if (!rgb) continue;                   // свойства по умолчанию
        var base = rgb * 2, cb = page[base];
        if (base + 1 + cb > 512) continue;
        var f = chpxFlags(page.subarray(base + 1, base + 1 + cb));
        if (f) runs.push({ a: gdv.getUint32(k * 4, true), b: gdv.getUint32((k + 1) * 4, true), f: f });
      }
    }
    return runs;
  }

  // Отметить символы, попавшие в зачёркнутые/удалённые прогоны
  function buildMask(len, pieces, runs) {
    var mask = new Uint8Array(len);
    if (!runs.length) return mask;
    pieces.forEach(function (p) {
      var step = p.compressed ? 1 : 2;
      var base = p.compressed ? (p.fc >> 1) : p.fc;
      var end = base + step * (p.cpEnd - p.cpStart);
      runs.forEach(function (r) {
        var lo = Math.max(r.a, base), hi = Math.min(r.b, end);
        if (hi <= lo) return;
        var cpLo = p.cpStart + Math.floor((lo - base) / step);
        var cpHi = p.cpStart + Math.ceil((hi - base) / step);
        for (var c = Math.max(0, cpLo); c < Math.min(len, cpHi); c++) mask[c] |= r.f;
      });
    });
    return mask;
  }

  // Убрать помеченный текст. Структурные символы (конец ячейки/абзаца)
  // сохраняем, иначе развалится таблица; остальное — пробелом, чтобы
  // соседние слова не склеились.
  function applyMask(text, mask, dropStrike) {
    var out = '', hadStrike = false, hadDel = false;
    for (var i = 0; i < text.length; i++) {
      var f = mask[i] || 0;
      if (f & F_STRIKE) hadStrike = true;
      if (f & F_DEL) hadDel = true;
      var drop = (f & F_DEL) || (dropStrike && (f & F_STRIKE));
      if (!drop) { out += text[i]; continue; }
      var ch = text[i];
      out += (ch === '\x07' || ch === '\r' || ch === '\x0B') ? ch : ' ';
    }
    return { text: out, hadStrike: hadStrike, hadDel: hadDel };
  }

  /* ---------------- Текст документа (piece table) ---------------- */

  function extractText(buf, opts) {
    return extractTextEx(buf, opts).text;
  }

  function extractTextEx(buf, opts) {
    opts = opts || {};
    var dropStrike = opts.stripStrike !== false;
    var cfb = new Cfb(buf);
    var wd = cfb.stream('WordDocument');
    if (!wd || wd.length < 0x200) throw new Error('в файле нет потока WordDocument');
    var dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
    if (dv.getUint16(0, true) !== 0xA5EC) throw new Error('это не документ Word');

    var flags = dv.getUint16(0x0A, true);
    var tbl = cfb.stream(((flags >> 9) & 1) ? '1Table' : '0Table');
    var ccpText = dv.getInt32(0x4C, true);
    var text = null, pieces = [];

    if (tbl) {
      var fcClx = dv.getInt32(0x1A2, true), lcbClx = dv.getInt32(0x1A6, true);
      if (fcClx >= 0 && lcbClx > 0 && fcClx + lcbClx <= tbl.length) {
        var clx = tbl.subarray(fcClx, fcClx + lcbClx);
        var cdv = new DataView(clx.buffer, clx.byteOffset, clx.byteLength);
        var i = 0, pcdt = null;
        while (i < clx.length) {
          if (clx[i] === 1) {                       // Prc — пропускаем
            i += 3 + cdv.getUint16(i + 1, true);
          } else if (clx[i] === 2) {                // Pcdt — таблица кусков
            var lcb = cdv.getUint32(i + 1, true);
            pcdt = clx.subarray(i + 5, i + 5 + lcb);
            break;
          } else break;
        }
        if (pcdt && pcdt.length >= 16) {
          var pdv = new DataView(pcdt.buffer, pcdt.byteOffset, pcdt.byteLength);
          var n = Math.floor((pcdt.length - 4) / 12);
          var cps = [];
          for (i = 0; i <= n; i++) cps.push(pdv.getUint32(i * 4, true));
          var parts = [];
          for (i = 0; i < n; i++) {
            var off = 4 * (n + 1) + 8 * i;
            var fcf = pdv.getUint32(off + 2, true);
            var compressed = (fcf & 0x40000000) !== 0;
            var fc = fcf & 0x3FFFFFFF;
            var cch = cps[i + 1] - cps[i];
            if (cch <= 0) continue;
            pieces.push({ cpStart: cps[i], cpEnd: cps[i + 1], fc: fc, compressed: compressed });
            if (compressed) {
              parts.push(decodeCp1252(wd.subarray(fc >> 1, (fc >> 1) + cch)));
            } else {
              parts.push(decodeUtf16(wd.subarray(fc, fc + 2 * cch)));
            }
          }
          text = parts.join('');
        }
      }
    }

    if (text === null) {                            // запасной путь: Word 6/95
      var fcMin = dv.getInt32(0x18, true), fcMac = dv.getInt32(0x1C, true);
      if (fcMac > fcMin && fcMac <= wd.length) {
        text = decodeCp1252(wd.subarray(fcMin, fcMac));
      } else {
        throw new Error('не удалось найти текст документа');
      }
    }

    if (ccpText > 0 && ccpText < text.length) text = text.slice(0, ccpText);

    var stats = { hadStrike: false, hadDel: false };
    if (pieces.length) {
      var runs = chpxRuns(wd, dv, tbl);
      if (runs.length) {
        var r = applyMask(text, buildMask(text.length, pieces, runs), dropStrike);
        text = r.text;
        stats.hadStrike = r.hadStrike;
        stats.hadDel = r.hadDel;
      }
    }
    return { text: cleanControls(text), hadStrike: stats.hadStrike, hadDel: stats.hadDel };
  }

  // Служебные символы Word -> обычный текст
  function cleanControls(t) {
    t = t.replace(/\x13[^\x14\x15]*(\x14|\x15)/g, '');  // код поля (HYPERLINK …)
    t = t.replace(/[\x13\x14\x15]/g, '');
    t = t.replace(/[\x01\x02\x03\x04\x05\x08\x1E\x1F]/g, '');
    t = t.replace(/\x0C/g, '\r');                       // разрыв страницы
    t = t.replace(/\u00A0/g, ' ');
    return t;
  }

  /* ---------------- Восстановление таблиц ---------------- */

  // 0x07 = конец ячейки; конец строки таблицы — тоже 0x07, поэтому на границе
  // строк получается "пустая ячейка". Число колонок N подбирается так, чтобы
  // метки конца строки стояли ровно через каждые N+1 ячеек.
  function findScriptColumn(cells) {
    var SECOND = /^(narration|voice\s*over|vo\b|audio|text|script)\b/i;
    var cands = [];
    cells.forEach(function (c, idx) {
      var t = c.replace(/\s+/g, ' ').trim();
      if (!t || t.length > 40) return;
      var low = t.toLowerCase().replace(/[:\s]+$/, '');
      if (low === 'script') cands.push({ idx: idx, prio: 0 });        // точный заголовок
      else if (SECOND.test(t)) cands.push({ idx: idx, prio: 1 });     // Script in Progress, Text…
    });
    if (!cands.length) return null;

    function empty(k) {
      return k >= cells.length || !cells[k].replace(/[\s\r\n\x0B]/g, '');
    }

    var best = null;
    cands.forEach(function (cd) {
      for (var N = 2; N <= 8; N++) {
        for (var col = 0; col < N; col++) {
          var start = cd.idx - col;
          if (start < 0) continue;
          var rows = 0, filled = 0, chars = 0;
          while (rows < 1000) {
            var mark = start + N + rows * (N + 1);
            if (mark >= cells.length || !empty(mark)) break;
            rows++;
            var ci = start + rows * (N + 1) + col;   // ячейка сценария строки rows
            if (ci < cells.length && !empty(ci)) {
              filled++;
              chars += cells[ci].replace(/\s+/g, ' ').trim().length;
            }
          }
          // структура должна не только «сходиться», но и давать текст:
          // иначе подбор цепляется за череду пустых ячеек
          if (rows < 3 || filled < 3) continue;
          var score = filled * 1000 + Math.min(chars, 20000) / 100 - cd.prio * 500 - N;
          if (!best || score > best.score) {
            best = { score: score, start: start, col: col, N: N, rows: rows, filled: filled };
          }
        }
      }
    });
    return best;
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Текст ячейки/абзаца -> HTML (\r = абзац, 0x0B = Shift+Enter -> <br>)
  function cellHtml(t) {
    var paras = t.split(/\r/).map(function (p) {
      return p.split(/\x0B/).map(function (x) { return esc(x.trim()); })
        .filter(function (x) { return x; }).join('<br>');
    }).filter(function (p) { return p; });
    return paras.map(function (p) { return '<p>' + p + '</p>'; }).join('');
  }

  // Итог: HTML в том же виде, что даёт mammoth для .docx, чтобы дальше
  // работала общая логика (колонка Script, списки, переносы строк).
  function toHtml(text) {
    var cells = text.split('\x07');
    var found = findScriptColumn(cells);
    if (found) {
      var rows = ['<tr><td><p>Script</p></td></tr>'];
      for (var k = 1; k <= found.rows; k++) {
        var ci = found.start + k * (found.N + 1) + found.col;
        if (ci >= cells.length) break;
        var html = cellHtml(cells[ci]);
        if (html) rows.push('<tr><td>' + html + '</td></tr>');
      }
      return {
        html: '<table>' + rows.join('') + '</table>',
        columns: found.N,
        rows: rows.length - 1,
        detected: true
      };
    }
    // колонка не найдена — отдаём весь текст абзацами
    var body = cells.map(function (c) { return cellHtml(c); }).join('');
    return { html: body, detected: false };
  }

  var api = {
    extractText: extractText, extractTextEx: extractTextEx,
    toHtml: toHtml, findScriptColumn: findScriptColumn
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LegacyDoc = api;
})();
