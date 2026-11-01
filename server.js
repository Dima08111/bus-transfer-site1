// Без зовнішніх залежностей. Node 18+. Запуск: node server.js
const http = require('http'), fs = require('fs'), path = require('path');
try { fs.readFileSync('.env','utf8').split('\n').forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2];}); } catch {}
const TOKEN=process.env.TELEGRAM_BOT_TOKEN, CHAT=process.env.TELEGRAM_CHAT_ID, PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,'data'), LOG=path.join(DATA,'leads.jsonl'), PEND=path.join(DATA,'pending.json');
fs.mkdirSync(DATA,{recursive:true});
let pending=[]; try{pending=JSON.parse(fs.readFileSync(PEND,'utf8'))}catch{}
const savePend=()=>fs.writeFileSync(PEND,JSON.stringify(pending));
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const clean=(s,n)=>String(s||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);

function format(l){
  return `🚌 <b>НОВА ЗАЯВКА НА КВИТОК</b>\n\n📍 Звідки: ${esc(l.from)}\n📍 Куди: ${esc(l.to)}\n\n📅 Дата виїзду: ${esc(l.date)}\n👥 Кількість пасажирів: ${esc(l.pax)}\n\n👤 Ім'я: ${esc(l.name)}\n📞 Телефон: ${esc(l.phone)}\n\n🕒 Дата та час заявки: ${esc(l.created)}`;
}
async function send(l){
  if(!TOKEN||!CHAT) throw new Error('Telegram не налаштовано');
  const r=await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:CHAT,text:format(l),parse_mode:'HTML',disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});
  if(!r.ok) throw new Error('Telegram '+r.status);
}
async function flush(){
  for(const l of [...pending]){
    try{await send(l); pending=pending.filter(x=>x.id!==l.id); savePend();}catch(e){console.error('retry fail',e.message);break;}
  }
}
setInterval(flush,60000);

const hits=new Map();
function limited(ip){const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<600000);a.push(now);hits.set(ip,a);return a.length>5;}

function validate(b){
  const l={from:clean(b.from,120),to:clean(b.to,120),date:clean(b.date,10),pax:parseInt(b.pax,10),name:clean(b.name,80),phone:clean(b.phone,25)};
  if(!l.from||!l.to) return 'Вкажіть маршрут';
  if(l.from===l.to) return 'Пункти відправлення та призначення збігаються';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(l.date)||new Date(l.date)<new Date(new Date().toDateString())) return 'Вкажіть коректну дату виїзду';
  if(!(l.pax>=1&&l.pax<=50)) return 'Кількість пасажирів: від 1 до 50';
  if(l.name.length<2) return "Вкажіть ім'я та прізвище";
  if(!/^\+?[\d\s()\-]{9,18}$/.test(l.phone)||l.phone.replace(/\D/g,'').length<9) return 'Вкажіть коректний номер телефону';
  return l;
}

const MIME={'.html':'text/html; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  if(req.method==='POST'&&req.url==='/api/lead'){
    let body='';req.on('data',c=>{body+=c;if(body.length>10000)req.destroy();});
    req.on('end',async()=>{
      const out=(c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o));};
      let b;try{b=JSON.parse(body)}catch{return out(400,{ok:false,error:'Некоректний запит'})}
      if(b.website) return out(200,{ok:true});                       // honeypot: боти заповнюють приховане поле
      if(Date.now()-Number(b.t||0)<3000) return out(200,{ok:true});  // надто швидко для людини
      if(limited(ip)) return out(429,{ok:false,error:'Забагато спроб. Спробуйте пізніше або зателефонуйте нам.'});
      const l=validate(b); if(typeof l==='string') return out(400,{ok:false,error:l});
      l.id=Date.now()+Math.random().toString(36).slice(2,6); l.created=new Date().toLocaleString('uk-UA',{timeZone:'Europe/Kyiv'});
      fs.appendFileSync(LOG,JSON.stringify(l)+'\n');                 // спочатку зберігаємо — заявка не втрачається
      try{await send(l)}catch(e){console.error('send fail',e.message);pending.push(l);savePend();}
      out(200,{ok:true});
    });return;
  }
  if(req.method==='GET'){
    const u=req.url.split('?')[0]; const f=u==='/'?'index.html':u.startsWith('/img/')?u.slice(1):null;
    const p=f&&path.join(__dirname,f);
    if(p&&p.startsWith(__dirname)&&fs.existsSync(p)&&fs.statSync(p).isFile()){
      res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream','Cache-Control':u==='/'?'no-cache':'public, max-age=604800'});
      return fs.createReadStream(p).pipe(res);
    }
  }
  res.writeHead(404);res.end('Not found');
}).listen(PORT,()=>{console.log('http://localhost:'+PORT);flush();});
