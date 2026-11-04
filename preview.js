// Локальний перегляд сайту: node preview.js  →  http://localhost:3000
// Режим без Telegram: node preview.js --dry  (заявки лише друкуються в терміналі, у Telegram НЕ надсилаються)
const http = require("http");
const fs = require("fs");
const path = require("path");

// Простий читач .env (якщо файл є)
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
} catch (e) { /* .env немає — це нормально */ }

const DRY = process.argv.includes("--dry");
const PORT = Number(process.env.PORT) || 3000;

if (DRY) {
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "dry-run";
  process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "dry-run";
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      const body = JSON.parse(opts.body);
      console.log("\n[DRY-RUN] Заявка отримана, у Telegram НЕ надсилається:\n" + body.text.replace(/<[^>]+>/g, "") + "\n");
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    return realFetch(url, opts);
  };
}

const lead = require("./api/lead.js");
const config = require("./api/config.js");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };

http.createServer((req, res) => {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(b)); };
  const url = req.url.split("?")[0];

  if (url.startsWith("/api/")) {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      try { req.body = raw ? JSON.parse(raw) : undefined; } catch (e) { req.body = null; }
      (url === "/api/lead" ? lead : url === "/api/config" ? config : (q, s) => s.status(404).json({ ok: false }))(req, res);
    });
    return;
  }

  let p = decodeURIComponent(url);
  if (p === "/") p = "/index.html";
  const file = path.join(__dirname, "public", path.normalize(p));
  if (!file.startsWith(path.join(__dirname, "public"))) { res.statusCode = 403; return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("\nСайт відкрито: http://localhost:" + PORT);
  console.log(DRY ? "Режим --dry: заявки НЕ йдуть у Telegram, а друкуються тут." : "Заявки йдуть у Telegram, якщо в .env вказано TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID.");
  console.log("Зупинити: Ctrl+C\n");
});
