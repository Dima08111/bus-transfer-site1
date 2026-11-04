(function () {
  "use strict";

  var D = window.ROUTE_DATA;
  var loadedAt = Date.now();
  var $ = function (id) { return document.getElementById(id); };

  var form = $("lead-form");
  var statusBox = $("status");
  var submitBtn = $("submit");
  var PHONE_TEXT = "+380 97 509 87 10";

  var sides = {
    from: { country: $("fromCountry"), city: $("fromCitySel"), txt: $("fromCityTxt") },
    to: { country: $("toCountry"), city: $("toCitySel"), txt: $("toCityTxt") }
  };
  
  /* ---------- допоміжні ---------- */
  function opt(value, label, extra) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  function clear(sel) { while (sel.firstChild) sel.removeChild(sel.firstChild); }

  function euCountries() {
    return Object.keys(D.EU).sort(function (a, b) { return a.localeCompare(b, "uk"); });
  }

  function fillCountry(sel) {
    clear(sel);
    sel.disabled = false;
    sel.appendChild(opt("", "Оберіть країну", { disabled: true, selected: true }));
    sel.appendChild(opt(D.UA_COUNTRY, D.UA_COUNTRY));
    euCountries().forEach(function (c) { sel.appendChild(opt(c, c)); });
  }

  function citiesOf(country) {
    return D.UA[country] || D.EU[country] || [];
  }

  function fillCities(side) {
    var s = sides[side];
    clear(s.city);
    var country = s.country.value;
    if (!country) {
      s.city.appendChild(opt("", "Спочатку оберіть країну", { disabled: true, selected: true }));
      s.city.disabled = true;
    } else {
      s.city.disabled = false;
      s.city.appendChild(opt("", "Оберіть місто", { disabled: true, selected: true }));
      citiesOf(country).forEach(function (c) { s.city.appendChild(opt(c, c)); });
      s.city.appendChild(opt(D.OTHER, D.OTHER));
    }
    s.txt.hidden = true;
    s.txt.value = "";
  }

  function onCitySelect(side) {
    var s = sides[side];
    var other = s.city.value === D.OTHER;
    s.txt.hidden = !other;
    if (other) s.txt.focus(); else s.txt.value = "";
  }

  function cityValue(side) {
    var s = sides[side];
    var v = s.city.value;
    if (v === D.OTHER) return s.txt.value.replace(/\s+/g, " ").trim();
    return v;
  }

  function setupSides() {
    fillCountry(sides.from.country);
    fillCountry(sides.to.country);
    sides.from.country.value = D.UA_COUNTRY; // за замовчуванням їдуть з України, але можна змінити
    fillCities("from");
    fillCities("to");
  }

  // Один кінець маршруту завжди Україна, інший — Європа. Друга сторона підставляється автоматично.
  function onCountryChange(side) {
    var other = side === "from" ? "to" : "from";
    var v = sides[side].country.value;
    var o = sides[other].country;
    fillCities(side);
    if (v === D.UA_COUNTRY) {
      if (o.value === D.UA_COUNTRY) { o.value = ""; fillCities(other); }
    } else if (v) {
      if (o.value !== D.UA_COUNTRY) { o.value = D.UA_COUNTRY; fillCities(other); }
    }
    clearErrors();
  }

  /* ---------- зміна напрямків місцями ---------- */
  function swap() {
    var f = { country: sides.from.country.value, city: sides.from.city.value, txt: sides.from.txt.value };
    var t = { country: sides.to.country.value, city: sides.to.city.value, txt: sides.to.txt.value };
    apply("from", t);
    apply("to", f);
    clearErrors();
  }

  function apply(side, v) {
    var s = sides[side];
    s.country.value = v.country || "";
    fillCities(side);
    if (v.city) {
      s.city.value = v.city;
      if (s.city.value !== v.city) s.city.value = "";
    }
    if (v.city === D.OTHER) { s.txt.hidden = false; s.txt.value = v.txt; }
  }

  /* ---------- дата та пасажири ---------- */
  function ymd(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function setupDate() {
    var now = new Date();
    var max = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    $("date").min = ymd(now);
    $("date").max = ymd(max);
  }
  function setupPassengers() {
    var sel = $("passengers");
    for (var i = 1; i <= 10; i++) sel.appendChild(opt(String(i), String(i)));
    sel.value = "1";
  }

  /* ---------- валідація ---------- */
  function setErr(key, msg, el) {
    var p = form.querySelector('.err[data-for="' + key + '"]');
    if (p) p.textContent = msg || "";
    if (el) el.classList.toggle("is-invalid", !!msg);
  }
  function clearErrors() {
    form.querySelectorAll(".err").forEach(function (p) { p.textContent = ""; });
    form.querySelectorAll(".is-invalid").forEach(function (e) { e.classList.remove("is-invalid"); });
  }

  function validate() {
    clearErrors();
    var firstBad = null;
    function bad(key, msg, el) { setErr(key, msg, el); if (!firstBad) firstBad = el; }

    if (!sides.from.country.value) bad("fromCity", "Оберіть країну відправлення.", sides.from.country);
    else if (!cityValue("from")) bad("fromCity", "Оберіть або впишіть місто відправлення.", sides.from.city.value === D.OTHER ? sides.from.txt : sides.from.city);

    if (!sides.to.country.value) bad("toCity", "Оберіть країну прибуття.", sides.to.country);
    else if (!cityValue("to")) bad("toCity", "Оберіть або впишіть місто прибуття.", sides.to.city.value === D.OTHER ? sides.to.txt : sides.to.city);

    var date = $("date").value;
    if (!date) bad("date", "Оберіть дату поїздки.", $("date"));
    else if (date < $("date").min) bad("date", "Дата не може бути в минулому.", $("date"));
    else if (date > $("date").max) bad("date", "Дата занадто далека.", $("date"));

    var pax = parseInt($("passengers").value, 10);
    if (!(pax >= 1 && pax <= 10)) bad("passengers", "Оберіть від 1 до 10 пасажирів.", $("passengers"));

    var name = $("name").value.trim();
    if (name.length < 2) bad("name", "Вкажіть ім'я.", $("name"));

    var phone = $("phone").value.trim();
    var digits = phone.replace(/\D/g, "");
    if (!/^[+\d][\d\s()\-+]*$/.test(phone) || digits.length < 9 || digits.length > 15)
      bad("phone", "Вкажіть коректний номер телефону.", $("phone"));

    if (!$("consent").checked) bad("consent", "Потрібна згода на обробку персональних даних.", $("consent"));

    if (firstBad) { firstBad.focus({ preventScroll: false }); return null; }

    return {
      fromCountry: sides.from.country.value,
      fromCity: cityValue("from"),
      toCountry: sides.to.country.value,
      toCity: cityValue("to"),
      date: date,
      passengers: pax,
      name: name,
      phone: phone,
      consent: true,
      website: $("website").value,
      elapsed: Date.now() - loadedAt
    };
  }

  /* ---------- повідомлення ---------- */
  function showStatus(kind, text, withCall) {
    statusBox.className = "status status--" + kind;
    statusBox.textContent = text;
    if (withCall) {
      statusBox.appendChild(document.createTextNode(" "));
      var a = document.createElement("a");
      a.href = "tel:+380975098710";
      a.textContent = PHONE_TEXT;
      statusBox.appendChild(a);
    }
    statusBox.hidden = false;
    statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------- надсилання ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;
    var payload = validate();
    if (!payload) return;

    statusBox.hidden = true;
    submitBtn.disabled = true;
    var label = submitBtn.textContent;
    submitBtn.textContent = "НАДСИЛАЄМО…";

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 15000);

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) {
          return { res: res, json: json };
        });
      })
      .then(function (r) {
        // Успіх — ТІЛЬКИ якщо сервер підтвердив (а він підтверджує лише після успішної відповіді Telegram API).
        if (r.res.ok && r.json && r.json.ok === true) {
          showStatus("ok", "Дякуємо! Ваша заявка прийнята. Наш менеджер зв'яжеться з вами найближчим часом.");
          trackLead();
          resetForm();
        } else if (r.res.status === 400 && r.json && r.json.error && r.json.error !== "delivery_failed") {
          showStatus("bad", r.json.error);
        } else {
          showStatus("bad", "Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте нам:", true);
        }
      })
      .catch(function () {
        showStatus("bad", "Не вдалося надіслати заявку (немає зв'язку із сервером). Спробуйте ще раз або зателефонуйте нам:", true);
      })
      .then(function () {
        clearTimeout(timer);
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      });
  });

  function resetForm() {
    form.reset();
    setupSides();
    $("passengers").value = "1";
    loadedAt = Date.now();
    clearErrors();
  }

  /* ---------- події ---------- */
  sides.from.country.addEventListener("change", function () { onCountryChange("from"); });
  sides.to.country.addEventListener("change", function () { onCountryChange("to"); });
  sides.from.city.addEventListener("change", function () { onCitySelect("from"); });
  sides.to.city.addEventListener("change", function () { onCitySelect("to"); });
  $("swap").addEventListener("click", function () {
    var b = $("swap");
    b.classList.add("spin");
    setTimeout(function () { b.classList.remove("spin"); }, 320);
    swap();
  });
  form.addEventListener("input", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("is-invalid")) t.classList.remove("is-invalid");
  });

  /* ---------- політика конфіденційності ---------- */
  var dlg = $("privacy");
  document.querySelectorAll("[data-open-privacy]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    });
  });
  function closeDlg() { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); }
  $("privacy-close").addEventListener("click", closeDlg);
  dlg.addEventListener("click", function (e) { if (e.target === dlg) closeDlg(); });

  /* ---------- Cookies та Meta Pixel ----------
     Піксель вантажиться ТІЛЬКИ після згоди користувача. ID береться з META_PIXEL_ID на сервері.
     Якщо ID не задано — піксель і банер не вмикаються. */
  var CONSENT_KEY = "cookie_consent_v1";
  var pixelId = "";
  var pixelLoaded = false;
  var banner = $("cookie-banner");

  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) { /* ігноруємо */ } }

  function loadPixel(id) {
    if (pixelLoaded || !id) return;
    pixelLoaded = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", id);
    window.fbq("track", "PageView");
  }

  // Lead: лише якщо піксель дозволено й завантажено; унікальний eventID, повторно в межах однієї заявки не шлеться.
  function trackLead() {
    if (!pixelLoaded || typeof window.fbq !== "function") return;
    var eventID = "lead_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    window.fbq("track", "Lead", {}, { eventID: eventID });
  }

  function showBanner() { if (banner) banner.hidden = false; }
  function hideBanner() { if (banner) banner.hidden = true; }

  function initConsent() {
    if (!pixelId) return; // нема що погоджувати
    var csLink = $("cookie-settings");
    if (csLink) csLink.hidden = false;
    var c = getConsent();
    if (c === "granted") loadPixel(pixelId);
    else if (c === null) showBanner();
  }

  if (banner) {
    $("cookie-accept").addEventListener("click", function () { setConsent("granted"); hideBanner(); loadPixel(pixelId); });
    $("cookie-reject").addEventListener("click", function () {
      var was = pixelLoaded;
      setConsent("denied"); hideBanner();
      if (was) location.reload(); // вже завантажений піксель можна вимкнути лише перезавантаженням
    });
  }
  var csBtn = $("cookie-settings");
  if (csBtn) csBtn.addEventListener("click", function (e) { e.preventDefault(); showBanner(); });

  fetch("/api/config", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (c) { if (c && c.pixelId) { pixelId = c.pixelId; initConsent(); } })
    .catch(function () { /* без пікселя сайт працює як завжди */ });

  /* ---------- фото: показуємо лише ті, що реально завантажились ---------- */
  function initPhotos() {
    document.querySelectorAll("figure[data-photo]").forEach(function (fig) {
      var img = fig.querySelector("img");
      var probe = new Image();
      probe.onload = function () {
        fig.hidden = false;
        var sec = fig.closest("[data-needs-photo]");
        if (sec) sec.hidden = false;
      };
      probe.src = img.getAttribute("src");
    });
  }

  /* ---------- старт ---------- */
  initPhotos();
  $("year").textContent = new Date().getFullYear();
  setupSides();
  setupDate();
  setupPassengers();
})();
