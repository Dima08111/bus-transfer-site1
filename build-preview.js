// Збирає ОДИН автономний файл для швидкого перегляду (подвійний клік у Chrome).
// Використання: node build-preview.js [вихідний_файл]   (за замовчуванням preview/index.html)
const fs = require("fs"), path = require("path");
const pub = path.join(__dirname, "public");
const read = (f) => fs.readFileSync(path.join(pub, f), "utf8");
let html = read("index.html");

html = html.replace(/<link rel="stylesheet" href="style.css">/, () => "<style>\n" + read("style.css") + "\n</style>");

// фото -> data URI
html = html.replace(/src="(img\/[^"]+\.jpg)"/g, (m, p) => {
  const b = fs.readFileSync(path.join(pub, p));
  return 'src="data:image/jpeg;base64,' + b.toString("base64") + '"';
});

const previewStub = `
// ПЕРЕГЛЯД: сайт відкрито як файл, серверної частини немає. Заявки не надсилаються.
(function(){
  if (location.protocol !== "file:") return;
  var realFetch = window.fetch;
  window.fetch = function (u, o) {
    if (String(u).indexOf("/api/") === 0) {
      return Promise.resolve({ ok: false, status: 503, json: function () { return Promise.resolve({ ok: false, error: "preview" }); } });
    }
    return realFetch.apply(this, arguments);
  };
  var bar = document.createElement("div");
  bar.textContent = "РЕЖИМ ПЕРЕГЛЯДУ: сайт відкрито як файл, форма заявки не надсилає дані (потрібна публікація на хостингу)";
  bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99;background:#ffd24d;color:#222;font:600 13px/1.3 system-ui,sans-serif;text-align:center;padding:6px 10px";
  document.addEventListener("DOMContentLoaded", function(){ document.body.appendChild(bar); });
  if (document.readyState !== "loading") document.body.appendChild(bar);
})();
`;
const inline = (code) => "<script>\n" + code.replace(/<\/script/gi, "<\\/script") + "\n</script>";
html = html.replace('<script src="data.js" defer></script>', () => inline(read("data.js") + previewStub));
html = html.replace('<script src="app.js" defer></script>', () => inline(read("app.js")));

const out = process.argv[2] || path.join(__dirname, "preview", "index.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("Готово:", out, (fs.statSync(out).size / 1024).toFixed(0) + " КБ");
