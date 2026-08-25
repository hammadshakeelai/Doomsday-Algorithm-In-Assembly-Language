// nasm-errors.js -- pure function, no DOM, no emulator. Testable with node.
//
// NASM writes diagnostics as:
//   prog.asm:12: error: symbol `foo' undefined
//   prog.asm:7: warning: label alone on a line ... [-w+orphan-labels]
// The DOS build prefixes the drive path, e.g. "c:/prog.asm:12: error: ...".
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NasmErrors = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LINE = /^(?:[a-zA-Z]:[\/\\])?([^\s:]+):(\d+):\s*(error|warning|fatal)\s*:\s*(.*)$/i;

  function parse(text) {
    var out = [];
    if (!text) return out;
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = LINE.exec(lines[i].trim());
      if (!m) continue;
      out.push({
        file: m[1],
        line: parseInt(m[2], 10),
        severity: m[3].toLowerCase() === 'warning' ? 'warning' : 'error',
        message: m[4].trim(),
      });
    }
    return out;
  }

  function hasErrors(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].severity !== 'warning') return true;
    }
    return false;
  }

  return { parse: parse, hasErrors: hasErrors };
});
