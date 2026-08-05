import fs from "node:fs";

const raw = fs.readFileSync("kernel/kernel.eot", "utf8");
const blocks = raw.split(/^# -{10,}\n/m).map((b) => b.trim()).filter(Boolean);

let triplesOut = [];
let annotationsOut = ["# Kernel annotations", "", "The reasoning behind each act in `kernel/kernel.eot`, extracted so the", "kernel file itself stays pure notation. Indexed by subject.", ""];

for (const block of blocks) {
  const lines = block.split("\n");
  const commentLines = [];
  const tripleLines = [];
  for (const line of lines) {
    if (line.startsWith("#")) commentLines.push(line.replace(/^#\s?/, ""));
    else if (line.trim()) tripleLines.push(line);
  }
  if (tripleLines.length === 0) continue; // the file-level header block

  const subjectMatch = tripleLines[0].match(/^:(\S+)/);
  const subject = subjectMatch ? subjectMatch[1] : "unknown";
  annotationsOut.push(`## ${subject}`, "", commentLines.join("\n").trim(), "");
  triplesOut.push(tripleLines.join("\n"));
}

fs.writeFileSync("kernel/kernel.eot", triplesOut.join("\n\n") + "\n");
fs.writeFileSync("kernel/ANNOTATIONS.md", annotationsOut.join("\n"));
console.log("blocks processed:", triplesOut.length);
