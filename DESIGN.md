# Doomsday in 8086 Assembly — design notes

Written 2026-08-25, before any code. This is the plan, not documentation of
something that exists.

## What this is

Two things in one repo:

1. **The project** — Conway's Doomsday algorithm written from scratch in 8086
   assembly, the third time this algorithm has been implemented here (C++ came
   first, in the sibling `Doomsday/` repo).
2. **The tool** — a browser IDE, static on GitHub Pages, that assembles and runs
   that code without opening DOSBox.

The tool exists because the edit → DOSBox → assemble → run → read → edit loop
breaks concentration. Everything below serves shortening that loop.

## Decisions

| Decision | Chosen | Why |
|---|---|---|
| Syntax | **NASM** | BSD-2, so the assembler can be committed. MASM/TASM binaries are proprietary — shipping them from a public repo is a genuine DMCA risk. Output is flat `.COM`: `org 100h`, `nasm -f bin`. |
| Engine | **NASM running inside js-dos** (DOSBox → WebAssembly) | Needs only prebuilt binaries. Compiling NASM to WASM directly would need emsdk, which is not installed on this machine — the same wall the C++ repo documents. Also highest fidelity: what passes here passes in real DOSBox. |
| Hosting | **GitHub Pages, `docs/`** | No server, no build step, no package manager. Matches the sibling repo's zero-tooling style. |
| Scope | **Phase 1 = edit/run/see output** | The stepper is Phase 2. Ship the thing that saves time first. |
| Terminal prompt | **Honest DOS `C:\>`** | DOS is genuinely what runs. A faked bash prompt would be a costume that can disagree with reality. |
| Visual design | **Reuse the C++ site's VS Code skin** | `--bg`, `--arch`, `--mono`, the chrome and the type are already built and phone-tested. **The breakpoint *behaviour* is not reusable — see below.** |

## Responsive behaviour is NOT inherited

The sibling repo's terminal page does `.vsc-editor { display: none }` at 760px —
it **deletes the editor pane** on tablets and phones. That was right there,
because the editor was decorative hardcoded markup.

Here the editor is the entire point, so that rule is exactly backwards. Inheriting
the skin must not mean inheriting this.

Instead, at ≤760px: a **two-tab toggle — `CODE` | `TERMINAL`** — giving whichever
pane you are using the full screen height. Both panes stay reachable; neither is
destroyed. This also suits the actual phone workflow, which alternates between
typing code and typing input rather than watching both at once.

Keep from the sibling repo: the `dvh` units (plain `vh` on iOS assumes a collapsed
URL bar and pushes controls off-screen) and the on-screen key affordances that let
the page work without a physical keyboard.

## The I/O constraint that shapes everything

The assembly uses `int 21h` in **both directions** — `AH=09h`/`02h` to print,
`AH=0Ah`/`01h` to read. The Doomsday program prompts for year, month, and day
and reads them back.

So the terminal pane is **an interactive terminal, not an output log**.
Keystrokes must reach the emulated DOS keyboard buffer, and backspace must work
(`AH=0Ah` does line editing).

This is also the strongest argument for js-dos over a hand-written JS emulator:
DOSBox implements `AH=0Ah` correctly, including the max-length byte and the
terminating CR. Reimplementing that subtly wrong would corrupt input parsing in
ways that look like a bug in the assembly.

## Structure

```
Doomsday-Algorithm-In-Assembly-Language/
├── docs/                    the Pages site — everything served lives here
│   ├── index.html           explanation of the algorithm
│   ├── ide.html             the IDE
│   ├── asm/                 the .asm files — the actual project
│   │   ├── doomsday.asm
│   │   └── attempts/
│   ├── css/  js/
│   └── vendor/              prebuilt js-dos + editor + the DOS bundle
├── tools/make-bundle.sh     reproducible build of the DOS image
└── Doomsday/                ignored — the C++ repo, living here locally only
```

**Why `.asm` lives under `docs/` and not `src/`:** GitHub Pages serves only the
`docs/` folder. If the source sat in `src/`, the IDE could not `fetch()` your own
program to load it as an example — which is what makes the page a showcase and
not just a scratchpad. Putting it under `docs/` keeps **one** source of truth with
no copy step and no build tooling, and has the side benefit that the raw source is
directly viewable on the web.

The sibling C++ repo dodged this problem by making its editor pane fake. This one
cannot.

## Modules

One module knows about DOSBox. Nothing else does. That boundary is what lets a
WASM NASM be swapped in later without touching the UI.

| Module | Job | Depends on |
|---|---|---|
| `dosengine.js` | `boot()` · `build(src)` · `run()` · `sendInput()` · `reset()` | js-dos only |
| `editor.js` | editor, NASM highlighting, gutter error markers | nothing else |
| `nasm-errors.js` | parse `prog.asm:12: error: …` → `{line, severity, msg}` | pure function, no DOM |
| `ide.js` | state machine: idle → building → running → waiting-input → done | the other three |

`nasm-errors.js` is deliberately pure — it is what puts an error on the *right
line*, and it is the only piece testable without a browser (`node -e`, matching
the sibling repo's style).

## Flow

```
type → editor ──Run──▶ dosengine.build()
                          │ writes PROG.ASM into the DOS filesystem, runs NASM
                          ▼
                     stderr → nasm-errors.js → gutter markers ──▶ STOP if failed
                          │ ok
                          ▼
                     dosengine.run() executes PROG.COM
                          │ character stream ──▶ terminal pane
                     keystrokes ──▶ int 21h AH=01h / AH=0Ah
                          ▼
                     exit (AH=4Ch) → show exit code + elapsed ms
```

The elapsed-time and exit-code readout mirrors the real shell prompt decoration
(`[0.013s] --> [0]`).

**Verified 2026-08-25 — the session stays warm.** js-dos v8's `CommandInterface`
exposes `fsWriteFile`, `fsReadFile` and `sendKeyEvent` on an **already-running**
instance (js-dos.com/command-interface.html). So DOSBox boots once at page load
and each Run is a file write plus injected keystrokes — not a reboot. This was
the single assumption the whole "fast loop" claim rested on.

Note that dosplay's URL parameters (`content`, `bc`, `run_cmd`) are its *sharing*
mechanism, not its run mechanism — do not read them as evidence of boot-per-run.

Convenient consequence: keystroke injection is also exactly what `int 21h` input
needs. One mechanism drives both the command line and the program's own prompts.

## Error handling

- **Infinite loop** — Stop button kills the DOS process; a watchdog offers to
  stop after ~10s. Infinite loops will happen; they must not require a reload.
- **Crashed DOS** — `reset()` reboots the session in place.
- **Stale bundle** — js-dos caches its bundle. Version the bundle *filename*.
  The sibling repo was already bitten by committed build output going stale
  silently; do not repeat it.
- **Boot failure** — a real message plus fallback instructions, never a dead
  spinner.

## Risks

**The one that blocks: DPMI.** (The warm-session question that used to sit
alongside it is now resolved — see Flow.)

 NASM's DOS build is a DJGPP 32-bit program and
needs a DPMI host (`cwsdpmi.exe`). That combination is documented under desktop
DOSBox but is **unverified under js-dos's WebAssembly build**. Spike this before
any UI work.

*Fallback A:* NASM 0.98.39 rebuilt as a pure 16-bit host binary, which needs no
DPMI at all. Older NASM, but more than sufficient for 8086. **Caveat: this came
from a forum thread describing someone performing that rebuild. Confirm a
downloadable artifact actually exists before relying on it** — otherwise DPMI is
a single point of failure.

*Fallback B:* Approach 2 — compile NASM to WASM and assemble natively, using
js-dos only to execute the finished `.COM`. DESIGN.md rejected this because
"emsdk is not installed", but that phrase was **imported from the sibling repo's
CLAUDE.md and is an observation about a different project, not a law**. Installing
emsdk on Windows is a clone plus one command. If the DPMI spike fails, this
fallback is much cheaper than the original framing suggests. Do not rule it out
on stale grounds.

**Licensing.** DOSBox is GPL-2.0 — shipping js-dos requires a LICENSE/NOTICE.
Cheap, but must not be forgotten.

## Non-goals for Phase 1

- No typing animation. That is showcase flair from the C++ page and is actively
  wrong for a tool where output should appear the instant it exists.
- No game page, no achievements, no leaderboard.
- No register/flag stepper — Phase 2.
- No date library, no framework, no bundler.

## Phase 2 sketch

Single-step execution showing AX/BX/CX/DX, SI/DI/SP/BP, and flags. Likely a JS
8086 emulator rather than DOSBox, which is a black box for stepping. Reading
input mid-step is the awkward part — possibly solved by pre-supplying input
before stepping begins. Must be labeled clearly as an approximation, distinct
from the Run tab's real DOS.

## Prior art

- **js-dos** — DOSBox/DOSBox-X compiled to WASM. Free, no account, fully static.
- **dosplay** (`dosasm.github.io/dosplay`) — this exact architecture, already
  live on GitHub Pages. Ships MASM/TASM, which is why it is a reference and not
  a fork target.
- **TweetX86** (`twt86.co`) — NASM ported to WASM. The upgrade path if the
  in-DOS assemble ever feels slow.
- **v86** — boots FreeDOS in the browser. Considered and rejected as overkill.
- **JWasm / UASM / ASMC** — open-source MASM-syntax assemblers. The escape hatch
  had MASM syntax been required; irrelevant now.

---

# Spike results (2026-08-25)

The spike ran. **The architecture holds.** Findings below are from experiment,
not documentation -- several contradict what the docs implied.

## Resolved: DPMI is not a problem

`nasm.exe` from NASM's official DOS release is a DJGPP `go32stub v2.05T`
binary; its own error strings include "no DPMI - Get csdpmi*b.zip". It runs
correctly under js-dos with `cwsdpmi.exe` present.

**`cwsdpmi.exe` ships inside NASM's own DOS zip**, so it is not a separate
dependency at all.

Assembling `docs/asm/smoke.asm` in the browser produced a 133-byte `SMOKE.COM`
-- byte-identical in size to the same file assembled by native NASM 2.16.03 on
Windows.

## Timings

Measured with markers between every autoexec command:

| Step | Time |
| --- | --- |
| DOSBox boot to shell | ~0.40 s |
| NASM starts (first invocation) | ~0.05 s |
| Assemble smoke.asm | ~0.01 s |
| **Boot to assembled, total** | **~0.5 s** |

**These numbers are provisional.** They come from one instrumented run. Every
measurement taken through `ide.html` clustered instead around 3.9-4.0 s
(3968, 3970, 3965, 3946, 3930 ms). That clustering is consistent with the
requestAnimationFrame throttling of an automated, non-visible tab -- but it is
not proven. **Re-measure in a normal visible browser before trusting 0.5 s.**

If boot-per-run really costs ~4 s, the warm-session question reopens and the
in-place `fsWriteFile` route is worth revisiting. If it is ~0.5 s, boot-per-run
is comfortably good enough and has the nicer property that no state leaks
between runs.

## Traps found (all now encoded in dosengine.js)

1. **A custom `dosboxConf` replaces js-dos's default wholesale**, including its
   `mount c .` and `c:` lines. Without re-adding them every command fails with
   "Illegal command". This cost the first hour.

2. **Never shell-redirect a DJGPP program.** `nasm ... > out.txt` wedges the
   emulator indefinitely, and `nasm -h > nul` prints anyway -- DJGPP binaries
   bypass DOS redirection entirely.

3. **NASM's diagnostics go to stderr, and DOSBox does not pipe stderr into
   `onStdout`.** Errors reached the screen and nowhere else, so the page
   cheerfully reported "assembled ok" for a build that had failed. **The fix is
   NASM's `-s` flag**, which redirects diagnostics to stdout. This was a real
   bug caught only by deliberately feeding the page broken assembly -- the
   happy path looked perfect throughout.

4. **js-dos key codes are not JS key codes.** Enter is 257, not 13. Digits and
   letters happen to coincide with ASCII, which makes the discrepancy easy to
   miss until Enter silently does nothing.

5. **`pathPrefix` defaults to js-dos's public CDN.** It must be pinned local or
   the "fully static" property is quietly false.

6. **js-dos drives the emulator from requestAnimationFrame**, so a hidden or
   backgrounded tab stops the machine dead. Expected behaviour, but it looks
   exactly like a hang.

7. **js-dos cannot be re-initialised twice in the same document.** The second
   `Dos()` call boots to nothing -- status sticks at "booting" and no
   `ci-ready` ever arrives. Awaiting `ci.exit()`, calling the `stop()` on the
   object `Dos()` returns, and handing it a brand-new container element all
   failed to help; the state js-dos keeps is module-level, not DOM-level.

   **The fix is `docs/runner.html`**: every Run creates a fresh `<iframe>`,
   which is a fresh JS realm, and discards it afterwards. The parent talks to
   it over `postMessage`. TweetX86 reached the same conclusion for the same
   reason. This matters more than it sounds -- edit/Run/edit/Run *is* the
   product, and it was broken until this was found.

## Better than planned: output capture

`onStdout` delivers the DOS screen as **text**, including output from the
user's own program via `int 21h` AH=09h. There is no need to read the
framebuffer or OCR anything. The original plan of redirecting output to a file
and reading it back with `fsReadFile` is unnecessary -- and would have hit
trap 2 anyway.

## Verified after the first write-up

**Run-twice, and run-after-failure.** Three consecutive runs in one page with
no reload: broken source (error reported on the right line, program correctly
not run), then good source (assembled, ran, printed its banner), then good
source again. This only works because of trap 7's iframe fix.

## Not verified

**Interactive keyboard input.** Everything up to and including "the program
runs and prints its banner" is confirmed. Typing into a waiting `AH=0Ah` prompt
could not be tested, because the automation harness reports the page as hidden
(`document.hidden === true`) and requestAnimationFrame is therefore suspended,
so the emulator never processes the keystrokes.

This is a limitation of the test harness, not evidence of a problem -- but it
is the one hard requirement still unconfirmed. **Verify it by hand**: open the
IDE in a normal browser, press Run, click the DOS screen, and type a year.

## Built

| Path | What |
| --- | --- |
| `docs/ide.html` | Working IDE: editor, Run/Stop, live DOS screen, console |
| `docs/js/dosengine.js` | The only module that touches js-dos |
| `docs/js/nasm-errors.js` | Pure diagnostic parser, no DOM |
| `docs/asm/smoke.asm` | Toolchain fixture: prints, prompts, reads, echoes, exits |
| `docs/vendor/` | js-dos 8.4.1 (GPL-2.0) + NASM 2.16.03 DOS (BSD-2), with NOTICE |
| `tools/test-nasm-errors.js` | `node tools/test-nasm-errors.js` -- passes |

Total vendored weight: 3.8 MB, cached after first load.

## Licensing consequence

js-dos is **GPL-2.0**. Shipping and running it means this repository's own
source should carry compatible terms. `docs/vendor/NOTICE.md` records the
attribution; a top-level LICENSE still needs to be added deliberately.

## Next

1. Verify interactive input by hand (above).
2. Replace the plain textarea with a real editor: NASM syntax highlighting,
   line numbers, and gutter markers driven by `nasm-errors.js`.
3. Apply the VS Code skin from the C++ site, with the CODE/TERMINAL tab
   toggle at 760px rather than that site's `display: none`.

---

# Verified by hand (2026-08-30)

Run from a local static server over `docs/`, in a visible browser.

## Resolved: interactive keyboard input works

This was the last item in the spike's **Not verified** list, and the one the
whole project rested on. It is now confirmed end to end:

```
Tell me Year: 2026
Tell me Month: 08
Tell me Day: 30
```

Typed digits reach the emulated keyboard, echo through `AH=01h`, land in memory,
and advance the program through all three prompts -- on the desktop layout and
again on the 375px phone layout with the on-screen keydeck. Delete the
"Not verified" caveat above; it is answered.

## Resolved: doomsday.asm assembles clean

`nasm -f bin` inside js-dos reports **zero errors and zero warnings** on all 480
lines. Boot-to-assembled measured through `doomsday.html`:

| Run | Time |
| --- | --- |
| Cold (3.8 MB vendor payload not yet cached) | ~3.3 s |
| Warm (vendor cached, fresh iframe per run) | ~1.1 s |

The spike's unexplained 3.9-4.0 s cluster is now accounted for: it was the cold
number. **N2 is met** -- boot-per-run is comfortably good enough, and the
warm-session `fsWriteFile` route stays unnecessary.

## Open: the program stalls before printing its answer

Not a page bug -- the toolchain does its job and shows exactly where it stops.
After reading the day, the program prints `msg12` (`" So on Year "`), jumps to
`aftervariables`, and never prints again. `msg13` (`" the Day of the week is "`)
and the `daytoname` table are never reached.

One thing to look at first, at `doomsday.asm:112`:

```asm
    div bl
    cmp ah,0
    jge skip        ; signed compare on an unsigned remainder
    add ah,4
skip:
```

`AH` after `div bl` is a remainder in 0..6, so `jge` is always taken and
`add ah,4` is dead code. That is a logic bug, not a hang, but it is in the first
block that runs after the last thing the program successfully prints.

## Two bugs found while testing the pages

1. **The phone layout never worked, in either stylesheet.** Both had
   `#viewtabs { display: none }` written *after* the `@media (max-width: 760px)`
   block that sets `display: flex`. Equal specificity, so the later rule won and
   the CODE/RUN toggle was permanently hidden -- including in `ide.html`, where
   it predates this work. The default is now declared before the breakpoint.

2. **A stale `.asm` was invisible.** The page both displays and assembles the
   same fetched string, so a cached copy meant quietly showing *and running*
   yesterday's program. `asm-view.js` now fetches with `cache: 'no-cache'` so the
   source revalidates. Same class of bug as the stale-bundle risk logged above.

## The error path, exercised deliberately

An undefined symbol injected at line 7 produced, correctly:

- `doomsday.asm:7: error: symbol \`nosuchlabel' not defined` -- the **display**
  filename, not the `prog.asm` that DOS knows it as
- line 7 tinted in the gutter and scrolled into view
- `1` in the status bar error count
- the program not run, and the machine torn down

This also caught a real defect: `scrollIntoView({block:'center'})` nudges the
pane horizontally as well, and a few pixels of horizontal scroll slid every line
under the sticky line-number column -- which reads as the first character of the
file having vanished. `revealFirstMark` now sets `scrollTop` by hand.

---

# The showcase page (2026-08-30)

`ide.html` is a scratchpad. It proves the toolchain, but it is a *tool*, and a
tool is a poor place to show a finished program: it opens on an empty-ish
editor, and it gives half the width to a textarea nobody visiting to see the
Doomsday program wants to type in.

So the site is now three pages with three jobs:

| Page | Job | Source it shows |
| --- | --- | --- |
| `index.html` | Intro. What the algorithm is, what is actually running, and the two routes in. | — |
| `doomsday.html` | Show the finished program running. Source **read-only**, emulator dominant, one Rerun button. | `asm/doomsday.asm` |
| `ide.html` | Write and run your own. Unchanged except for `?src=`. | `asm/smoke.asm`, or `?src=asm/*.asm` |

`Code/main.asm` moved to `docs/asm/doomsday.asm`. Pages only serves `docs/`, so
that is the only place a page can `fetch()` its own source from — the reason
DESIGN.md put `.asm` under `docs/` in the first place. There is now one copy.

## Why the DOS pane is 70% and the panel is a fixed height

Both fall out of one fact: **js-dos letterboxes a 4:3 canvas inside whatever
container it is given.** A pane that is wide and short renders a *small* screen.
"Make DOSBox bigger" therefore constrains both axes, not just width:

- `--panel-h` is a fixed `148px`, not `ide.html`'s `34%`. A percentage of a
  taller pane grows with it and eats exactly the height the canvas wanted.
- The source pane takes 30%, down from the sibling site's 38%. Almost no line in
  this program reaches 40 columns, so width spent on the left buys nothing.

## Shared, not duplicated

`doomsday.html` adds ~150 lines of its own. Everything that was already proven
is reused, and two pieces were extracted so that reuse is real rather than
copy-paste:

| Module | Job |
| --- | --- |
| `js/runlog.js` | The assemble → run → exit phase machine, lifted out of `ide.html`. Takes a display filename, because the engine calls the file `prog.asm` inside DOS while the page shows `doomsday.asm`. |
| `js/asm-view.js` | Read-only viewer: line numbers, NASM highlighting, `markLine()` for gutter markers. |
| `css/vscode.css` | The VS Code skin, ported from the sibling repo. Its dangling variables (`--text-dim`, `--mono`, `--arch-soft`) are now declared locally, and it fills the viewport instead of being a 1400px card. |

`dosengine.js`, `nasm-errors.js` and `runner.html` are used unchanged. This is
what `nasm-errors.js` being a pure function bought: the same parser now drives
two different UIs and a node test.

---

# Non-functional requirements

Written 2026-08-30, after the pages existed — these are what the thing has to be
*like*, as opposed to what it has to do.

| # | Requirement | How it is met |
| --- | --- | --- |
| N1 | **First paint must not wait on the 3.8 MB vendor payload.** | The binaries live in `runner.html`, which only exists once a run starts. The page itself is ~30 KB of HTML/CSS/JS plus the `.asm`. |
| N2 | **Boot-to-assembled stays under a few seconds.** | Boot-per-run, ~0.5 s measured in the spike. The 3.9 s figures came from a hidden automated tab and are not trusted — **re-measure in a visible browser.** |
| N3 | **An infinite loop must never require a page reload.** | Stop discards the iframe. A 45 s silence hint suggests it — deliberately a hint, not an action: a program stuck in a loop and a program waiting on `AH=01h` are indistinguishable from outside, and this one legitimately waits. |
| N4 | **A frozen emulator must never be mistaken for a crash.** | `visibilitychange` says so in the debug panel and the status bar. Trap 6 means a backgrounded tab stops DOSBox dead; without this the bug report is unanswerable. |
| N5 | **Boot failure shows a real message, never a dead spinner.** | The overlay carries the actual error text and a retry button. |
| N6 | **A failed assembly points at the line.** | `nasm-errors.js` → `markLine()` tints the row and the gutter, and the first bad line is scrolled into view. The program is not run. |
| N7 | **Diagnostics reach a screen reader.** | The debug panel is `role="log" aria-live="polite"`. |
| N8 | **Keyboard-only use must be possible.** | `:focus-visible` ring on everything; every control is a real `button`/`a`. The emulator canvas itself is a canvas — its text alternative is the debug panel, which carries the same stdout. |
| N9 | **Usable without a physical keyboard.** | The on-screen keydeck (digits, Enter, Backspace, Esc) below 760px, driving `engine.sendKey`. The program prompts for input, so this is not decoration. |
| N10 | **Usable on a phone.** | `CODE`/`RUN` tabs below 760px; both panes keep full height. Never the sibling site's `display: none` on the source — see "Responsive behaviour is NOT inherited". |
| N11 | **`prefers-reduced-motion` respected.** | Transitions collapsed to ~0. |
| N12 | **No backend, no trackers, nothing leaves the browser.** | Every asset is same-origin, including the js-dos `pathPrefix` (trap 5). Verifiable in the Network panel. |
| N13 | **Unsupported browsers say so.** | `typeof WebAssembly` check → overlay + disabled Run, with the source still readable. |
| N14 | **One module knows js-dos.** | Still only `dosengine.js`. `nasm-errors.js` stays pure and node-testable. |
| N15 | **License compliance.** | js-dos is GPL-2.0; the top-level `LICENSE` that `vendor/NOTICE.md` already pointed at now exists. |

## Two NFRs deliberately *not* implemented

Both appear on any web-security checklist. Both break the emulator, so they are
recorded here to stop a future pass from "fixing" their absence.

- **`sandbox` on the run iframe.** `runner.html` needs same-origin `fetch` for
  the vendor binaries and `postMessage` back to the parent, which requires
  `allow-same-origin allow-scripts` — a combination the HTML spec itself notes
  is equivalent to no sandbox at all. It would be a no-op that reads as a
  control.
- **A CSP `<meta>` tag.** js-dos compiles WebAssembly and may spawn `blob:`
  workers. A naive `default-src 'self'` kills the emulator outright, and a
  policy loose enough to permit `wasm-unsafe-eval` and `blob:` workers buys
  little on a page that loads nothing off-origin anyway (N12).

The honest security property here is N12: there is no server, no user data, and
no third-party origin. That is worth more than either of the above.
