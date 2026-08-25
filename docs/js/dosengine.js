// dosengine.js -- the only module that knows js-dos exists.
//
// Everything here was established by experiment, not from documentation.
// See DESIGN.md "Spike results". The traps, in the order they bit:
//
//   1. Supplying a custom `dosboxConf` replaces js-dos's default wholesale,
//      including its "mount c ." / "c:" lines. Without re-adding them, every
//      command fails with "Illegal command".
//   2. NEVER shell-redirect a DJGPP program. "nasm ... > out.txt" wedges the
//      emulator indefinitely, and "nasm -h > nul" prints anyway -- DJGPP
//      binaries bypass DOS redirection entirely.
//   3. NASM's diagnostics go to stderr, which DOSBox does NOT pipe into
//      onStdout. Without NASM's `-s` flag they reach the screen and nowhere
//      else, and a failed build reports itself as successful.
//   4. js-dos key codes are not JS keyCodes. Enter is 257, not 13.
//   5. `pathPrefix` defaults to js-dos's public CDN; pinning it local is what
//      makes this site actually self-contained.
//   6. js-dos drives the emulator from requestAnimationFrame, so a hidden or
//      backgrounded tab stops the machine dead. Expected, but looks like a hang.
//   7. js-dos cannot be re-initialised twice in one document -- the second
//      Dos() boots to nothing. Hence runner.html: every run gets a fresh
//      iframe, which is discarded afterwards.

(function (global) {
  'use strict';

  var KBD = { enter: 257, backspace: 259, esc: 256, space: 32, tab: 258 };
  for (var d = 0; d <= 9; d++) KBD[String(d)] = 48 + d;
  for (var c = 0; c < 26; c++) KBD[String.fromCharCode(97 + c)] = 65 + c;

  function DosEngine(opts) {
    this.host = opts.element;              // container the iframe lives in
    this.runnerUrl = opts.runnerUrl || 'runner.html';
    this.onLine = opts.onLine || function () {};
    this.onStatus = opts.onStatus || function () {};
    this.frame = null;
    this.gen = 0;

    var self = this;
    global.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || d.__ddasm !== true) return;
      if (!self.frame || ev.source !== self.frame.contentWindow) return;  // stale run
      if (d.type === 'status') {
        self.onStatus(d.status === 'error' ? 'error: ' + d.message : d.status);
      } else if (d.type === 'line') {
        DosEngine.raw.push(d.line);
        if (!d.line) return;
        if (DosEngine.BANNER.test(d.line)) return;
        self.onLine(d.line);
      }
    });
  }

  DosEngine.prototype._commands = function () {
    return [
      '@echo off',
      'echo ' + DosEngine.MARK_ASM,
      // -s puts NASM's diagnostics on stdout; no shell redirection (trap 2).
      'nasm prog.asm -f bin -o prog.com -s',
      'echo ' + DosEngine.MARK_RUN,
      'prog.com',
      'echo ' + DosEngine.MARK_END,
    ];
  };

  // Assemble and run. Each call discards the previous machine entirely and
  // builds a new one in a fresh iframe -- no state survives between runs.
  DosEngine.prototype.run = function (source) {
    var self = this;
    var gen = ++this.gen;
    DosEngine.raw = [];

    this._destroyFrame();
    this.onStatus('loading');

    return new Promise(function (resolve, reject) {
      var frame = document.createElement('iframe');
      frame.setAttribute('title', 'DOS');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#000';
      frame.src = self.runnerUrl;

      var settled = false;
      function onReady(ev) {
        if (settled) return;
        var d = ev.data;
        if (!d || d.__ddasm !== true || d.type !== 'ready') return;
        if (ev.source !== frame.contentWindow) return;
        settled = true;
        global.removeEventListener('message', onReady);
        if (gen !== self.gen) return;          // superseded while loading
        frame.contentWindow.postMessage(
          { type: 'run', source: source, cmds: self._commands() }, '*');
        resolve();
      }
      global.addEventListener('message', onReady);

      frame.onerror = function () {
        global.removeEventListener('message', onReady);
        reject(new Error('could not load ' + self.runnerUrl));
      };

      self.frame = frame;
      self.host.appendChild(frame);
    });
  };

  DosEngine.prototype._destroyFrame = function () {
    if (this.frame && this.frame.parentNode) this.frame.parentNode.removeChild(this.frame);
    this.frame = null;
  };

  DosEngine.prototype.stop = function () {
    this.gen++;                  // orphan anything still in flight
    this._destroyFrame();
    this.onStatus('stopped');
  };

  DosEngine.prototype.sendKey = function (code) {
    var w = this.frame && this.frame.contentWindow;
    if (w && w.CI) w.CI.simulateKeyPress(code);
  };

  // Type a string then Enter. Keys need a gap or DOS's keyboard buffer
  // drops them.
  DosEngine.prototype.typeLine = function (text, gapMs) {
    var self = this, i = 0, gap = gapMs || 90;
    return new Promise(function (done) {
      (function next() {
        if (i >= text.length) { self.sendKey(KBD.enter); return done(); }
        var ch = text[i++];
        var k = (ch === '\n' || ch === '\r') ? KBD.enter : KBD[ch.toLowerCase()];
        if (typeof k === 'number') self.sendKey(k);
        setTimeout(next, gap);
      })();
    });
  };

  // Unfiltered stdout for debugging; onLine sees the filtered stream.
  DosEngine.raw = [];

  DosEngine.MARK_ASM = 'DDASM-ASSEMBLE';
  DosEngine.MARK_RUN = 'DDASM-RUN';
  DosEngine.MARK_END = 'DDASM-END';
  DosEngine.BANNER =
    /DOSBox|INTRO|HELP|ctrl-F|README|HAVE FUN|dosbox\.com|BLASTER|^[A-Z]:\\>|Drive C is mounted/;
  DosEngine.KBD = KBD;

  global.DosEngine = DosEngine;
})(window);
