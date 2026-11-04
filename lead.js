// Серверна функція приймання заявок (Vercel Serverless Function).
// Токен Telegram береться ТІЛЬКИ зі змінних середовища сервера.

const DATA = require("../public/data.js");

const MAX_PER_WINDOW = 5; // заявок з однієї IP
const WINDOW_MS = 10 * 60 * 1000; // за 10 хвилин
const hits = new Map(); // проста пам'ять (best-effort у serverless)

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  return (xf ? String(xf).split(",")[0].trim() : req.socket && req.socket.remoteAddress) || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clean(v, max) {
  return String(v == null ? "" : v)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function validate(body) {
  const b = body || {};
  const d = {
    name: clean(b.name, 80),
    phone: clean(b.phone, 25),
    fromCountry: clean(b.fromCountry, 60),
    fromCity: clean(b.fromCity, 80),
    toCountry: clean(b.toCountry, 60),
    toCity: clean(b.toCity, 80),
    date: clean(b.date, 10),
    passengers: parseInt(b.passengers, 10)
  };

  if (b.consent !== true) return { error: "Потрібна згода на обробку персональних даних." };
  if (d.name.length < 2) return { error: "Вкажіть ім'я." };
  const digits = d.phone.replace(/\D/g, "");
  if (!/^[+\d][\d\s()\-+]*$/.test(d.phone) || digits.length < 9 || digits.length > 15)
    return { error: "Вкажіть коректний номер телефону." };
  if (!d.fromCity || !d.toCity) return { error: "Вкажіть міста відправлення та прибуття." };

  const UA = DATA.UA_COUNTRY;
  const fromUA = d.fromCountry === UA;
  const toUA = d.toCountry === UA;
  if (fromUA === toUA) return { error: "Дозволені маршрути лише Україна — Європа та Європа — Україна." };
  const other = fromUA ? d.toCountry : d.fromCountry;
  if (!Object.prototype.hasOwnProperty.call(DATA.EU, other)) return { error: "Невідома країна." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { error: "Вкажіть дату поїздки." };
  const dt = new Date(d.date + "T00:00:00Z");
  if (isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== d.date) return { error: "Некоректна дата." };
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 24 * 3600 * 1000; // запас на часові пояси
  if (dt.getTime() < todayUtc) return { error: "Дата поїздки не може бути в минулому." };
  if (dt.getTime() > todayUtc + 400 * 24 * 3600 * 1000) return { error: "Дата занадто далека." };

  if (!(d.passengers >= 1 && d.passengers <= 10)) return { error: "Кількість пасажирів — від 1 до 10." };
  return { data: d };
}

function buildMessage(d) {
  const [y, m, day] = d.date.split("-");
  return [
    "🚍 <b>НОВА ЗАЯВКА НА ПЕРЕВЕЗЕННЯ</b>",
    "",
    "👤 Ім'я: " + esc(d.name),
    "📞 Телефон: " + esc(d.phone),
    "",
    "📍 <b>ЗВІДКИ:</b>",
    "Країна: " + esc(d.fromCountry),
    "Місто: " + esc(d.fromCity),
    "",
    "🏁 <b>КУДИ:</b>",
    "Країна: " + esc(d.toCountry),
    "Місто: " + esc(d.toCity),
    "",
    "📅 Дата поїздки: " + day + "." + m + "." + y,
    "👥 Пасажирів: " + d.passengers,
    "",
    "🌐 Джерело: Сайт"
  ].join("\n");
}

async function sendToTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не налаштовані");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: ctrl.signal
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !json || json.ok !== true) {
      throw new Error("Telegram API: " + res.status + " " + (json && json.description ? json.description : ""));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin && req.headers.origin !== allowed) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "Некоректний запит." });

  // Антиспам: honeypot та перевірка часу заповнення форми.
  if (body.website) return res.status(200).json({ ok: true }); // бот: імітуємо успіх, нічого не надсилаємо
  const elapsed = Number(body.elapsed);
  if (!(elapsed >= 3000)) return res.status(400).json({ ok: false, error: "Спробуйте ще раз." });

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ ok: false, error: "Забагато спроб. Спробуйте пізніше або зателефонуйте." });
  }

  const v = validate(body);
  if (v.error) return res.status(400).json({ ok: false, error: v.error });

  try {
    await sendToTelegram(buildMessage(v.data));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Lead delivery failed:", err && err.message);
    return res.status(502).json({ ok: false, error: "delivery_failed" });
  }
};

module.exports._internal = { validate, buildMessage };
