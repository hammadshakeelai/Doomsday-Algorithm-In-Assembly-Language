// runlog.js -- the assemble / run / exit phase machine.
//
// DosEngine hands us one flat stream of DOS stdout. That stream contains three
// different things -- NASM's diagnostics, the program's own output, and the
// echo markers the autoexec prints between commands -- and telling them apart
// is entirely a matter of where in the stream you are. This is the state that
// does the telling apart.
//
// Extracted verbatim from ide.html so both pages report a run identically; the
// only behaviour added is `file`, because ide.html could hardcode "prog.asm"
// (the name the engine writes into DOS) while a page that displays
// doomsday.asm must say doomsday.asm or its messages disagree with its gutter.

(function (global) {
  'use strict';

  function RunLog(opts) {
    opts = opts || {};
    this.file    = opts.file    || 'prog.asm';
    this.onEntry = opts.onEntry || function () {};   // (text, cssClass)
    this.onDiag  = opts.onDiag  || function () {};   // ({line, severity, message})
    this.onState = opts.onState || function () {};   // (label, cssClass)
    this.onAbort = opts.onAbort || function () {};   // assembly failed; kill the machine
    this.reset();
  }

  // Called at the start of every run -- including reruns, which is why none of
  // this lives in the constructor.
  RunLog.prototype.reset = function () {
    this.asmLines = [];
    this.phase = 'boot';
    this.t0 = (global.performance || Date).now();
  };

  RunLog.prototype.elapsed = function () {
    return (global.performance || Date).now() - this.t0;
  };

  RunLog.prototype.line = function (line) {
    if (line.indexOf(DosEngine.MARK_ASM) === 0) { this.phase = 'asm'; return; }

    if (line.indexOf(DosEngine.MARK_RUN) === 0) return this._assembled();
    if (line.indexOf(DosEngine.MARK_END) === 0) return this._finished();

    // When NASM failed, prog.com was never written and DOS complains about it.
    // That is a consequence of the real error, not news -- don't show it.
    if (this.phase === 'dead' && /Illegal command/i.test(line)) return;

    // NASM's output is collected silently and reprinted, parsed and colour-coded
    // once the assemble phase ends. Echoing it here would double every message.
    if (this.phase === 'asm') this.asmLines.push(line);
    else this.onEntry(line, '');
  };

  // NASM has finished. Everything it said is in asmLines; this is the only
  // moment at which we know whether the build succeeded.
  RunLog.prototype._assembled = function () {
    var self = this;
    var diags = NasmErrors.parse(this.asmLines.join('\n'));

    diags.forEach(function (d) {
      self.onEntry(self.file + ':' + d.line + ': ' + d.severity + ': ' + d.message,
                   d.severity === 'warning' ? 'c-warn' : 'c-err');
      self.onDiag(d);
    });

    if (NasmErrors.hasErrors(diags)) {
      this.onEntry('assembly failed -- program not run', 'c-err');
      this.onState('assembly failed', 'error');
      this.phase = 'dead';
      this.onAbort();
      return;
    }

    this.onEntry('assembled ok (' + Math.round(this.elapsed()) + ' ms)', 'c-ok');
    this.phase = 'run';
  };

  RunLog.prototype._finished = function () {
    if (this.phase === 'dead') return;          // already reported the real cause
    this.onEntry('[' + (this.elapsed() / 1000).toFixed(3) + 's] program exited', 'c-dim');
    this.onState('done', '');
    this.phase = 'done';
  };

  global.RunLog = RunLog;
})(window);
