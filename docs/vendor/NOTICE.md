# Third-party components

This folder contains unmodified redistributions of third-party software.

## js-dos 8.4.1 — `js-dos/`
DOSBox compiled to WebAssembly. **GPL-2.0.**
https://github.com/caiiiycuk/js-dos

Because js-dos is GPL-2.0 and this site ships and runs it, the site's own
source is distributed under compatible terms. See the repository LICENSE.

## NASM 2.16.03 (DOS build) — `dos/nasm.exe`, `dos/cwsdpmi.exe`
The Netwide Assembler. **BSD-2-Clause.**
https://www.nasm.us/

`nasm.exe` is the DJGPP build and is a 32-bit protected-mode program; it
requires `cwsdpmi.exe` (CWSDPMI, a DPMI host) to be present in the same
directory. CWSDPMI ships inside NASM's own DOS release archive.
Both files are byte-for-byte as published by their upstreams.
