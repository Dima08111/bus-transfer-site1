// Перевірка Telegram: node check-telegram.js  (після заповнення .env)
const fs=require('fs');
try{fs.readFileSync('.env','utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];});}catch{}
const T=process.env.TELEGRAM_BOT_TOKEN,C=process.env.TELEGRAM_CHAT_ID;
(async()=>{
 if(!T||T.includes('НОВИЙ')||!C||C.includes('ВАШОЇ')) return console.log('❌ Заповніть TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID у файлі .env');
 const me=await (await fetch(`https://api.telegram.org/bot${T}/getMe`)).json();
 if(!me.ok) return console.log('❌ Токен невірний:',me.description);
 console.log('✅ Бот знайдено: @'+me.result.username);
 const r=await (await fetch(`https://api.telegram.org/bot${T}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:C,text:'✅ Перевірка зв’язку: сайт підключено до Telegram.'})})).json();
 console.log(r.ok?'✅ Тестове повідомлення надіслано в групу':'❌ Не вдалося написати в групу: '+r.description+'\n   Додайте бота в групу, дайте право писати, перевірте Chat ID (має починатися з -100).');
})().catch(e=>console.log('❌ Немає зв’язку з Telegram:',e.message));
