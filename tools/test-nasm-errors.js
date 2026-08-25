// Spot-check for the NASM diagnostic parser.
//   node tools/test-nasm-errors.js
const N = require('../docs/js/nasm-errors.js');

const sample = [
  "c:/prog.asm:12: error: symbol `foo' undefined",
  "prog.asm:7: warning: label alone on a line without a colon might be in error",
  "prog.asm:99: fatal: unable to open input file",
  "NASM version 2.16.03 compiled on Apr 17 2024",
  "",
].join("\n");

const got = N.parse(sample);
console.log(JSON.stringify(got, null, 1));
console.log("hasErrors:", N.hasErrors(got));

const ok =
  got.length === 3 &&
  got[0].line === 12 && got[0].severity === "error" &&
  got[1].line === 7 && got[1].severity === "warning" &&
  got[2].line === 99 && got[2].severity === "error" &&
  N.hasErrors(got) === true;

console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
