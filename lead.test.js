// Тести серверної функції з імітацією Telegram API (реальний Telegram звідси недоступний).
const assert = require("assert");
process.env.TELEGRAM_BOT_TOKEN = "123:TEST";
process.env.TELEGRAM_CHAT_ID = "-100999";
const handler = require("../api/lead.js");

function mockRes() {
  return { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
const future = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const good = () => ({ name: "Іван <b>", phone: "+380 97 509 87 10", fromCountry: "Україна", fromCity: "Дніпро", toCountry: "Польща", toCity: "Краків", date: future, passengers: 3, consent: true, website: "", elapsed: 8000 });
let ip = 0;
const call = async (body, method = "POST") => { const res = mockRes(); await handler({ method, headers: { "x-forwarded-for": "10.0.0." + (++ip) }, body }, res); return res; };

(async () => {
  const origFetch = global.fetch;
  let sent = null;

  // 1. Успіх: Telegram відповідає ok
  global.fetch = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  let r = await call(good());
  assert.strictEqual(r.code, 200); assert.strictEqual(r.body.ok, true);
  assert.ok(sent.url.startsWith("https://api.telegram.org/bot123:TEST/sendMessage"));
  assert.strictEqual(sent.body.chat_id, "-100999");
  assert.ok(sent.body.text.includes("НОВА ЗАЯВКА НА ПЕРЕВЕЗЕННЯ"));
  assert.ok(sent.body.text.includes("Іван &lt;b&gt;"), "HTML екранується");
  assert.ok(sent.body.text.includes("Дата поїздки: " + future.split("-").reverse().join(".")));
  assert.ok(sent.body.text.includes("Джерело: Сайт"));

  // 2. Telegram повертає помилку -> 502, без фальшивого успіху
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, description: "Unauthorized" }) });
  r = await call(good()); assert.strictEqual(r.code, 502); assert.notStrictEqual(r.body.ok, true);

  // 3. Telegram недоступний (мережева помилка)
  global.fetch = async () => { throw new Error("ECONNRESET"); };
  r = await call(good()); assert.strictEqual(r.code, 502);

  // 4. HTTP 200, але ok:false
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) });
  r = await call(good()); assert.strictEqual(r.code, 502);

  // 5. Валідація: fetch не має викликатись
  let called = 0; global.fetch = async () => { called++; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const bads = [
    { ...good(), fromCountry: "Польща", toCountry: "Німеччина" },  // Європа — Європа
    { ...good(), toCountry: "Україна" },                            // Україна — Україна
    { ...good(), toCountry: "Марс" },
    { ...good(), consent: false },
    { ...good(), phone: "12" },
    { ...good(), name: "" },
    { ...good(), passengers: 11 },
    { ...good(), date: "2020-01-01" },
    { ...good(), toCity: "" },
    { ...good(), elapsed: 500 }
  ];
  for (const b of bads) { r = await call(b); assert.strictEqual(r.code, 400, JSON.stringify(b)); }
  assert.strictEqual(called, 0);

  // 6. Honeypot: нічого не надсилається
  r = await call({ ...good(), website: "http://spam" }); assert.strictEqual(r.code, 200); assert.strictEqual(called, 0);

  // 7. Європа -> Україна дозволено
  r = await call({ ...good(), fromCountry: "Німеччина", fromCity: "Берлін", toCountry: "Україна", toCity: "Київ" }); assert.strictEqual(r.code, 200); assert.strictEqual(called, 1);

  // 8. Метод GET заборонено
  r = await call(null, "GET"); assert.strictEqual(r.code, 405);

  // 9. Немає змінних середовища -> 502, не успіх
  delete process.env.TELEGRAM_BOT_TOKEN; global.fetch = origFetch;
  r = await call(good()); assert.strictEqual(r.code, 502);
  process.env.TELEGRAM_BOT_TOKEN = "123:TEST";

  // 10. Rate limit: один IP
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
  const same = async () => { const res = mockRes(); await handler({ method: "POST", headers: { "x-forwarded-for": "9.9.9.9" }, body: good() }, res); return res.code; };
  const codes = []; for (let i = 0; i < 7; i++) codes.push(await same());
  assert.deepStrictEqual(codes, [200, 200, 200, 200, 200, 429, 429]);

  console.log("OK: усі серверні тести пройдено");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
