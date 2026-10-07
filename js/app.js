/* DaHand – test web app (v2). Vanilla JS, no build step. Data lives in localStorage. */
(function () {
  "use strict";

  var CFG = window.DAHAND_CONFIG || {};
  var DATA = window.DAHAND_DATA;
  var I18N = window.DAHAND_I18N;
  var KEY = "dahand:v1";            // storage key stays the same; schema version lives in S.v
  var SCHEMA = 2;
  var KEEP_DAYS = 90;
  var SLOTS = ["m", "a", "e"];
  var app = document.getElementById("app");

  // ---------- helpers ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function parseIso(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function locale() { return S.lang === "vi" ? "vi-VN" : "en-US"; }
  function money(n) {
    try { return new Intl.NumberFormat(locale(), { style: "currency", currency: S.currency || "USD", maximumFractionDigits: 0 }).format(+n || 0); }
    catch (e) { return "$" + Math.round(+n || 0); }
  }
  function num(n) { return Math.round(n).toLocaleString(locale()); }
  function t(key, vars) {
    var dict = I18N[S.lang] || I18N.en;
    var s = dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (typeof s === "string" && vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function dayLabel(s) { return parseIso(s).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }); }
  function dayShort(s) { return parseIso(s).toLocaleDateString(locale(), { weekday: "short" }); }
  function slotNow() { var h = new Date().getHours(); return h >= 5 && h < 12 ? "m" : h >= 12 && h < 17 ? "a" : "e"; }
  function slotOfTime(hm) { var h = +String(hm || "0").slice(0, 2); return h >= 5 && h < 12 ? "m" : h >= 12 && h < 17 ? "a" : "e"; }
  function weekdayIndex(s) { return (parseIso(s).getDay() + 6) % 7; } // Mon = 0
  function byTime(a, b) { return (a.time || "").localeCompare(b.time || ""); }
  function byDue(a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); }
  function hexRgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { var x = hexRgb(a), y = hexRgb(b); return "#" + x.map(function (v, i) { var c = Math.round(v + (y[i] - v) * t); return (c < 16 ? "0" : "") + c.toString(16); }).join(""); }
  function rgba(h, a) { var c = hexRgb(h); return "rgba(" + c.join(",") + "," + a + ")"; }
  function findById(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  // ---------- state ----------
  function fresh() {
    return {
      v: SCHEMA, lang: (navigator.language || "en").toLowerCase().indexOf("vi") === 0 ? "vi" : "en",
      onboarded: false, name: "", modes: ["office"], active: "office",
      profile: null, track: true, hideNumbers: false,
      credits: CFG.START_CREDITS || 50, lastBonus: "", lastOpen: "",
      currency: CFG.DEFAULT_CURRENCY || "USD", tips: { welcome: true },
      events: [], tasks: [], sleep: {}, energy: {}, meals: {}, water: {},
      mealPlan: [], grocery: {}, quotes: [], gigs: [], sample: ""
    };
  }
  // Upgrade older saved data to the current schema.
  function migrate(s) {
    s = Object.assign(fresh(), s || {});
    if (!s.v || s.v < 2) {
      var en = {};
      Object.keys(s.energy || {}).forEach(function (d) {
        var val = s.energy[d];
        if (Array.isArray(val)) { var o = {}; val.forEach(function (e) { o[slotOfTime(e.t)] = e.v; }); en[d] = o; }
        else en[d] = val;
      });
      s.energy = en;
      if (!s.tips) s.tips = { welcome: false };
      s.v = 2;
    }
    if (!s.tips) s.tips = { welcome: false };
    if (!s.currency) s.currency = CFG.DEFAULT_CURRENCY || "USD";
    return prune(s);
  }
  // Keep only the last KEEP_DAYS days of daily logs.
  function prune(s) {
    var cutoff = addDays(today(), -KEEP_DAYS);
    ["sleep", "energy", "meals", "water"].forEach(function (k) {
      Object.keys(s[k] || {}).forEach(function (d) { if (d < cutoff) delete s[k][d]; });
    });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* ignore */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  var S = load();
  var UI = { ob: 0, obModes: { home: false, freelancer: false, artist: false }, tab: "today", planTab: "calendar", showDone: false,
    inboxText: "", found: null, modal: null, drafts: {}, undo: null, showBody: false, focusKey: null };

  // ---------- analytics (optional, anonymous) ----------
  var analyticsQueue = [];
  function initAnalytics() {
    var s;
    if (CFG.GOATCOUNTER_CODE) {
      s = document.createElement("script"); s.async = true; s.src = "https://gc.zgo.at/count.js";
      s.setAttribute("data-goatcounter", "https://" + CFG.GOATCOUNTER_CODE + ".goatcounter.com/count");
      document.head.appendChild(s);
    }
    if (CFG.UMAMI_WEBSITE_ID) {
      s = document.createElement("script"); s.defer = true; s.src = "https://cloud.umami.is/script.js";
      s.setAttribute("data-website-id", CFG.UMAMI_WEBSITE_ID);
      document.head.appendChild(s);
    }
  }
  function track(name) {
    if (!CFG.GOATCOUNTER_CODE && !CFG.UMAMI_WEBSITE_ID) return;
    analyticsQueue.push(name); flushAnalytics();
  }
  function flushAnalytics() {
    var gc = window.goatcounter && window.goatcounter.count, um = window.umami && window.umami.track;
    if (!gc && !um) { setTimeout(flushAnalytics, 1500); return; }
    while (analyticsQueue.length) {
      var n = analyticsQueue.shift();
      try { if (gc) window.goatcounter.count({ path: "event/" + n, title: n, event: true }); if (um) window.umami.track(n); } catch (e) { /* ignore */ }
    }
  }

  // ---------- calories / sleep / energy ----------
  function calorieInfo() {
    var p = S.profile;
    if (!S.track || !p) return null;
    if (p.age < 18 || p.pregnant) return { blocked: true };
    var bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161);
    var factor = [1.2, 1.375, 1.55, 1.725][(p.activity || 1) - 1];
    var floor = p.sex === "male" ? 1500 : 1200;
    var target = Math.max(floor, Math.round((bmr * factor) / 10) * 10);
    var eaten = (S.meals[today()] || []).reduce(function (a, m) { return a + (+m.kcal || 0); }, 0);
    return { target: target, eaten: eaten, left: Math.max(0, target - eaten), floor: floor };
  }
  function sleepHours(d) {
    var s = S.sleep[d]; if (!s || !s.bed || !s.wake) return null;
    var b = s.bed.split(":"), w = s.wake.split(":");
    var mins = (+w[0] * 60 + +w[1]) - (+b[0] * 60 + +b[1]); if (mins <= 0) mins += 1440;
    return Math.round(mins / 6) / 10;
  }
  function energyStats() {
    var sum = { m: 0, a: 0, e: 0 }, cnt = { m: 0, a: 0, e: 0 }, total = 0;
    for (var i = 0; i < 14; i++) {
      var day = S.energy[addDays(today(), -i)] || {};
      SLOTS.forEach(function (k) { if (day[k]) { sum[k] += day[k]; cnt[k]++; total++; } });
    }
    var best = null;
    SLOTS.forEach(function (k) { if (cnt[k] >= 2 && (!best || sum[k] / cnt[k] > sum[best] / cnt[best])) best = k; });
    return { total: total, best: total >= 4 ? best : null, avg: best ? Math.round((sum[best] / cnt[best]) * 10) / 10 : 0, n: best ? cnt[best] : 0 };
  }
  function setEnergy(slot, v) {
    var d = today(); var day = S.energy[d] = S.energy[d] || {};
    if (day[slot] === v) { delete day[slot]; toast(t("energy_cleared")); }
    else { day[slot] = v; toast(t("energy_saved", { slot: t("slot_" + slot), label: t("lv" + v), v: v })); track("energy_set"); }
    save(); render();
  }

  // ---------- meals helpers ----------
  function meal(id) { return DATA.meals.filter(function (m) { return m.id === id; })[0]; }
  function mealName(m) { return m ? (S.lang === "vi" ? m.vi : m.en) : ""; }
  function dinnerPool() { return DATA.meals.filter(function (m) { return m.type === "dinner" || m.type === "lunch"; }).map(function (m) { return m.id; }); }
  function newWeek() {
    var pool = dinnerPool().sort(function () { return Math.random() - 0.5; });
    return pool.slice(0, 7);
  }
  function groceryItems() {
    var ing = {}; S.mealPlan.forEach(function (id) { var m = meal(id); if (m) m.ing.forEach(function (i) { ing[i] = true; }); });
    return Object.keys(ing);
  }
  function ingName(k) { var p = DATA.ingredients[k]; return p ? p[S.lang === "vi" ? 1 : 0] : k; }

  // ---------- icons ----------
  var ICON = {
    sun: '<path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19 14 10"/>',
    dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    spark: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function icon(name, size) { return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>"; }

  // ---------- render root ----------
  function render() {
    var active = document.activeElement;
    if (active && active.getAttribute && active.getAttribute("data-key")) UI.focusKey = active.getAttribute("data-key");
    document.documentElement.lang = S.lang;
    var accent = DATA.modes[S.active] ? DATA.modes[S.active].accent : "#2F5BEA";
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var rs = document.documentElement.style;
    rs.setProperty("--accent", accent);
    rs.setProperty("--accent-2", mix(accent, "#A855F7", 0.35));
    rs.setProperty("--accent-dark", mix(accent, "#000000", 0.18));
    rs.setProperty("--accent-soft", rgba(accent, dark ? 0.28 : 0.14));
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", accent);
    app.innerHTML = (S.onboarded ? shell() : onboarding()) + modal();
    UI.enter = false;
    restoreDrafts();
    if (UI.focusKey) { var el = app.querySelector('[data-key="' + UI.focusKey + '"]'); if (el) el.focus(); UI.focusKey = null; }
    if (UI.modal && UI.modalJustOpened) { var f = app.querySelector(".modal input, .modal select, .modal button"); if (f) f.focus(); UI.modalJustOpened = false; }
  }
  // Keep what people typed in forms when the screen re-renders.
  function restoreDrafts() {
    Array.prototype.forEach.call(app.querySelectorAll("form[data-form] [name]"), function (el) {
      var key = el.form.getAttribute("data-form") + "." + el.name;
      el.setAttribute("data-key", key);
      if (UI.drafts[key] == null) return;
      if (el.type === "checkbox") el.checked = !!UI.drafts[key]; else el.value = UI.drafts[key];
    });
  }
  function clearDrafts(form) { Object.keys(UI.drafts).forEach(function (k) { if (k.indexOf(form + ".") === 0) delete UI.drafts[k]; }); }

  function shell() {
    var claimed = S.lastBonus === today();
    var chips = S.modes.length > 1 ? '<div class="chips" role="group" aria-label="' + esc(t("m_modes")) + '">' + S.modes.map(function (m) {
      return '<button type="button" class="chip' + (m === S.active ? " on" : "") + '" data-act="mode" data-v="' + m + '" aria-pressed="' + (m === S.active) + '" style="--c:' + DATA.modes[m].accent + '">' + icon(DATA.modes[m].icon, 16) + "<span>" + esc(t("mode_" + m)) + "</span></button>";
    }).join("") + "</div>" : "";
    var tabs = [["today", "sun", t("nav_today")], ["plan", "cal", t("nav_plan")], ["routine", "leaf", t("nav_routine")], ["mode", DATA.modes[S.active].icon, t("nav_mode")], ["more", "dots", t("nav_more")]];
    var nav = tabs.map(function (x) {
      var on = UI.tab === x[0];
      return '<button type="button" class="nav-btn' + (on ? " on" : "") + '" data-act="tab" data-v="' + x[0] + '"' + (on ? ' aria-current="page"' : "") + ">" + icon(x[1], 22) + "<span>" + esc(x[2]) + "</span></button>";
    }).join("");
    var screen = { today: scrToday, plan: scrPlan, routine: scrRoutine, mode: scrMode, more: scrMore }[UI.tab]();
    return '<div class="layout' + (S.modes.length > 1 ? "" : " no-chips") + '">' +
      '<header class="top"><div class="brand"><span class="logo">' + icon("spark", 18) + '</span><span class="brand-name">DaHand</span></div>' +
      '<div class="top-right"><button type="button" class="credit-badge" data-act="credits" aria-label="' + esc(t("credits_title") + ": " + S.credits) + '">' + icon("spark", 14) + "<b>" + S.credits + '</b><span class="credit-word">' + esc(t("credits")) + "</span>" + (claimed ? "" : '<span class="dot" aria-hidden="true"></span>') + "</button>" +
      '<button type="button" class="lang-btn" data-act="lang" aria-label="' + esc(t("m_language")) + '">' + icon("globe", 16) + "<span>" + (S.lang === "vi" ? "EN" : "VI") + "</span></button></div></header>" +
      chips + '<nav class="nav" aria-label="Main">' + nav + "</nav>" +
      '<main class="main' + (UI.enter ? " enter" : "") + '" id="main">' + screen + "</main></div>" +
      '<div id="toast" class="toast" role="status" aria-live="polite"></div>';
  }

  // ---------- onboarding (2 steps) ----------
  function onboarding() {
    var step = UI.ob, body, dots = UI.ob === "demo" ? 0 : step;
    if (step === "demo") {
      body = '<h1 class="ob-h">' + esc(t("demo_title")) + '</h1><p class="ob-p">' + esc(t("demo_note")) + "</p>" + sampleCards() +
        '<div class="row gap ob-actions"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + "</button></div>";
    } else if (step === 0) {
      body = '<h1 class="ob-h">' + esc(t("ob_welcome")) + '</h1><p class="ob-p">' + esc(t("ob_intro")) + "</p>" +
        '<label class="field"><span>' + esc(t("ob_name")) + '</span><input id="ob-name" type="text" maxlength="40" autocomplete="given-name" placeholder="' + esc(t("ob_name_ph")) + '" value="' + esc(S.name) + '"></label>' +
        '<div class="row gap ob-actions"><button type="button" class="btn ghost" data-act="lang">' + icon("globe", 16) + esc(t("lang_switch")) + '</button><button type="button" class="btn" data-act="ob-next">' + esc(t("next")) + "</button></div>" +
        '<button type="button" class="link-btn" data-act="ob-demo">' + esc(t("ob_demo")) + "</button>";
    } else {
      body = '<h1 class="ob-h">' + esc(t("ob_modes_title")) + '</h1><p class="ob-p">' + esc(t("ob_modes_note")) + "</p>" +
        DATA.modeOrder.map(function (m) {
          var on = m === "office" || UI.obModes[m];
          return '<button type="button" class="mode-card pick' + (on ? " on" : "") + '" data-act="ob-mode" data-v="' + m + '" aria-pressed="' + on + '"' + (m === "office" ? " disabled" : "") + ' style="--c:' + DATA.modes[m].accent + '">' + icon(DATA.modes[m].icon, 22) +
            "<div><b>" + esc(t("mode_" + m)) + "</b>" + (m === "office" ? ' <span class="muted small">· ' + esc(t("ob_always_on")) + "</span>" : "") + "<p>" + esc(t("mode_" + m + "_desc")) + '</p></div><span class="tick">' + (on ? icon("check", 16) : "") + "</span></button>";
        }).join("") +
        '<div class="row gap ob-actions"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + '</button><button type="button" class="btn" data-act="ob-finish">' + esc(t("ob_start")) + "</button></div>";
    }
    return '<div class="ob"><div class="ob-card"><div class="brand big"><span class="logo">' + icon("spark", 22) + '</span><span class="brand-name">DaHand</span></div><p class="tagline">' + esc(t("tagline")) + '</p><div class="steps" aria-hidden="true">' + [0, 1].map(function (i) { return '<span class="' + (i <= dots ? "on" : "") + '"></span>'; }).join("") + "</div>" + body + "</div></div>";
  }
  function sampleCards() {
    var SAM = window.DAHAND_SAMPLES; if (!SAM) return "";
    return '<div class="samples">' + SAM.list.map(function (p) {
      var main = p.modes[p.modes.length > 1 ? 1 : 0];
      return '<button type="button" class="mode-card sample" data-act="sample" data-v="' + p.id + '" style="--c:' + DATA.modes[main].accent + '">' + icon(DATA.modes[main].icon, 22) +
        "<div><b>" + esc(p.name) + '</b> <span class="muted small">· ' + esc(p.modes.map(function (m) { return t("mode_" + m); }).join(", ")) + "</span><p>" + esc(S.lang === "vi" ? p.desc[1] : p.desc[0]) + "</p></div></button>";
    }).join("") + "</div>";
  }
  function loadSample(pid) {
    var built = window.DAHAND_SAMPLES.build(pid, S.lang, today());
    if (!built) return;
    S = migrate(Object.assign(fresh(), built, { currency: built.currency || "USD", tips: { welcome: false } })); save();
    UI.ob = 0; UI.tab = "today"; UI.modal = null; UI.drafts = {}; UI.enter = true; window.scrollTo(0, 0); render();
    toast(t("sample_loaded_name", { name: S.name })); track("sample_" + pid);
  }

  function profileForm(formId) {
    var p = S.profile || {};
    var opt = function (v, label, cur) { return '<option value="' + v + '"' + (cur != null && String(cur) === String(v) ? " selected" : "") + ">" + esc(label) + "</option>"; };
    var val = function (x) { return x == null ? "" : x; };
    return '<form class="form" data-form="' + formId + '">' +
      '<div class="grid2"><label class="field"><span>' + esc(t("sex")) + '</span><select name="sex" required>' + (p.sex ? "" : '<option value="" selected disabled>' + esc(t("choose")) + "</option>") + opt("female", t("female"), p.sex) + opt("male", t("male"), p.sex) + "</select></label>" +
      '<label class="field"><span>' + esc(t("age")) + '</span><input name="age" type="number" inputmode="numeric" min="10" max="100" required value="' + val(p.age) + '"></label>' +
      '<label class="field"><span>' + esc(t("height_cm")) + '</span><input name="height" type="number" inputmode="numeric" min="120" max="230" required value="' + val(p.height) + '"></label>' +
      '<label class="field"><span>' + esc(t("weight_kg")) + '</span><input name="weight" type="number" inputmode="decimal" min="30" max="250" step="0.1" required value="' + val(p.weight) + '"></label></div>' +
      '<label class="field"><span>' + esc(t("activity")) + '</span><select name="activity" required>' + (p.activity ? "" : '<option value="" selected disabled>' + esc(t("choose")) + "</option>") + [1, 2, 3, 4].map(function (i) { return opt(i, t("act_" + i), p.activity); }).join("") + "</select></label>" +
      '<label class="check"><input type="checkbox" name="pregnant"' + (p.pregnant ? " checked" : "") + "> <span>" + esc(t("pregnant")) + "</span></label>" +
      '<p class="note">' + esc(t("r_formula")) + '</p><button type="submit" class="btn full">' + esc(t("save")) + "</button></form>";
  }

  // ---------- reusable pieces ----------
  function itemButton(type, id, inner) { return '<button type="button" class="row-btn" data-act="edit" data-type="' + type + '" data-id="' + esc(id) + '">' + inner + "</button>"; }
  function eventRow(e, showDate) {
    var c = (DATA.modes[e.mode] || DATA.modes.office).accent;
    return '<li class="item"><span class="time">' + esc(showDate ? dayLabel(e.date) : (e.time || "—")) + "</span>" +
      itemButton("event", e.id, '<span class="grow">' + esc(e.title) + (showDate && e.time ? ' <span class="muted small">· ' + esc(e.time) + "</span>" : "") + '</span><span class="tag" style="--c:' + c + '">' + esc(t("mode_" + (e.mode || "office"))) + "</span>") + "</li>";
  }
  function taskRow(x) {
    var overdue = x.due && x.due < today() && !x.done;
    return '<li class="item"><button type="button" class="box' + (x.done ? " on" : "") + '" data-act="toggle-task" data-id="' + x.id + '" aria-pressed="' + x.done + '" aria-label="' + esc(x.title) + '">' + (x.done ? icon("check", 14) : "") + "</button>" +
      itemButton("task", x.id, '<span class="grow' + (x.done ? " struck" : "") + '">' + esc(x.title) + (x.due ? ' <span class="small ' + (overdue ? "bad-text" : "muted") + '">· ' + esc(x.due === today() ? t("today_label") : dayLabel(x.due)) + "</span>" : "") + "</span>") + "</li>";
  }
  function modeSelect(name, cur) {
    return '<select name="' + name + '">' + S.modes.map(function (m) { return '<option value="' + m + '"' + (m === cur ? " selected" : "") + ">" + esc(t("mode_" + m)) + "</option>"; }).join("") + "</select>";
  }
  function timeSelect(name, value, label) {
    var hv = value ? value.slice(0, 2) : "", mv = value ? value.slice(3, 5) : "";
    var hours = ""; for (var h = 0; h < 24; h++) hours += '<option value="' + pad(h) + '"' + (pad(h) === hv ? " selected" : "") + ">" + pad(h) + "</option>";
    var mins = ""; for (var m = 0; m < 60; m += 5) mins += '<option value="' + pad(m) + '"' + (pad(m) === mv ? " selected" : "") + ">" + pad(m) + "</option>";
    return '<div class="field"><span>' + esc(label) + '</span><div class="time-pick"><select name="' + name + '_h" aria-label="' + esc(label) + ' (h)" required>' + (hv ? "" : '<option value="" selected disabled>--</option>') + hours + '</select><span>:</span><select name="' + name + '_m" aria-label="' + esc(label) + ' (min)" required>' + (mv ? "" : '<option value="" selected disabled>--</option>') + mins + "</select></div></div>";
  }
  function scale(slot, current, withWords) {
    return '<div class="energy' + (withWords ? " words" : "") + '" role="group" aria-label="' + esc(t("slot_" + slot)) + '">' + [1, 2, 3, 4, 5].map(function (v) {
      var on = current === v;
      return '<button type="button" data-act="energy" data-slot="' + slot + '" data-v="' + v + '" class="lv' + v + (on ? " on" : "") + '" aria-pressed="' + on + '" aria-label="' + v + "/5 · " + esc(t("lv" + v)) + '"><b>' + v + "</b>" + (withWords ? "<small>" + esc(t("lv" + v)) + "</small>" : "") + "</button>";
    }).join("") + "</div>";
  }
  function energyInsightLines() {
    var st = energyStats(), out = [];
    if (st.best) {
      out.push(t("energy_insight", { slot: t("slot_" + st.best + "_long"), avg: String(st.avg).replace(".", S.lang === "vi" ? "," : "."), n: st.n }));
      var top = S.tasks.filter(function (x) { return !x.done; }).sort(byDue)[0];
      if (top) out.push(t("energy_tip_task", { task: top.title, slot: t("slot_" + st.best + "_long") }));
    } else {
      out.push(t("energy_need_more", { n: Math.max(1, 4 - st.total) }));
    }
    var td = S.energy[today()] || {}, vals = SLOTS.map(function (k) { return td[k]; }).filter(Boolean);
    var sl = sleepHours(today());
    if (vals.length && vals.reduce(function (a, b) { return a + b; }, 0) / vals.length <= 2 && sl && sl < 7) out.push(t("energy_low_today"));
    return out;
  }

  // ---------- Today ----------
  function scrToday() {
    var h = new Date().getHours(), d = today();
    var greet = t(h < 12 ? "greet_morning" : h < 18 ? "greet_afternoon" : "greet_evening", { name: S.name || t("friend") });
    var evs = S.events.filter(function (e) { return e.date === d; }).sort(byTime);
    var open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue);
    var dueToday = open.filter(function (x) { return x.due && x.due <= d; }).length;
    var next = evs.filter(function (e) { return !e.time || e.time >= nowHM(); })[0];
    var c = calorieInfo(), sl = sleepHours(d), st = energyStats();
    var lines = [];
    lines.push(!evs.length ? t("brief_no_events") : next ? t("brief_events", { n: evs.length, next: (next.time ? next.time + " " : "") + next.title }) : t("brief_events_done", { n: evs.length }));
    lines.push(open.length ? t("brief_tasks", { n: open.length, d: dueToday }) : t("brief_no_tasks"));
    var ml = modeBriefLine(); if (ml) lines.push(ml);
    if (sl) lines.push(t("brief_sleep", { h: sl }));
    if (c && !c.blocked && !S.hideNumbers) lines.push(t("brief_kcal", { n: num(c.left) }));
    if (st.best) lines.push(t("brief_energy", { slot: t("slot_" + st.best + "_long") }));

    var slot = slotNow(), cur = (S.energy[d] || {})[slot];
    return '<h1 class="h1">' + esc(greet) + '</h1><p class="sub">' + esc(dayLabel(d)) + "</p>" +
      welcomeCard() +
      '<section class="card dark"><h2 class="card-h">' + icon("spark", 16) + esc(t("briefing")) + "</h2><p>" + lines.map(esc).join(" ") + "</p></section>" +
      modeHighlight() +
      '<section class="card" id="energy-card"><h2 class="card-h">' + esc(t("energy_q_" + { m: "morning", a: "afternoon", e: "evening" }[slot])) + "</h2>" + scale(slot, cur, true) +
      '<div class="row between wrap"><p class="note">' + esc(cur ? t("energy_tap_again") : "") + '</p><button type="button" class="link-btn" data-act="tab" data-v="routine">' + esc(t("energy_see")) + " →</button></div></section>" +
      '<div class="cols"><section class="card"><h2 class="card-h">' + esc(t("today_schedule")) + "</h2>" + (evs.length ? '<ul class="list">' + evs.map(function (e) { return eventRow(e); }).join("") + "</ul>" : '<p class="muted">' + esc(t("empty_events")) + "</p>") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("today_tasks")) + "</h2>" + (open.length ? '<ul class="list">' + open.slice(0, 6).map(taskRow).join("") + "</ul>" : '<p class="muted">' + esc(t("empty_tasks")) + "</p>") +
      '<form class="form inline quick" data-form="qtask"><input name="title" required maxlength="100" placeholder="' + esc(t("quick_task_ph")) + '" aria-label="' + esc(t("add_task")) + '"><button type="submit" class="btn" aria-label="' + esc(t("add_task")) + '">' + icon("plus", 18) + "</button></form></section></div>" +
      '<section class="card"><h2 class="card-h">' + esc(t("ask_title")) + '</h2><div class="asks">' + aiButtons() + '</div><p class="note">' + esc(t("ask_offline_note")) + "</p></section>";
  }

  function welcomeCard() {
    if (!S.tips || !S.tips.welcome || S.sample) return "";
    var hasTask = S.tasks.length > 0, hasEnergy = Object.keys(S.energy).some(function (k) { return Object.keys(S.energy[k] || {}).length; }), hasFood = !!S.profile || !S.track;
    if (hasTask && hasEnergy && hasFood) return "";
    var item = function (ok, label, act) { return '<li><button type="button" class="gs' + (ok ? " ok" : "") + '" data-act="' + act + '"><span class="box' + (ok ? " on" : "") + '">' + (ok ? icon("check", 14) : "") + "</span>" + esc(label) + "</button></li>"; };
    return '<section class="card welcome"><div class="row between"><h2 class="card-h">' + esc(t("welcome_title")) + '</h2><button type="button" class="link-btn" data-act="hide-welcome">' + esc(t("gs_hide")) + "</button></div>" +
      '<p class="note">' + esc(t("welcome_note")) + '</p><ul class="gs-list">' + item(hasTask, t("gs_task"), "gs-task") + item(hasEnergy, t("gs_energy"), "gs-energy") + item(hasFood, t("gs_food"), "gs-food") + "</ul>" +
      '<button type="button" class="link-btn" data-act="open-samples">' + esc(t("gs_sample")) + " →</button></section>";
  }

  function modeBriefLine() {
    var d = today();
    if (S.active === "home") {
      if (!S.mealPlan.length) return "";
      var left = groceryItems().filter(function (k) { return !S.grocery[k]; }).length;
      return t("brief_home", { meal: mealName(meal(S.mealPlan[weekdayIndex(d)])), n: left });
    }
    if (S.active === "freelancer") {
      var owed = S.quotes.filter(function (q) { return q.stage === 2; }).reduce(function (a, q) { return a + (+q.amount || 0); }, 0);
      return t("brief_free", { owed: money(owed), q: S.quotes.filter(function (q) { return q.stage === 0; }).length });
    }
    if (S.active === "artist") {
      var g = nextGig(); if (!g) return t("brief_artist_none");
      return t("brief_artist", { gig: g.venue + " · " + dayLabel(g.date), owed: money(artistOwed()) });
    }
    return "";
  }
  function nextGig() { return S.gigs.filter(function (g) { return g.date >= today(); }).sort(function (a, b) { return a.date.localeCompare(b.date); })[0]; }
  function gigOwed(g) { return g.fullPaid ? 0 : (+g.fee || 0) - (g.depPaid ? (+g.deposit || 0) : 0); }
  function artistOwed() { return S.gigs.reduce(function (a, g) { return a + gigOwed(g); }, 0); }

  function modeHighlight() {
    var d = today(), title, body, btn;
    if (S.active === "office") {
      var nm = S.events.filter(function (e) { return e.date === d && e.mode === "office" && (!e.time || e.time >= nowHM()); }).sort(byTime)[0];
      title = t("hl_office"); body = nm ? "<b>" + esc(nm.time || "") + "</b> " + esc(nm.title) : esc(t("hl_office_none")); btn = t("hl_office_btn");
    } else if (S.active === "home") {
      if (!S.mealPlan.length) S.mealPlan = newWeek();
      var left = groceryItems().filter(function (k) { return !S.grocery[k]; }).length;
      title = t("hl_home"); body = "<b>" + esc(mealName(meal(S.mealPlan[weekdayIndex(d)]))) + '</b> <span class="muted">· ' + esc(t("h_grocery")) + ": " + esc(t("h_left", { n: left })) + "</span>"; btn = t("hl_home_btn");
    } else if (S.active === "freelancer") {
      var inv = S.quotes.filter(function (q) { return q.stage === 2; });
      title = t("hl_free"); body = "<b>" + esc(money(inv.reduce(function (a, q) { return a + (+q.amount || 0); }, 0))) + '</b> <span class="muted">· ' + inv.map(function (q) { return esc(q.client); }).join(", ") + "</span>"; btn = t("hl_free_btn");
    } else {
      var g = nextGig();
      title = t("hl_artist"); body = g ? "<b>" + esc(g.venue) + '</b> <span class="muted">· ' + esc(dayLabel(g.date)) + " · " + esc(money(g.fee)) + "</span>" + (g.deposit > 0 && !g.depPaid ? ' <span class="pill bad">' + esc(t("a_dep_unpaid")) + "</span>" : "") : esc(t("brief_artist_none")); btn = t("hl_artist_btn");
    }
    return '<section class="card highlight" style="--c:' + DATA.modes[S.active].accent + '"><h2 class="card-h">' + icon(DATA.modes[S.active].icon, 16) + esc(title) + "</h2><p>" + body + '</p><button type="button" class="link-btn" data-act="tab" data-v="mode">' + esc(btn) + " →</button></section>";
  }

  function aiButtons() {
    var list = [["plan", DATA.cost.standard], ["meal", DATA.cost.standard]];
    if (S.active === "office") list.push(["inbox", 0]);
    if (S.active === "home") list.push(["groceries", DATA.cost.standard]);
    if (S.active === "freelancer" || S.active === "artist") list.push(["money", DATA.cost.standard]);
    return list.map(function (x) {
      return '<button type="button" class="ask" data-act="ai" data-v="' + x[0] + '"><span>' + esc(t("ai_" + x[0])) + '</span><span class="cost">' + esc(x[1] ? t("ai_cost", { n: x[1] }) : t("ai_free")) + "</span></button>";
    }).join("");
  }

  // ---------- Plan ----------
  function scrPlan() {
    var seg = '<div class="seg wide" role="tablist"><button type="button" role="tab" aria-selected="' + (UI.planTab === "calendar") + '" class="' + (UI.planTab === "calendar" ? "on" : "") + '" data-act="plan-tab" data-v="calendar">' + esc(t("plan_calendar")) + '</button><button type="button" role="tab" aria-selected="' + (UI.planTab === "tasks") + '" class="' + (UI.planTab === "tasks" ? "on" : "") + '" data-act="plan-tab" data-v="tasks">' + esc(t("plan_tasks")) + "</button></div>";
    if (UI.planTab === "calendar") {
      var days = []; for (var i = 0; i < 7; i++) days.push(addDays(today(), i));
      var later = S.events.filter(function (e) { return e.date > days[6]; }).sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); });
      return '<h1 class="h1">' + esc(t("nav_plan")) + "</h1>" + seg +
        '<form class="card form inline" data-form="event"><input name="title" required maxlength="80" placeholder="' + esc(t("ev_title")) + '" aria-label="' + esc(t("ev_title")) + '"><input name="date" type="date" required value="' + today() + '" aria-label="' + esc(t("ev_date")) + '"><input name="time" type="time" aria-label="' + esc(t("ev_time")) + '">' + (S.modes.length > 1 ? '<label class="sel-wrap" aria-label="' + esc(t("mode_label")) + '">' + modeSelect("mode", S.active) + "</label>" : "") + '<button type="submit" class="btn">' + icon("plus", 16) + esc(t("add_event")) + "</button></form>" +
        '<p class="note">' + esc(t("tap_to_edit")) + "</p>" +
        days.map(function (d) {
          var evs = S.events.filter(function (e) { return e.date === d; }).sort(byTime);
          return '<section class="day"><h2 class="day-h' + (d === today() ? " now" : "") + '">' + esc(d === today() ? t("today_label") + " · " + dayLabel(d) : dayLabel(d)) + "</h2>" + (evs.length ? '<ul class="list">' + evs.map(function (e) { return eventRow(e); }).join("") + "</ul>" : '<p class="muted small empty-day">' + esc(t("no_events_day")) + "</p>") + "</section>";
        }).join("") +
        (later.length ? '<section class="day"><h2 class="day-h">' + esc(t("later")) + '</h2><ul class="list">' + later.map(function (e) { return eventRow(e, true); }).join("") + "</ul></section>" : "");
    }
    var list = S.tasks.filter(function (x) { return UI.showDone || !x.done; }).sort(function (a, b) { return (a.done - b.done) || byDue(a, b); });
    return '<h1 class="h1">' + esc(t("nav_plan")) + "</h1>" + seg +
      '<form class="card form inline" data-form="task"><input name="title" required maxlength="100" placeholder="' + esc(t("task_title")) + '" aria-label="' + esc(t("task_title")) + '"><input name="due" type="date" aria-label="' + esc(t("due")) + '">' + (S.modes.length > 1 ? '<label class="sel-wrap" aria-label="' + esc(t("mode_label")) + '">' + modeSelect("mode", S.active) + "</label>" : "") + '<button type="submit" class="btn">' + icon("plus", 16) + esc(t("add_task")) + "</button></form>" +
      '<div class="row between wrap"><label class="check"><input type="checkbox" data-act="show-done"' + (UI.showDone ? " checked" : "") + "> <span>" + esc(t("show_done")) + '</span></label><p class="note">' + esc(t("tap_to_edit")) + "</p></div>" +
      '<section class="card">' + (list.length ? '<ul class="list">' + list.map(taskRow).join("") + "</ul>" : '<p class="muted">' + esc(t("empty_tasks")) + "</p>") + "</section>";
  }

  // ---------- Routine ----------
  function scrRoutine() {
    return '<h1 class="h1">' + esc(t("nav_routine")) + "</h1>" + energyFull() + sleepCard() + waterCard() + foodCard();
  }
  function energyFull() {
    var d = today(), day = S.energy[d] || {};
    var rows = SLOTS.map(function (k) {
      return '<div class="slot-row' + (k === slotNow() ? " now" : "") + '"><div class="slot-name"><b>' + esc(t("slot_" + k)) + '</b><span class="muted small">' + esc(t("slot_" + k + "_range")) + "</span></div>" + scale(k, day[k], false) + "</div>";
    }).join("");
    var legend = '<p class="legend">' + [1, 2, 3, 4, 5].map(function (v) { return "<span><b>" + v + "</b> " + esc(t("lv" + v)) + "</span>"; }).join("") + "</p>";
    var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(d, -i));
    var grid = '<div class="heat" role="table" aria-label="' + esc(t("energy_week")) + '"><div role="row" class="heat-row"><span role="columnheader"></span>' + days.map(function (x) { return '<span role="columnheader" class="heat-day' + (x === d ? " now" : "") + '">' + esc(dayShort(x)) + "</span>"; }).join("") + "</div>" +
      SLOTS.map(function (k) {
        return '<div role="row" class="heat-row"><span role="rowheader" class="heat-slot">' + esc(t("slot_" + k)) + "</span>" + days.map(function (x) {
          var v = (S.energy[x] || {})[k];
          return '<span role="cell" class="heat-cell' + (v ? " v" + v : "") + '" title="' + esc(dayLabel(x) + " · " + t("slot_" + k) + (v ? " · " + v + "/5 " + t("lv" + v) : "")) + '">' + (v || "") + "</span>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    return '<section class="card"><h2 class="card-h">' + esc(t("energy")) + "</h2>" + rows + legend +
      '<h3 class="sub-h">' + esc(t("energy_week")) + "</h3>" + grid +
      '<div class="insight">' + icon("spark", 16) + "<div>" + energyInsightLines().map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") + "</div></div></section>";
  }
  function sleepCard() {
    var d = today(), s = S.sleep[d] || {}, sl = sleepHours(d);
    var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(d, -i));
    var vals = days.map(sleepHours), logged = vals.filter(function (x) { return x; });
    var avg = logged.length ? Math.round(logged.reduce(function (a, b) { return a + b; }, 0) / logged.length * 10) / 10 : 0;
    var bars = logged.length ? '<div class="sleep-bars" aria-label="' + esc(t("r_sleep_week", { h: avg })) + '">' + days.map(function (x, i) {
      var h = vals[i];
      return '<div class="sb"><span class="sb-val">' + (h ? h : "") + '</span><div class="sb-track"><span class="goal"></span><span class="sb-bar' + (h && h < 7 ? " low" : "") + '" style="height:' + (h ? Math.min(100, h / 10 * 100) : 0) + '%"></span></div><span class="sb-day">' + esc(dayShort(x)) + "</span></div>";
    }).join("") + "</div>" : "";
    return '<section class="card"><h2 class="card-h">' + esc(t("r_sleep")) + " · " + esc(t("r_last_night")) + "</h2>" +
      '<form class="form inline" data-form="sleep">' + timeSelect("bed", s.bed, t("r_bed")) + timeSelect("wake", s.wake, t("r_wake")) + '<button type="submit" class="btn">' + esc(t("save")) + "</button></form>" +
      (sl ? '<p class="big-num">' + esc(t("r_sleep_hours", { h: sl })) + "</p>" + (sl < 7 ? '<p class="warn">' + esc(t("r_sleep_low")) + "</p>" : "") : "") +
      '<h3 class="sub-h">' + esc(logged.length ? t("r_sleep_week", { h: avg }) : t("r_sleep_none")) + "</h3>" + bars +
      '<p class="note">' + esc(t("r_sleep_goal")) + "</p></section>";
  }
  function waterCard() {
    var w = S.water[today()] || 0, g = CFG.WATER_GOAL || 8;
    return '<section class="card"><h2 class="card-h">' + esc(t("r_water")) + '</h2><div class="row gap"><button type="button" class="icon-btn lg" data-act="water" data-v="-1" aria-label="−1">−</button><b class="big-num">' + esc(t("r_glasses", { n: w, g: g })) + '</b><button type="button" class="icon-btn lg" data-act="water" data-v="1" aria-label="+1">+</button></div><div class="bar"><span style="width:' + Math.min(100, w / g * 100) + '%"></span></div></section>';
  }
  function foodCard() {
    var d = today(), c = calorieInfo(), meals = S.meals[d] || [], body;
    if (!S.track) {
      body = '<p class="muted">' + esc(t("r_setup_note")) + '</p><button type="button" class="btn ghost" data-act="track-on">' + esc(t("r_track")) + "</button>";
    } else if (!S.profile) {
      body = UI.showBody ? '<p class="note">' + esc(t("r_setup_note")) + "</p>" + profileForm("body") :
        '<p class="muted">' + esc(t("r_setup_note")) + '</p><button type="button" class="btn" data-act="show-body">' + esc(t("r_setup_body")) + "</button>";
    } else if (c.blocked) {
      body = '<p class="warn">' + esc(t("r_blocked")) + "</p>";
    } else {
      var pct = Math.min(100, Math.round((c.eaten / c.target) * 100));
      var opts = ["breakfast", "lunch", "dinner", "snack"].map(function (ty) {
        return DATA.meals.filter(function (m) { return m.type === ty; }).map(function (m) { return '<option value="' + m.id + '">' + esc(mealName(m) + (S.hideNumbers ? "" : " · ~" + m.kcal + " kcal")) + "</option>"; }).join("");
      }).join("");
      body = (S.hideNumbers ? '<p class="muted">' + esc(t("r_hidden_numbers")) + "</p>" :
        '<div class="stats"><div><span>' + esc(t("r_target")) + "</span><b>" + num(c.target) + "</b></div><div><span>" + esc(t("r_eaten")) + "</span><b>" + num(c.eaten) + "</b></div><div><span>" + esc(t("r_left")) + "</span><b>" + num(c.left) + '</b></div></div><div class="bar"><span style="width:' + pct + '%"></span></div>') +
        '<form class="form" data-form="meal"><label class="field"><span>' + esc(t("r_add_meal")) + '</span><select name="pick"><option value="">' + esc(t("r_pick_meal")) + "</option>" + opts + '<option value="custom">' + esc(t("r_custom")) + "</option></select></label>" +
        '<div class="form inline custom-meal' + (UI.drafts["meal.pick"] === "custom" ? "" : " hidden") + '"><input name="name" maxlength="60" placeholder="' + esc(t("r_meal_name")) + '" aria-label="' + esc(t("r_meal_name")) + '"><input name="kcal" type="number" inputmode="numeric" min="0" max="3000" placeholder="' + esc(t("r_meal_kcal")) + '" aria-label="' + esc(t("r_meal_kcal")) + '"></div>' +
        '<button type="submit" class="btn">' + esc(t("add")) + "</button></form>" +
        (meals.length ? '<ul class="list">' + meals.map(function (m, i) { return '<li class="item">' + itemButton("meal", d + "|" + i, '<span class="grow">' + esc(m.name) + "</span>" + (S.hideNumbers ? "" : '<span class="muted">' + num(m.kcal) + " kcal</span>")) + "</li>"; }).join("") + "</ul>" : "") +
        '<div class="row gap wrap"><button type="button" class="ask" data-act="ai" data-v="meal"><span>' + esc(t("r_suggest")) + '</span><span class="cost">' + esc(t("ai_cost", { n: DATA.cost.standard })) + "</span></button></div>" +
        '<label class="check"><input type="checkbox" data-act="hide-numbers"' + (S.hideNumbers ? " checked" : "") + "> <span>" + esc(t("r_hide_numbers")) + "</span></label>" +
        '<p class="note">' + esc(t("r_formula")) + " " + esc(t("r_floor", { n: num(c.floor) })) + "</p>";
    }
    return '<section class="card" id="food-card"><h2 class="card-h">' + esc(t("r_food")) + "</h2>" + body + "</section>";
  }

  // ---------- Mode screens ----------
  function scrMode() {
    var head = '<p class="eyebrow" style="--c:' + DATA.modes[S.active].accent + '">' + icon(DATA.modes[S.active].icon, 14) + esc(t("mode_" + S.active)) + "</p>";
    return head + { office: modeOffice, home: modeHome, freelancer: modeFreelancer, artist: modeArtist }[S.active]();
  }
  function modeOffice() {
    var f = UI.found;
    var sel = f ? f.filter(function (x) { return x.on; }).length : 0;
    return '<h1 class="h1">' + esc(t("o_title")) + '</h1><p class="sub">' + esc(t("o_desc")) + "</p>" +
      '<section class="card"><textarea id="inbox" data-key="inbox" rows="6" placeholder="' + esc(t("o_placeholder")) + '" aria-label="' + esc(t("o_title")) + '">' + esc(UI.inboxText) + '</textarea><button type="button" class="btn" data-act="scan">' + esc(t("o_scan")) + "</button></section>" +
      (f ? '<section class="card"><h2 class="card-h">' + esc(f.length ? t("o_found", { n: f.length }) : t("o_none")) + "</h2>" +
        (f.length ? '<ul class="list">' + f.map(function (x, i) {
          return '<li class="item found"><input type="checkbox" data-act="found-toggle" data-i="' + i + '"' + (x.on ? " checked" : "") + ' aria-label="' + esc(x.title) + '"><div class="grow"><input type="text" class="found-title" data-act="found-title" data-i="' + i + '" value="' + esc(x.title) + '" aria-label="' + esc(t("task_title")) + '"><span class="muted small">' + esc((x.date && x.time ? t("o_event") : t("o_task")) + (x.date ? " · " + dayLabel(x.date) : "") + (x.time ? " · " + x.time : "")) + "</span></div></li>";
        }).join("") + '</ul><button type="button" class="btn" data-act="add-found"' + (sel ? "" : " disabled") + ">" + esc(t("o_add_sel", { n: sel })) + "</button>" : "") + "</section>" : "");
  }
  function modeHome() {
    if (!S.mealPlan.length) { S.mealPlan = newWeek(); save(); }
    var days = t("days"), ti = weekdayIndex(today()), items = groceryItems();
    var left = items.filter(function (k) { return !S.grocery[k]; }).length;
    return '<h1 class="h1">' + esc(t("h_title")) + "</h1>" +
      '<section class="card"><ul class="list">' + S.mealPlan.map(function (id, i) {
        var m = meal(id);
        return '<li class="item' + (i === ti ? " tonight" : "") + '"><span class="time">' + esc(days[i]) + '</span><span class="grow">' + esc(mealName(m)) + (i === ti ? ' <span class="pill ok">' + esc(t("h_tonight")) + "</span>" : "") + (S.hideNumbers ? "" : ' <span class="muted small">~' + m.kcal + " kcal</span>") + '</span><button type="button" class="mini" data-act="swap" data-i="' + i + '">' + esc(t("h_swap")) + "</button></li>";
      }).join("") + '</ul><button type="button" class="btn ghost" data-act="shuffle">' + esc(t("h_shuffle")) + "</button></section>" +
      '<section class="card"><div class="row between"><h2 class="card-h">' + esc(t("h_grocery")) + '</h2><span class="muted small">' + esc(t("h_left", { n: left })) + '</span></div><p class="note">' + esc(t("h_grocery_note")) + '</p><ul class="list">' + items.map(function (k) {
        var on = !!S.grocery[k];
        return '<li class="item"><button type="button" class="box' + (on ? " on" : "") + '" data-act="grocery" data-k="' + k + '" aria-pressed="' + on + '" aria-label="' + esc(ingName(k)) + '">' + (on ? icon("check", 14) : "") + '</button><span class="grow' + (on ? " struck" : "") + '">' + esc(ingName(k)) + "</span></li>";
      }).join("") + "</ul></section>";
  }
  function modeFreelancer() {
    var st = t("f_stages");
    var sum = [0, 0, 0, 0]; S.quotes.forEach(function (q) { sum[q.stage] += +q.amount || 0; });
    return '<h1 class="h1">' + esc(t("f_title")) + "</h1>" +
      '<div class="stats card"><div><span>' + esc(t("f_pipeline")) + "</span><b>" + money(sum[0] + sum[1]) + "</b></div><div><span>" + esc(t("f_owed")) + "</span><b>" + money(sum[2]) + "</b></div><div><span>" + esc(t("f_paid")) + "</span><b>" + money(sum[3]) + "</b></div></div>" +
      '<form class="card form inline" data-form="quote"><input name="client" required maxlength="60" placeholder="' + esc(t("f_client")) + '" aria-label="' + esc(t("f_client")) + '"><input name="service" maxlength="60" placeholder="' + esc(t("f_service")) + '" aria-label="' + esc(t("f_service")) + '"><input name="amount" type="number" inputmode="numeric" min="0" required placeholder="' + esc(t("f_amount") + " (" + S.currency + ")") + '" aria-label="' + esc(t("f_amount")) + '"><button type="submit" class="btn">' + esc(t("f_add")) + "</button></form>" +
      '<p class="note">' + esc(t("tap_to_edit")) + '</p><div class="board">' + st.map(function (name, i) {
        var qs = S.quotes.filter(function (q) { return q.stage === i; });
        return '<section class="col"><h2 class="col-h">' + esc(name) + " <span>" + qs.length + "</span></h2>" + qs.map(function (q) {
          return '<div class="tile">' + itemButton("quote", q.id, "<b>" + esc(q.client) + '</b><span class="muted small">' + esc(q.service) + "</span><span>" + money(q.amount) + "</span>") + (i < 3 ? '<button type="button" class="mini" data-act="advance" data-id="' + q.id + '">→ ' + esc(st[i + 1]) + "</button>" : "") + "</div>";
        }).join("") + "</section>";
      }).join("") + "</div>";
  }
  function modeArtist() {
    var gigs = S.gigs.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var up = gigs.filter(function (g) { return g.date >= today(); }), past = gigs.filter(function (g) { return g.date < today(); }).reverse();
    var upcoming = up.reduce(function (a, g) { return a + (+g.fee || 0); }, 0);
    var row = function (g) {
      var status = g.fullPaid ? t("a_fully_paid") : (g.deposit > 0 ? (g.depPaid ? t("a_dep_paid") : t("a_dep_unpaid")) : "");
      return '<li class="item col-item">' + itemButton("gig", g.id, '<span class="time">' + esc(dayLabel(g.date)) + '</span><b class="grow">' + esc(g.venue) + "</b><span>" + money(g.fee) + "</span>") + '<div class="row gap wrap">' +
        (status ? '<span class="pill' + (g.fullPaid || g.depPaid ? " ok" : " bad") + '">' + esc(status) + "</span>" : "") +
        (!g.fullPaid && g.deposit > 0 && !g.depPaid ? '<button type="button" class="mini" data-act="dep-paid" data-id="' + g.id + '">✓ ' + esc(t("a_mark_paid")) + "</button>" : "") +
        (!g.fullPaid ? '<button type="button" class="mini" data-act="full-paid" data-id="' + g.id + '">✓ ' + esc(t("a_mark_full")) + "</button>" : "") + "</div></li>";
    };
    return '<h1 class="h1">' + esc(t("a_title")) + "</h1>" +
      '<div class="stats card"><div><span>' + esc(t("a_upcoming")) + "</span><b>" + money(upcoming) + "</b></div><div><span>" + esc(t("a_owed")) + "</span><b>" + money(artistOwed()) + "</b></div></div>" +
      '<form class="card form inline" data-form="gig"><input name="venue" required maxlength="60" placeholder="' + esc(t("a_venue")) + '" aria-label="' + esc(t("a_venue")) + '"><input name="date" type="date" required value="' + today() + '" aria-label="' + esc(t("a_date")) + '"><input name="fee" type="number" inputmode="numeric" min="0" required placeholder="' + esc(t("a_fee") + " (" + S.currency + ")") + '" aria-label="' + esc(t("a_fee")) + '"><input name="deposit" type="number" inputmode="numeric" min="0" placeholder="' + esc(t("a_deposit")) + '" aria-label="' + esc(t("a_deposit")) + '"><button type="submit" class="btn">' + esc(t("a_add")) + "</button></form>" +
      '<section class="card"><ul class="list">' + (up.length ? up.map(row).join("") : '<li class="muted">' + esc(t("brief_artist_none")) + "</li>") + "</ul></section>" +
      (past.length ? '<h2 class="h2">' + esc(t("a_past")) + '</h2><section class="card"><ul class="list">' + past.map(row).join("") + "</ul></section>" : "");
  }

  // ---------- More ----------
  function scrMore() {
    var survey = CFG.SURVEY_FORM_URL, wait = CFG.WAITLIST_FORM_URL, claimed = S.lastBonus === today();
    var feedback = (survey || wait) ? '<h1 class="h1">' + esc(t("m_feedback")) + '</h1><p class="sub">' + esc(t("m_feedback_desc")) + '</p><section class="card"><div class="row gap wrap">' +
      (survey ? '<a class="btn" href="' + esc(survey) + '" target="_blank" rel="noopener">' + esc(t("m_survey")) + "</a>" : "") + (wait ? '<a class="btn ghost" href="' + esc(wait) + '" target="_blank" rel="noopener">' + esc(t("m_waitlist")) + "</a>" : "") + "</div>" +
      (survey ? '<iframe class="form-frame" src="' + esc(survey.indexOf("embedded=true") > -1 ? survey : survey + (survey.indexOf("?") > -1 ? "&" : "?") + "embedded=true") + '" title="' + esc(t("m_survey")) + '" loading="lazy"></iframe>' : "") + "</section>" : "";
    var currencies = ["USD", "GBP", "EUR", "VND"];
    return feedback +
      '<h1 class="h1">' + esc(t("m_settings")) + "</h1>" +
      '<section class="card"><h2 class="card-h">' + icon("spark", 16) + esc(t("credits_title")) + " · " + S.credits + '</h2><p>' + esc(t("credits_what")) + '</p><p class="note">' + esc(t("credits_costs")) + '</p><p class="note">' + esc(t("credits_test")) + "</p>" +
      '<button type="button" class="btn' + (claimed ? " ghost" : "") + '" data-act="bonus"' + (claimed ? " disabled" : "") + ">" + esc(claimed ? t("daily_claimed") : t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + "</button></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_language")) + " & " + esc(t("m_currency")) + '</h2><div class="row gap wrap"><div class="seg"><button type="button" class="' + (S.lang === "en" ? "on" : "") + '" data-act="set-lang" data-v="en" aria-pressed="' + (S.lang === "en") + '">English</button><button type="button" class="' + (S.lang === "vi" ? "on" : "") + '" data-act="set-lang" data-v="vi" aria-pressed="' + (S.lang === "vi") + '">Tiếng Việt</button></div>' +
      '<label class="sel-wrap" aria-label="' + esc(t("m_currency")) + '"><select data-act="currency">' + currencies.map(function (c) { return '<option value="' + c + '"' + (S.currency === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label></div></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_modes")) + "</h2>" + DATA.modeOrder.map(function (m) {
        var on = S.modes.indexOf(m) > -1;
        return '<label class="check mode-toggle" style="--c:' + DATA.modes[m].accent + '"><input type="checkbox" data-act="toggle-mode" data-v="' + m + '"' + (on ? " checked" : "") + (m === "office" ? " disabled" : "") + "> <span><b>" + esc(t("mode_" + m)) + '</b><br><span class="muted small">' + esc(t("mode_" + m + "_desc")) + "</span></span></label>";
      }).join("") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_profile")) + '</h2><label class="check"><input type="checkbox" data-act="toggle-track"' + (S.track ? " checked" : "") + "> <span>" + esc(t("r_track")) + "</span></label>" + (S.track ? profileForm("body") : "") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_samples")) + '</h2><p class="note">' + esc(t("m_samples_note")) + "</p>" + sampleCards() + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_data")) + '</h2><p class="note">' + esc(t("m_data_note")) + '</p><div class="row gap wrap"><button type="button" class="btn ghost" data-act="export">' + esc(t("m_export")) + '</button><label class="btn ghost file-btn">' + esc(t("m_import")) + '<input type="file" accept=".json,application/json" data-act="import"></label><button type="button" class="btn danger" data-act="reset">' + esc(t("m_reset")) + '</button></div><p class="note">' + esc(t("m_install")) + "</p></section>" +
      '<p class="note center">' + esc(t("m_about")) + "</p>";
  }

  // ---------- modals ----------
  function modal() {
    var M = UI.modal; if (!M) return "";
    var title = M.title, inner = "";
    if (M.kind === "ai") inner = '<div class="ai-text">' + M.html + "</div>" + (M.spent ? '<p class="note">' + esc(t("ai_spent", { n: M.spent })) + "</p>" : "");
    if (M.kind === "credits") {
      var claimed = S.lastBonus === today();
      title = t("credits_title") + " · " + S.credits;
      inner = "<p>" + esc(t("credits_what")) + '</p><p class="note">' + esc(t("credits_costs")) + '</p><p class="note">' + esc(t("credits_test")) + "</p>" +
        '<button type="button" class="btn full' + (claimed ? " ghost" : "") + '" data-act="bonus"' + (claimed ? " disabled" : "") + ">" + esc(claimed ? t("daily_claimed") : t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + "</button>";
    }
    if (M.kind === "samples") { title = t("m_samples"); inner = '<p class="note">' + esc(t("m_samples_note")) + "</p>" + sampleCards(); }
    if (M.kind === "edit") { var e = editForm(M.type, M.id); if (!e) return ""; title = e.title; inner = e.html; }
    return '<div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="row between"><h2 class="card-h" id="modal-title">' + (M.kind === "ai" ? icon("spark", 16) : "") + esc(title) + '</h2><button type="button" class="icon-btn" data-act="close-modal" aria-label="' + esc(t("close")) + '">' + icon("x", 18) + "</button></div>" + inner + "</div></div>";
  }
  function openModal(m) { UI.modal = m; UI.modalJustOpened = true; render(); }

  function getItem(type, id) {
    if (type === "task") return findById(S.tasks, id);
    if (type === "event") return findById(S.events, id);
    if (type === "quote") return findById(S.quotes, id);
    if (type === "gig") return findById(S.gigs, id);
    if (type === "meal") { var p = id.split("|"); return (S.meals[p[0]] || [])[+p[1]]; }
  }
  function editForm(type, id) {
    var x = getItem(type, id); if (!x) return null;
    var f = function (label, inner) { return '<label class="field"><span>' + esc(label) + "</span>" + inner + "</label>"; };
    var inp = function (name, val, extra) { return '<input name="' + name + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || "") + ">"; };
    var chk = function (name, on, label) { return '<label class="check"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + "> <span>" + esc(label) + "</span></label>"; };
    var body = "", title = t("edit");
    if (type === "task") body = f(t("task_title"), inp("title", x.title, 'required maxlength="100"')) + '<div class="grid2">' + f(t("due"), inp("due", x.due, 'type="date"')) + f(t("mode_label"), modeSelect("mode", x.mode)) + "</div>" + chk("done", x.done, t("done"));
    if (type === "event") body = f(t("ev_title"), inp("title", x.title, 'required maxlength="80"')) + '<div class="grid2">' + f(t("ev_date"), inp("date", x.date, 'type="date" required')) + f(t("ev_time"), inp("time", x.time, 'type="time"')) + "</div>" + f(t("mode_label"), modeSelect("mode", x.mode));
    if (type === "quote") body = f(t("f_client"), inp("client", x.client, 'required maxlength="60"')) + f(t("f_service"), inp("service", x.service, 'maxlength="60"')) + '<div class="grid2">' + f(t("f_amount") + " (" + S.currency + ")", inp("amount", x.amount, 'type="number" min="0" required')) +
      f(t("f_stage"), '<select name="stage">' + t("f_stages").map(function (s, i) { return '<option value="' + i + '"' + (i === x.stage ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>") + "</div>";
    if (type === "gig") body = f(t("a_venue"), inp("venue", x.venue, 'required maxlength="60"')) + f(t("a_date"), inp("date", x.date, 'type="date" required')) + '<div class="grid2">' + f(t("a_fee") + " (" + S.currency + ")", inp("fee", x.fee, 'type="number" min="0" required')) + f(t("a_deposit"), inp("deposit", x.deposit, 'type="number" min="0"')) + "</div>" + chk("depPaid", x.depPaid, t("a_dep_paid")) + chk("fullPaid", x.fullPaid, t("a_fully_paid"));
    if (type === "meal") body = f(t("r_meal_name"), inp("name", x.name, 'required maxlength="60"')) + f(t("r_meal_kcal"), inp("kcal", x.kcal, 'type="number" min="0" max="3000" required'));
    return { title: title, html: '<form class="form" data-form="edit">' + body + '<div class="row between wrap"><button type="button" class="btn danger" data-act="delete">' + esc(t("delete")) + '</button><div class="row gap"><button type="button" class="btn ghost" data-act="close-modal">' + esc(t("cancel")) + '</button><button type="submit" class="btn">' + esc(t("save")) + "</button></div></div></form>" };
  }
  function saveEdit(fd) {
    var M = UI.modal, x = getItem(M.type, M.id); if (!x) return;
    var g = function (k) { return (fd.get(k) || "").toString().trim(); };
    if (M.type === "task") { x.title = g("title"); x.due = g("due"); x.mode = g("mode") || x.mode; x.done = fd.get("done") === "on"; }
    if (M.type === "event") { x.title = g("title"); x.date = g("date"); x.time = g("time"); x.mode = g("mode") || x.mode; }
    if (M.type === "quote") { x.client = g("client"); x.service = g("service"); x.amount = +g("amount") || 0; x.stage = +g("stage") || 0; }
    if (M.type === "gig") { x.venue = g("venue"); x.date = g("date"); x.fee = +g("fee") || 0; x.deposit = +g("deposit") || 0; x.depPaid = fd.get("depPaid") === "on"; x.fullPaid = fd.get("fullPaid") === "on"; if (x.fullPaid) x.depPaid = true; }
    if (M.type === "meal") { x.name = g("name"); x.kcal = +g("kcal") || 0; }
    UI.modal = null; clearDrafts("edit"); save(); render(); toast(t("saved"));
  }
  function deleteItem(type, id) {
    var list, idx, item, date;
    if (type === "meal") { var p = id.split("|"); date = p[0]; list = S.meals[date] || []; idx = +p[1]; }
    else { list = { task: S.tasks, event: S.events, quote: S.quotes, gig: S.gigs }[type]; idx = list.indexOf(findById(list, id)); }
    if (idx < 0 || !list[idx]) return;
    item = list.splice(idx, 1)[0];
    UI.undo = { type: type, item: item, idx: idx, date: date };
    UI.modal = null; clearDrafts("edit"); save(); render();
    toast(t("deleted"), t("undo"));
  }
  function undoDelete() {
    var u = UI.undo; if (!u) return;
    var list = u.type === "meal" ? (S.meals[u.date] = S.meals[u.date] || []) : { task: S.tasks, event: S.events, quote: S.quotes, gig: S.gigs }[u.type];
    list.splice(Math.min(u.idx, list.length), 0, u.item);
    UI.undo = null; save(); render(); toast(t("saved"));
  }

  // ---------- assistant (offline) ----------
  function aiLocal(task) {
    var L = function (arr) { return "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    if (task === "plan") {
      var evs = S.events.filter(function (e) { return e.date === today(); }).sort(byTime);
      var open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue);
      var items = evs.map(function (e) { return (e.time || "—") + "  " + e.title; });
      open.slice(0, 3).forEach(function (x) { items.push("☐ " + x.title); });
      var html = items.length ? "<p>" + esc(t("ai_r_plan_head")) + "</p>" + L(items) : "<p>" + esc(t("ai_r_plan_none")) + "</p>";
      return html + energyInsightLines().map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("");
    }
    if (task === "meal") {
      var c = calorieInfo(); var h = new Date().getHours();
      var type = h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack";
      var pool = DATA.meals.filter(function (m) { return m.type === type || (type === "lunch" && m.type === "dinner") || (type === "dinner" && m.type === "lunch"); });
      if (c && !c.blocked) { var fit = pool.filter(function (m) { return m.kcal <= Math.max(c.left, 250); }); pool = fit.length ? fit : DATA.meals.filter(function (m) { return m.type === "snack"; }); }
      pool = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
      var head = c && !c.blocked && !S.hideNumbers ? t("ai_r_meal_head", { n: num(c.left) }) : t("ai_r_meal_free");
      return "<p>" + esc(head) + "</p>" + L(pool.map(function (m) { return mealName(m) + (S.hideNumbers ? "" : " (~" + m.kcal + " kcal)"); })) + '<p class="note">' + esc(t("r_formula")) + "</p>";
    }
    if (task === "money") {
      var rows = [];
      if (S.modes.indexOf("freelancer") > -1) S.quotes.filter(function (q) { return q.stage === 2; }).forEach(function (q) { rows.push(q.client + " — " + money(q.amount)); });
      if (S.modes.indexOf("artist") > -1) S.gigs.filter(function (g) { return !g.fullPaid && (g.date < today() || (g.deposit > 0 && !g.depPaid)); }).forEach(function (g) {
        rows.push(g.venue + " — " + money(g.date < today() ? gigOwed(g) : g.deposit));
      });
      return rows.length ? "<p>" + esc(t("ai_r_money_head")) + "</p>" + L(rows) : "<p>" + esc(t("ai_r_money_none")) + "</p>";
    }
    if (task === "groceries") return "<p>" + esc(t("ai_r_groceries", { n: groceryItems().length })) + "</p>";
    return "";
  }
  function runAI(task) {
    track("ai_" + task);
    if (task === "inbox") { UI.tab = "mode"; UI.focusKey = "inbox"; render(); window.scrollTo(0, 0); return; }
    var cost = DATA.cost.standard;
    if (S.credits < cost) { toast(t("ai_not_enough")); openModal({ kind: "credits" }); return; }
    var title = t("ai_" + task);
    var finish = function (html) {
      S.credits -= cost; save();
      if (task === "groceries") UI.tab = "mode";
      openModal({ kind: "ai", title: title, html: html, spent: cost });
    };
    if (CFG.AI_ENDPOINT) {
      fetch(CFG.AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: task, mode: S.active, lang: S.lang, context: { events: S.events.filter(function (e) { return e.date === today(); }), tasks: S.tasks.filter(function (x) { return !x.done; }).slice(0, 20), calories: calorieInfo() } }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { finish("<p>" + esc(j.text || "").replace(/\n/g, "<br>") + "</p>"); })
        .catch(function () { finish(aiLocal(task)); });
    } else finish(aiLocal(task));
  }

  // ---------- inbox parser (rule-based, free) ----------
  var ACTION = /\b(send|call|book|review|prepare|pay|email|meet|schedule|submit|finish|check|buy|update|reply|confirm|draft|share|fix|sign|order|plan|organi[sz]e|remind|follow up|deliver|upload|print|pick up|bring)\b|gửi|gọi|đặt|chuẩn bị|nộp|thanh toán|đóng tiền|họp|kiểm tra|mua|cập nhật|hoàn thành|trả lời|xác nhận|soạn|sửa|ký|nhắc|giao|in |đón|mang|lên kế hoạch|làm/i;
  var NOISE = /^(hi|hello|hey|dear|thanks|thank you|many thanks|cheers|best|regards|kind regards|sincerely|chào|xin chào|cảm ơn|cám ơn|thân|trân trọng|em cảm ơn|ok|okay)\b/i;
  function parseInbox(text) {
    var out = [];
    var wd = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    var viwd = { "chủ nhật": 0, "thứ hai": 1, "thứ 2": 1, "thứ ba": 2, "thứ 3": 2, "thứ tư": 3, "thứ 4": 3, "thứ năm": 4, "thứ 5": 4, "thứ sáu": 5, "thứ 6": 5, "thứ bảy": 6, "thứ 7": 6 };
    function nextWeekday(n) { var d = new Date(); var diff = (n - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); return iso(d); }
    text.replace(/\r/g, "").replace(/([.!?;])\s+/g, "$1\n").replace(/\s(also|and then|plus|ngoài ra|thêm nữa|còn nữa)\s/gi, "\n$1 ").split(/\n+/).forEach(function (raw) {
      var s = raw.trim().replace(/^[-•*\d.)\s]+/, ""); if (!s) return;
      var l = s.toLowerCase();
      if (NOISE.test(l) && !ACTION.test(l)) return;
      if (s.split(/\s+/).length < 3) return;
      var date = "", time = "", rm = [];
      if (/\btoday\b|hôm nay/.test(l)) { date = today(); rm.push(/\b(by |on )?today\b|(trong )?hôm nay/gi); }
      else if (/\btomorrow\b|ngày mai|\bmai\b/.test(l)) { date = addDays(today(), 1); rm.push(/\b(by |on )?tomorrow\b|(sáng |chiều |tối )?(ngày )?mai\b/gi); }
      else {
        Object.keys(viwd).forEach(function (k) { if (!date && l.indexOf(k) > -1) { date = nextWeekday(viwd[k]); rm.push(new RegExp("(trước |vào |hạn )?" + k, "gi")); } });
        Object.keys(wd).forEach(function (k) { if (!date && new RegExp("\\b" + k + "\\b").test(l)) { date = nextWeekday(wd[k]); rm.push(new RegExp("\\b(by |on |before |this |next )?" + k + "\\b", "gi")); } });
      }
      var dm = l.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (!date && dm) { var y = dm[3] ? (dm[3].length === 2 ? "20" + dm[3] : dm[3]) : new Date().getFullYear(); var a = +dm[1], b = +dm[2]; var dd = S.lang === "vi" ? a : b, mm = S.lang === "vi" ? b : a; if (dd <= 31 && mm <= 12) { date = y + "-" + pad(mm) + "-" + pad(dd); rm.push(/\b(by |on |before |trước |ngày )?\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/gi); } }
      var tm = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || l.match(/\b(\d{1,2}):(\d{2})\b/) || l.match(/\b(\d{1,2})\s*(?:h|giờ)\s*(\d{2})?\b/);
      if (tm) { var hh = +tm[1], mi = tm[2] ? +tm[2] : 0; if (tm[3] === "pm" && hh < 12) hh += 12; if (tm[3] === "am" && hh === 12) hh = 0; if (hh < 24 && mi < 60) { time = pad(hh) + ":" + pad(mi); rm.push(/\b(at |by |lúc |vào )?\d{1,2}(:\d{2})?\s*(am|pm|h|giờ)?\s*(\d{2})?\b/gi); } }
      if (!ACTION.test(l) && !date && !time) return;
      var title = s;
      rm.forEach(function (r) { title = title.replace(r, " "); });
      title = title.replace(/^(hi|hello|hey|dear|chào)[^,]*,\s*/i, "").replace(/^(also|and|please|can you|could you|would you|pls|nhờ|làm ơn|bạn ơi|anh ơi|chị ơi|em)\s+/i, "").replace(/^(please|nhé)\s+/i, "")
        .replace(/\s*(nhé|nha|giúp|please|thanks)\s*[?.!]*$/i, "").replace(/[?!.,;:]+$/, "").replace(/\s{2,}/g, " ").trim();
      if (title.length < 3) return;
      title = title.charAt(0).toUpperCase() + title.slice(1);
      if (title.length > 90) title = title.slice(0, 87) + "…";
      out.push({ title: title, date: date, time: time, on: true });
    });
    return out;
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(msg, action) {
    var el = document.getElementById("toast"); if (!el) return;
    el.innerHTML = "<span>" + esc(msg) + "</span>" + (action ? '<button type="button" class="toast-btn" data-act="undo">' + esc(action) + "</button>" : "");
    el.classList.toggle("has-action", !!action);
    el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); el.classList.remove("has-action"); if (action) UI.undo = null; }, action ? 6000 : 2600);
  }

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "SELECT") return;
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v"), id = el.getAttribute("data-id");
    if (act === "close-modal") { if (el.classList.contains("modal-bg") && e.target.closest("[data-stop]")) return; UI.modal = null; clearDrafts("edit"); render(); return; }
    switch (act) {
      case "lang": if (!S.onboarded) { var n0 = document.getElementById("ob-name"); if (n0) S.name = n0.value.trim(); } S.lang = S.lang === "vi" ? "en" : "vi"; break;
      case "set-lang": S.lang = v; break;
      case "ob-next": var nm = document.getElementById("ob-name"); S.name = nm ? nm.value.trim() : ""; UI.ob = 1; render(); track("onboarding_step2"); return;
      case "ob-back": UI.ob = 0; render(); return;
      case "ob-demo": var nm2 = document.getElementById("ob-name"); if (nm2) S.name = nm2.value.trim(); UI.ob = "demo"; render(); return;
      case "ob-mode": UI.obModes[v] = !UI.obModes[v]; render(); return;
      case "ob-finish":
        S.modes = DATA.modeOrder.filter(function (m) { return m === "office" || UI.obModes[m]; });
        S.active = S.modes[S.modes.length > 1 ? 1 : 0]; S.onboarded = true; S.tips = { welcome: true };
        save(); UI.tab = "today"; UI.enter = true; render(); track("onboarding_done"); return;
      case "sample": if (S.onboarded && !window.confirm(t("sample_confirm"))) return; loadSample(v); return;
      case "open-samples": openModal({ kind: "samples" }); return;
      case "hide-welcome": S.tips.welcome = false; break;
      case "gs-task": UI.focusKey = "qtask.title"; render(); var q = app.querySelector('[data-key="qtask.title"]'); if (q) { q.scrollIntoView({ block: "center" }); q.focus(); } return;
      case "gs-energy": var ec = document.getElementById("energy-card"); if (ec) ec.scrollIntoView({ block: "center", behavior: "smooth" }); return;
      case "gs-food": UI.tab = "routine"; UI.showBody = true; S.track = true; save(); render(); var fc = document.getElementById("food-card"); if (fc) fc.scrollIntoView({ block: "start" }); return;
      case "mode": S.active = v; UI.enter = true; track("mode_" + v); break;
      case "tab": UI.tab = v; UI.modal = null; UI.enter = true; window.scrollTo(0, 0); track("tab_" + v); break;
      case "plan-tab": UI.planTab = v; break;
      case "credits": openModal({ kind: "credits" }); return;
      case "bonus":
        if (S.lastBonus === today()) { toast(t("daily_claimed")); return; }
        S.lastBonus = today(); S.credits += CFG.DAILY_BONUS || 2; save(); render(); toast(t("daily_bonus", { n: CFG.DAILY_BONUS || 2 }) + " ✓"); track("daily_bonus"); return;
      case "energy": setEnergy(el.getAttribute("data-slot"), +v); return;
      case "toggle-task": var tk = findById(S.tasks, id); if (tk) tk.done = !tk.done; break;
      case "edit": openModal({ kind: "edit", type: el.getAttribute("data-type"), id: id }); return;
      case "delete": deleteItem(UI.modal.type, UI.modal.id); return;
      case "undo": undoDelete(); return;
      case "water": S.water[today()] = Math.max(0, (S.water[today()] || 0) + (+v)); break;
      case "track-on": S.track = true; UI.showBody = true; break;
      case "show-body": UI.showBody = true; break;
      case "ai": runAI(v); return;
      case "scan": var ta = document.getElementById("inbox"); UI.inboxText = ta ? ta.value : ""; UI.found = parseInbox(UI.inboxText); render(); track("inbox_scan"); return;
      case "add-found":
        var added = 0;
        (UI.found || []).forEach(function (f) {
          if (!f.on || !f.title.trim()) return; added++;
          if (f.date && f.time) S.events.push({ id: uid(), title: f.title.trim(), date: f.date, time: f.time, mode: "office" });
          else S.tasks.push({ id: uid(), title: f.title.trim(), done: false, mode: "office", due: f.date || "" });
        });
        UI.found = null; UI.inboxText = ""; save(); render(); toast(t("o_added", { n: added })); track("inbox_add"); return;
      case "shuffle": S.mealPlan = newWeek(); S.grocery = {}; break;
      case "swap":
        var i = +el.getAttribute("data-i"), pool = dinnerPool().filter(function (x) { return S.mealPlan.indexOf(x) < 0; });
        if (pool.length) S.mealPlan[i] = pool[Math.floor(Math.random() * pool.length)];
        break;
      case "grocery": var k = el.getAttribute("data-k"); S.grocery[k] = !S.grocery[k]; break;
      case "advance": var qq = findById(S.quotes, id); if (qq && qq.stage < 3) qq.stage++; break;
      case "dep-paid": var g = findById(S.gigs, id); if (g) g.depPaid = true; break;
      case "full-paid": var g2 = findById(S.gigs, id); if (g2) { g2.fullPaid = true; g2.depPaid = true; } break;
      case "export":
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
        var a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob); a2.download = "dahand-data-" + today() + ".json"; document.body.appendChild(a2); a2.click(); a2.remove(); return;
      case "reset":
        if (window.confirm(t("m_reset_confirm"))) { try { localStorage.removeItem(KEY); } catch (er) { /* ignore */ } var lang = S.lang; S = fresh(); S.lang = lang; UI.ob = 0; UI.tab = "today"; UI.drafts = {}; render(); } return;
      default: return;
    }
    save(); render();
  });

  document.addEventListener("change", function (e) {
    var el = e.target, act = el.getAttribute && el.getAttribute("data-act");
    if (el.form && el.form.getAttribute("data-form") && el.name) {
      UI.drafts[el.form.getAttribute("data-form") + "." + el.name] = el.type === "checkbox" ? el.checked : el.value;
      if (el.form.getAttribute("data-form") === "meal" && el.name === "pick") { var cm = el.form.querySelector(".custom-meal"); if (cm) cm.classList.toggle("hidden", el.value !== "custom"); }
    }
    if (!act) return;
    if (act === "import") {
      var file = el.files && el.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== "object" || !Array.isArray(obj.events) || !Array.isArray(obj.tasks)) throw new Error("bad");
          S = migrate(Object.assign({}, obj, { onboarded: true })); save(); UI.tab = "today"; render(); toast(t("import_ok")); track("import");
        } catch (er) { toast(t("import_bad")); }
      };
      reader.readAsText(file); return;
    }
    if (act === "found-toggle") { UI.found[+el.getAttribute("data-i")].on = el.checked; render(); return; }
    if (act === "show-done") UI.showDone = el.checked;
    if (act === "hide-numbers") S.hideNumbers = el.checked;
    if (act === "toggle-track") S.track = el.checked;
    if (act === "currency") S.currency = el.value;
    if (act === "toggle-mode") {
      var m = el.getAttribute("data-v");
      if (el.checked && S.modes.indexOf(m) < 0) S.modes.push(m);
      if (!el.checked) { S.modes = S.modes.filter(function (x) { return x !== m; }); if (S.active === m) S.active = "office"; }
      S.modes = DATA.modeOrder.filter(function (x) { return S.modes.indexOf(x) > -1; });
    }
    save(); render();
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.id === "inbox") { UI.inboxText = el.value; return; }
    if (el.getAttribute("data-act") === "found-title") { UI.found[+el.getAttribute("data-i")].title = el.value; return; }
    if (el.form && el.form.getAttribute("data-form") && el.name) UI.drafts[el.form.getAttribute("data-form") + "." + el.name] = el.type === "checkbox" ? el.checked : el.value;
  });

  document.addEventListener("submit", function (e) {
    var f = e.target, kind = f.getAttribute("data-form"); if (!kind) return;
    e.preventDefault();
    var fd = new FormData(f); var g = function (k) { return (fd.get(k) || "").toString().trim(); };
    if (kind === "edit") { saveEdit(fd); return; }
    if (kind === "event") { S.events.push({ id: uid(), title: g("title"), date: g("date"), time: g("time"), mode: g("mode") || S.active }); track("event_add"); toast(t("saved")); }
    if (kind === "task" || kind === "qtask") { S.tasks.push({ id: uid(), title: g("title"), done: false, mode: g("mode") || S.active, due: kind === "qtask" ? today() : g("due") }); track("task_add"); toast(t("saved")); if (kind === "qtask") UI.focusKey = "qtask.title"; }
    if (kind === "meal") {
      var pick = g("pick"), d = today(), m = meal(pick);
      if (m) { S.meals[d] = S.meals[d] || []; S.meals[d].push({ name: mealName(m), kcal: m.kcal }); }
      else if (pick === "custom" && g("name")) { S.meals[d] = S.meals[d] || []; S.meals[d].push({ name: g("name"), kcal: +g("kcal") || 0 }); }
      else return;
      track("meal_add");
    }
    if (kind === "sleep") { S.sleep[today()] = { bed: g("bed_h") + ":" + g("bed_m"), wake: g("wake_h") + ":" + g("wake_m") }; track("sleep_log"); toast(t("saved")); }
    if (kind === "quote") { S.quotes.push({ id: uid(), client: g("client"), service: g("service"), amount: +g("amount") || 0, stage: 0 }); toast(t("saved")); }
    if (kind === "gig") { S.gigs.push({ id: uid(), venue: g("venue"), date: g("date"), fee: +g("fee") || 0, deposit: +g("deposit") || 0, depPaid: false, fullPaid: false }); toast(t("saved")); }
    if (kind === "body") {
      S.profile = { sex: g("sex"), age: +g("age"), height: +g("height"), weight: +g("weight"), activity: +g("activity"), pregnant: fd.get("pregnant") === "on" };
      S.track = true; UI.showBody = false; toast(t("saved")); track("profile_set");
    }
    clearDrafts(kind); save(); render();
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && UI.modal) { UI.modal = null; clearDrafts("edit"); render(); } });

  // ---------- start ----------
  initAnalytics();
  if (S.onboarded && S.lastOpen !== today()) { track(S.lastOpen ? "return_visit" : "first_open"); S.lastOpen = today(); save(); }
  if (!S.onboarded) track("onboarding_start");
  render();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline cache optional */ }); });
  }
})();
