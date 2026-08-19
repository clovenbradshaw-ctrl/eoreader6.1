import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2]) || 8830;
const ROOT = dirname(fileURLToPath(import.meta.url));

createServer((req, res) => {
  const path = req.url === "/" ? "/dictionary-definitions.html" : req.url;
  const file = join(ROOT, decodeURIComponent(path.split("?")[0]));
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  const ext = file.split(".").pop();
  const type = { html: "text/html", json: "application/json", js: "text/javascript" }[ext] || "text/plain";
  res.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
