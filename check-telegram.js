// Перевірка Telegram: node check-telegram.js
// 1) Скопіюйте .env.example у .env і впишіть TELEGRAM_BOT_TOKEN (спочатку достатньо лише його).
// 2) Додайте бота в групу, напишіть у групі повідомлення і запустіть скрипт: він покаже ID групи.
// 3) Впишіть TELEGRAM_CHAT_ID у .env і запустіть ще раз: у групу прийде тестове повідомлення.
const fs = require("fs"), path = require("path");
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !l.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  });
} catch (e) { /* .env немає */ }

const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
const api = (method, body) =>
  fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {})
  }).then((r) => r.json().catch(() => ({ ok: false, description: "некоректна відповідь" })));

(async () => {
  if (!token) return console.log("✗ Немає TELEGRAM_BOT_TOKEN. Створіть файл .env (копія .env.example) і впишіть токен від @BotFather.");
  let me;
  try { me = await api("getMe"); } catch (e) { return console.log("✗ Немає зв'язку з Telegram (" + e.message + "). Перевірте інтернет."); }
  if (!me.ok) return console.log("✗ Токен не підходить: " + me.description + ". Скопіюйте токен із @BotFather ще раз, без пробілів.");
  console.log("✓ Токен робочий. Бот: @" + me.result.username);

  if (!chatId) {
    const u = await api("getUpdates");
    const chats = new Map();
    ((u.ok && u.result) || []).forEach((x) => {
      const c = (x.message || x.channel_post || x.my_chat_member || {}).chat;
      if (c) chats.set(c.id, c.title || c.username || c.first_name || "");
    });
    if (!chats.size) return console.log("• TELEGRAM_CHAT_ID ще не вказано, і бот поки не бачить жодного чату.\n  Додайте бота в групу, напишіть там будь-яке повідомлення й запустіть скрипт ще раз.\n  (Якщо не допомагає: у @BotFather виконайте /setprivacy → ваш бот → Disable.)");
    console.log("• Знайдені чати (потрібен ID вашої групи, зазвичай від'ємний і починається з -100):");
    chats.forEach((name, id) => console.log("    " + id + "   " + name));
    return console.log("  Впишіть потрібний ID у .env як TELEGRAM_CHAT_ID і запустіть скрипт ще раз.");
  }

  const r = await api("sendMessage", { chat_id: chatId, text: "✅ Тест: бот підключено. Заявки з сайту надходитимуть сюди." });
  if (r.ok) return console.log("✓ Тестове повідомлення надіслано в чат " + chatId + ". Перевірте групу в Telegram.");
  let hint = "";
  if (/chat not found/i.test(r.description)) hint = " → неправильний TELEGRAM_CHAT_ID або бота не додано в групу.";
  else if (/not enough rights|forbidden/i.test(r.description)) hint = " → боту заборонено писати в групі: додайте його в групу (за потреби зробіть адміністратором).";
  else if (/upgraded to a supergroup/i.test(r.description)) hint = " → група стала супергрупою, її ID змінився: запустіть скрипт без TELEGRAM_CHAT_ID і візьміть новий.";
  console.log("✗ Telegram відмовив: " + r.description + hint);
})();
