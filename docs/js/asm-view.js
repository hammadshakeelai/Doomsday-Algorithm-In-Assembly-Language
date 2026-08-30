// asm-view.js -- a read-only NASM source viewer.
//
// Deliberately not an editor. doomsday.html shows the program as a published
// artefact, so the source is rendered as markup rather than put in a textarea:
// there is no caret to place, no input to intercept, and nothing to guard
// against. Editing lives in ide.html, one link away.
//
// The tokenizer is a single-pass regex scan. It is a highlighter, not a parser
// -- it will happily colour nonsense -- which is the right trade for 500 lines
// of syntax colour on a page whose real assembler is one pane to the right.

(function (global) {
  'use strict';

  var REG = wordSet('ax bx cx dx ah al bh bl ch cl dh dl si di sp bp cs ds es ss ip');

  var DIR = wordSet('org bits section segment db dw dd dq dt resb resw resd equ ' +
                    'times global extern byte word dword qword ptr near far short');

  var MNEM = wordSet(
    'mov movzx movsx xchg lea push pop pushf popf ' +
    'add sub adc sbb inc dec neg cmp mul imul div idiv ' +
    'and or xor not test shl shr sal sar rol ror rcl rcr ' +
    'jmp je jne jz jnz jg jge jl jle ja jae jb jbe jna jnae jnb jnbe ' +
    'jc jnc jo jno js jns jp jnp jcxz loop loope loopne ' +
    'call ret retf int into iret nop hlt ' +
    'cbw cwd aaa aas aam aad daa das ' +
    'clc stc cmc cld std cli sti ' +
    'lodsb lodsw stosb stosw movsb movsw cmpsb scasb rep repe repne');

  function wordSet(s) {
    var o = Object.create(null);
    s.split(/\s+/).forEach(function (w) { if (w) o[w] = true; });
    return o;
  }

  // ; comment | 'string' | number | identifier
  var TOKEN = new RegExp(
    '(;.*$)'                                        + '|' +
    "('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\")" + '|' +
    '(\\b0[xX][0-9a-fA-F]+\\b|\\b\\d[0-9a-fA-F]*[hH]\\b|\\b\\d+\\b)' + '|' +
    '([A-Za-z_.][A-Za-z0-9_.]*)', 'g');

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlight(line) {
    // A leading identifier that owns the line is a definition, whether it ends
    // in a colon or introduces data: `next:` and `msg1 db 'hi$'` are both names
    // this program jumps to or loads from.
    var defines = /^\s*([A-Za-z_.][A-Za-z0-9_.]*)\s*(:|(?:db|dw|dd|dq|resb|resw|equ)\b)/i.exec(line);
    var defName = defines ? defines[1] : null;
    var claimed = false;

    var out = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(line)) !== null) {
      out += esc(line.slice(last, m.index));
      last = TOKEN.lastIndex;

      if (m[1])      out += '<i class="cm">'  + esc(m[1]) + '</i>';
      else if (m[2]) out += '<i class="str">' + esc(m[2]) + '</i>';
      else if (m[3]) out += '<i class="num">' + esc(m[3]) + '</i>';
      else {
        var word = m[4], low = word.toLowerCase(), cls = '';
        if (!claimed && word === defName) { cls = 'lbl'; claimed = true; }
        else if (REG[low])  cls = 'reg';
        else if (DIR[low])  cls = 'pp';
        else if (MNEM[low]) cls = 'kw';
        out += cls ? '<i class="' + cls + '">' + esc(word) + '</i>' : esc(word);
      }
    }
    return out + esc(line.slice(last));
  }

  function AsmView(el) {
    this.el = el;
    this.rows = [];
    this.source = '';
  }

  // Fetch and render. Resolves with the raw text, which is also what gets fed
  // to the assembler -- one string, so what runs is what is on screen.
  AsmView.prototype.load = function (url) {
    var self = this;
    // Revalidate rather than trust the cache. The page shows this text *and*
    // assembles it, so a stale copy is a page quietly displaying and running
    // yesterday's program -- the same class of bug DESIGN.md logs against
    // stale vendored bundles, and just as invisible.
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      self.render(text);
      return text;
    });
  };

  AsmView.prototype.render = function (text) {
    this.source = text;
    this.rows = [];
    this.el.textContent = '';

    var lines = text.replace(/\r\n?/g, '\n').split('\n');
    // A trailing newline is not a line anyone wants a number for.
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

    var frag = document.createDocumentFragment();
    for (var i = 0; i < lines.length; i++) {
      var row = document.createElement('div');
      row.className = 'ln';
      row.innerHTML = '<span class="no">' + (i + 1) + '</span>' +
                      '<span class="src">' + (highlight(lines[i]) || '&nbsp;') + '</span>';
      frag.appendChild(row);
      this.rows.push(row);
    }
    this.el.appendChild(frag);
  };

  // Tint a source line, given a 1-based line number from nasm-errors.js.
  AsmView.prototype.markLine = function (n, severity) {
    var row = this.rows[n - 1];
    if (!row) return;
    row.classList.add(severity === 'warning' ? 'mark-warning' : 'mark-error');
  };

  AsmView.prototype.clearMarks = function () {
    this.rows.forEach(function (r) { r.classList.remove('mark-error', 'mark-warning'); });
  };

  // Bring the first bad line into view. An error on line 300 of a 500-line file
  // is invisible otherwise, and hunting for it is exactly the work the gutter
  // marker exists to save.
  //
  // Scrolls vertically only, by hand. scrollIntoView also nudges the pane
  // sideways, and a few pixels of horizontal scroll slides every line under the
  // sticky line-number column -- which reads as the first character of the file
  // having gone missing.
  AsmView.prototype.revealFirstMark = function () {
    for (var i = 0; i < this.rows.length; i++) {
      if (this.rows[i].className.indexOf('mark-') > -1) {
        this.el.scrollTop = Math.max(
          0, this.rows[i].offsetTop - this.el.clientHeight / 2);
        return;
      }
    }
  };

  global.AsmView = AsmView;
})(window);
