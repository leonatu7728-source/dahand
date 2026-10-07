/* DaHand – test web app. Vanilla JS, no build step. Data lives in localStorage. */
(function () {
  "use strict";

  var CFG = window.DAHAND_CONFIG || {};
  var DATA = window.DAHAND_DATA;
  var I18N = window.DAHAND_I18N;
  var KEY = "dahand:v1";
  var app = document.getElementById("app");

  // ---------- helpers ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDays(isoStr, n) { var p = isoStr.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return iso(d); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function num(n) { return Math.round(n).toLocaleString(S.lang === "vi" ? "vi-VN" : "en-US"); }
  function t(key, vars) {
    var dict = I18N[S.lang] || I18N.en;
    var s = dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    if (typeof s === "string" && vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function dayLabel(isoStr) {
    var p = isoStr.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(S.lang === "vi" ? "vi-VN" : "en-US", { weekday: "short", day: "numeric", month: "short" });
  }

  // ---------- state ----------
  function fresh() {
    return {
      v: 1, lang: (navigator.language || "en").toLowerCase().indexOf("vi") === 0 ? "vi" : "en",
      onboarded: false, name: "", modes: ["office"], active: "office",
      profile: null, track: true, hideNumbers: false,
      credits: CFG.START_CREDITS || 50, lastBonus: "",
      events: [], tasks: [], sleep: {}, energy: {}, meals: {}, water: {},
      mealPlan: [], grocery: {}, quotes: [], gigs: []
    };
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var s = JSON.parse(raw); return Object.assign(fresh(), s); } } catch (e) { /* ignore */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  var S = load();
  var UI = { ob: 0, obAnswers: { kids: false, free: false, art: false }, tab: "today", planTab: "calendar", showDone: false, inboxText: "", inboxFound: [], modal: null };

  // ---------- calories ----------
  function calorieInfo() {
    var p = S.profile;
    if (!S.track || !p) return null;
    if (p.age < 18 || p.pregnant) return { blocked: true };
    var bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "male" ? 5 : -161);
    var factor = [1.2, 1.375, 1.55, 1.725][(p.activity || 1) - 1];
    var floor = p.sex === "male" ? 1500 : 1200;
    var target = Math.max(floor, Math.round((bmr * factor) / 10) * 10);
    var eaten = (S.meals[today()] || []).reduce(function (a, m) { return a + (+m.kcal || 0); }, 0);
    return { target: target, eaten: eaten, left: Math.max(0, target - eaten), floor: floor, bmr: Math.round(bmr) };
  }
  function sleepHours(dateIso) {
    var s = S.sleep[dateIso]; if (!s || !s.bed || !s.wake) return null;
    var b = s.bed.split(":"), w = s.wake.split(":");
    var mins = (+w[0] * 60 + +w[1]) - (+b[0] * 60 + +b[1]); if (mins <= 0) mins += 1440;
    return Math.round(mins / 6) / 10;
  }
  function bestFocusHour() {
    var counts = {}; var total = 0;
    Object.keys(S.energy).forEach(function (d) { (S.energy[d] || []).forEach(function (e) { if (e.v >= 4) { var h = e.t.slice(0, 2); counts[h] = (counts[h] || 0) + 1; total++; } }); });
    if (total < 3) return null;
    var best = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return best + ":00";
  }

  // ---------- sample data ----------
  function seed() {
    var d0 = today(), d1 = addDays(d0, 1), d2 = addDays(d0, 2), d4 = addDays(d0, 4), d9 = addDays(d0, 9), dm3 = addDays(d0, -3);
    var vi = S.lang === "vi";
    S.events = [
      { id: uid(), title: vi ? "Họp nhóm hằng tuần" : "Weekly team meeting", date: d0, time: "10:00", mode: "office" },
      { id: uid(), title: vi ? "Gọi khách hàng" : "Client call", date: d0, time: "15:30", mode: "office" },
      { id: uid(), title: vi ? "Đón con" : "School pickup", date: d1, time: "16:30", mode: "home" },
      { id: uid(), title: vi ? "Hạn nộp báo cáo" : "Report deadline", date: d2, time: "17:00", mode: "office" }
    ];
    S.tasks = [
      { id: uid(), title: vi ? "Trả lời email của sếp" : "Reply to manager's email", done: false, mode: "office", due: d0 },
      { id: uid(), title: vi ? "Đóng tiền điện" : "Pay the electricity bill", done: false, mode: "home", due: d1 },
      { id: uid(), title: vi ? "Đặt lịch khám răng" : "Book a dentist appointment", done: false, mode: "office", due: "" }
    ];
    S.quotes = [
      { id: uid(), client: "Grace Park", service: vi ? "Chụp ảnh cưới" : "Wedding photography", amount: 2400, stage: 1 },
      { id: uid(), client: "Studio Kite", service: vi ? "Ảnh chân dung" : "Headshots", amount: 650, stage: 2 },
      { id: uid(), client: "Bloom Café", service: vi ? "Ảnh thực đơn" : "Menu photos", amount: 480, stage: 0 }
    ];
    S.gigs = [
      { id: uid(), venue: "The Velvet Room", date: d4, fee: 1200, deposit: 600, depPaid: false, fullPaid: false },
      { id: uid(), venue: "Harbor Fest", date: d9, fee: 3500, deposit: 1050, depPaid: true, fullPaid: false },
      { id: uid(), venue: "Lumen Bar", date: dm3, fee: 800, deposit: 0, depPaid: false, fullPaid: false }
    ];
    S.mealPlan = newWeek();
    S.sleep[d0] = { bed: "23:40", wake: "06:50" };
  }
  function newWeek() {
    var dinners = DATA.meals.filter(function (m) { return m.type === "dinner" || m.type === "lunch"; }).map(function (m) { return m.id; });
    var out = [];
    for (var i = 0; i < 7; i++) out.push(dinners[Math.floor(Math.random() * dinners.length)]);
    return out;
  }
  function meal(id) { return DATA.meals.filter(function (m) { return m.id === id; })[0]; }
  function mealName(m) { return S.lang === "vi" ? m.vi : m.en; }

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
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function icon(name, size) { return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>"; }

  // ---------- render root ----------
  function render() {
    document.documentElement.lang = S.lang;
    var accent = DATA.modes[S.active] ? DATA.modes[S.active].accent : "#2F5BEA";
    document.documentElement.style.setProperty("--accent", accent);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", accent);
    app.innerHTML = S.onboarded ? shell() : onboarding();
    if (UI.focus) { var el = document.getElementById(UI.focus); if (el) el.focus(); UI.focus = null; }
  }

  function shell() {
    var claimed = S.lastBonus === today();
    var chips = S.modes.map(function (m) {
      return '<button type="button" class="chip' + (m === S.active ? " on" : "") + '" data-act="mode" data-v="' + m + '" style="--c:' + DATA.modes[m].accent + '">' + icon(DATA.modes[m].icon, 16) + "<span>" + esc(t("mode_" + m)) + "</span></button>";
    }).join("");
    var tabs = [["today", "sun", t("nav_today")], ["plan", "cal", t("nav_plan")], ["routine", "leaf", t("nav_routine")], ["mode", DATA.modes[S.active].icon, t("tab_" + S.active)], ["more", "dots", t("nav_more")]];
    var nav = tabs.map(function (x) {
      return '<button type="button" class="nav-btn' + (UI.tab === x[0] ? " on" : "") + '" data-act="tab" data-v="' + x[0] + '"' + (UI.tab === x[0] ? ' aria-current="page"' : "") + ">" + icon(x[1], 22) + "<span>" + esc(x[2]) + "</span></button>";
    }).join("");
    var screen = { today: scrToday, plan: scrPlan, routine: scrRoutine, mode: scrMode, more: scrMore }[UI.tab]();
    return '<div class="layout">' +
      '<header class="top"><div class="brand"><span class="logo">' + icon("spark", 18) + '</span><span class="brand-name">DaHand</span></div>' +
      '<div class="top-right"><button type="button" class="credit-badge" data-act="bonus" title="' + esc(claimed ? t("daily_claimed") : t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + '">' + icon("spark", 14) + "<b>" + S.credits + "</b> " + esc(t("credits")) + (claimed ? "" : '<span class="dot" aria-hidden="true"></span>') + "</button>" +
      '<button type="button" class="lang-btn" data-act="lang">' + esc(t("lang_switch")) + "</button></div></header>" +
      '<div class="chips" role="group" aria-label="Modes">' + chips + "</div>" +
      '<nav class="nav" aria-label="Main">' + nav + "</nav>" +
      '<main class="main">' + screen + "</main></div>" + modal() + '<div id="toast" class="toast" role="status" aria-live="polite"></div>';
  }

  // ---------- onboarding ----------
  function onboarding() {
    var step = UI.ob, body = "";
    if (step === "demo") {
      body = '<h1 class="ob-h">' + esc(t("demo_title")) + '</h1><p class="ob-p">' + esc(t("demo_note")) + "</p>" + sampleCards() +
        '<div class="row gap"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + "</button></div>";
      step = 0;
    } else if (step === 0) {
      body = '<h1 class="ob-h">' + esc(t("ob_welcome")) + '</h1><p class="ob-p">' + esc(t("ob_intro")) + "</p>" +
        '<label class="field"><span>' + esc(t("ob_name")) + '</span><input id="ob-name" type="text" maxlength="40" autocomplete="given-name" value="' + esc(S.name) + '"></label>' +
        '<div class="row gap"><button type="button" class="btn ghost" data-act="lang">' + esc(t("lang_switch")) + '</button><button type="button" class="btn" data-act="ob-next">' + esc(t("next")) + "</button></div>" +
        '<button type="button" class="btn ghost full" data-act="ob-demo">' + esc(t("ob_demo")) + "</button>";
    } else if (step === 1) {
      var q = function (k, label) {
        var v = UI.obAnswers[k];
        return '<div class="q"><p>' + esc(label) + '</p><div class="seg"><button type="button" class="' + (v ? "on" : "") + '" data-act="ob-ans" data-k="' + k + '" data-v="1">' + esc(t("yes")) + '</button><button type="button" class="' + (!v ? "on" : "") + '" data-act="ob-ans" data-k="' + k + '" data-v="0">' + esc(t("no")) + "</button></div></div>";
      };
      body = '<h1 class="ob-h">' + esc(t("ob_q_title")) + "</h1>" + q("kids", t("ob_q_kids")) + q("free", t("ob_q_free")) + q("art", t("ob_q_art")) +
        '<div class="row gap"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + '</button><button type="button" class="btn" data-act="ob-next">' + esc(t("next")) + "</button></div>";
    } else if (step === 2) {
      var modes = obModes();
      body = '<h1 class="ob-h">' + esc(t("ob_modes_title")) + '</h1><p class="ob-p">' + esc(t("ob_modes_note")) + "</p>" +
        modes.map(function (m) { return '<div class="mode-card" style="--c:' + DATA.modes[m].accent + '">' + icon(DATA.modes[m].icon, 22) + "<div><b>" + esc(t("mode_" + m)) + "</b><p>" + esc(t("mode_" + m + "_desc")) + "</p></div></div>"; }).join("") +
        '<div class="row gap"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + '</button><button type="button" class="btn" data-act="ob-next">' + esc(t("next")) + "</button></div>";
    } else {
      body = '<h1 class="ob-h">' + esc(t("ob_body_title")) + '</h1><p class="ob-p">' + esc(t("ob_body_note")) + "</p>" + profileForm("ob-body") +
        '<button type="button" class="btn ghost full" data-act="ob-skip">' + esc(t("ob_skip_body")) + "</button>";
    }
    return '<div class="ob"><div class="ob-card"><div class="brand big"><span class="logo">' + icon("spark", 22) + '</span><span class="brand-name">DaHand</span></div><p class="tagline">' + esc(t("tagline")) + '</p><div class="steps">' + [0, 1, 2, 3].map(function (i) { return '<span class="' + (i <= step ? "on" : "") + '"></span>'; }).join("") + "</div>" + body + "</div></div>";
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
    S = Object.assign(fresh(), built); save();
    UI.ob = 0; UI.tab = "today"; UI.modal = null; window.scrollTo(0, 0); render();
    toast(t("sample_loaded_name", { name: S.name }));
  }
  function obModes() { var m = ["office"]; if (UI.obAnswers.kids) m.push("home"); if (UI.obAnswers.free) m.push("freelancer"); if (UI.obAnswers.art) m.push("artist"); return m; }

  function profileForm(formId) {
    var p = S.profile || { sex: "female", age: 30, height: 160, weight: 58, activity: 1, pregnant: false };
    var opt = function (v, label, cur) { return '<option value="' + v + '"' + (String(cur) === String(v) ? " selected" : "") + ">" + esc(label) + "</option>"; };
    return '<form class="form" data-form="' + formId + '">' +
      '<div class="grid2"><label class="field"><span>' + esc(t("sex")) + '</span><select name="sex">' + opt("female", t("female"), p.sex) + opt("male", t("male"), p.sex) + "</select></label>" +
      '<label class="field"><span>' + esc(t("age")) + '</span><input name="age" type="number" min="10" max="100" required value="' + p.age + '"></label>' +
      '<label class="field"><span>' + esc(t("height_cm")) + '</span><input name="height" type="number" min="120" max="230" required value="' + p.height + '"></label>' +
      '<label class="field"><span>' + esc(t("weight_kg")) + '</span><input name="weight" type="number" min="30" max="250" step="0.1" required value="' + p.weight + '"></label></div>' +
      '<label class="field"><span>' + esc(t("activity")) + '</span><select name="activity">' + [1, 2, 3, 4].map(function (i) { return opt(i, t("act_" + i), p.activity); }).join("") + "</select></label>" +
      '<label class="check"><input type="checkbox" name="pregnant"' + (p.pregnant ? " checked" : "") + "> <span>" + esc(t("pregnant")) + "</span></label>" +
      '<p class="note">' + esc(t("r_formula")) + '</p><button type="submit" class="btn full">' + esc(formId === "ob-body" ? t("ob_start") : t("save")) + "</button></form>";
  }

  // ---------- screens ----------
  function scrToday() {
    var h = new Date().getHours();
    var greet = t(h < 12 ? "greet_morning" : h < 18 ? "greet_afternoon" : "greet_evening", { name: S.name || "there" });
    var evs = S.events.filter(function (e) { return e.date === today(); }).sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });
    var open = S.tasks.filter(function (x) { return !x.done; });
    var next = evs.filter(function (e) { return !e.time || e.time >= nowHM(); })[0] || evs[evs.length - 1];
    var c = calorieInfo(); var sl = sleepHours(today());
    var lines = [];
    lines.push(evs.length ? t("brief_events", { n: evs.length, next: next ? (next.time ? next.time + " " : "") + next.title : "" }) : t("brief_no_events"));
    lines.push(open.length ? t("brief_tasks", { n: open.length }) : t("brief_no_tasks"));
    if (sl) lines.push(t("brief_sleep", { h: sl }));
    if (c && !c.blocked && !S.hideNumbers) lines.push(t("brief_kcal", { n: num(c.left) }));

    var claimed = S.lastBonus === today();
    var energyToday = S.energy[today()] || [];
    var lastE = energyToday[energyToday.length - 1];

    return '<h1 class="h1">' + esc(greet) + "</h1>" +
      '<p class="sub">' + esc(dayLabel(today())) + "</p>" +
      (claimed ? "" : '<button type="button" class="bonus" data-act="bonus">' + icon("spark", 16) + esc(t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + "</button>") +
      '<section class="card dark"><h2 class="card-h">' + icon("spark", 16) + esc(t("briefing")) + "</h2><p>" + lines.map(esc).join(" ") + "</p></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("energy_q")) + '</h2><div class="energy">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-act="energy" data-v="' + v + '" class="' + (lastE && lastE.v === v ? "on" : "") + '" aria-label="' + v + '/5">' + v + "</button>"; }).join("") + "</div>" +
      (lastE ? '<p class="note">' + esc(t("energy_saved", { v: lastE.v, t: lastE.t })) + "</p>" : "") + "</section>" +
      '<div class="cols"><section class="card"><h2 class="card-h">' + esc(t("today_schedule")) + "</h2>" + (evs.length ? '<ul class="list">' + evs.map(eventRow).join("") + "</ul>" : '<p class="muted">' + esc(t("nothing_yet")) + "</p>") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("today_tasks")) + "</h2>" + (open.length ? '<ul class="list">' + open.slice(0, 6).map(taskRow).join("") + "</ul>" : '<p class="muted">' + esc(t("nothing_yet")) + "</p>") + "</section></div>" +
      '<section class="card"><h2 class="card-h">' + esc(t("ask_title")) + '</h2><div class="asks">' + aiButtons() + '</div><p class="note">' + esc(t("ask_offline_note")) + "</p></section>";
  }

  function aiButtons() {
    var list = [["plan", DATA.cost.standard], ["meal", DATA.cost.standard]];
    if (S.active === "office") list.push(["inbox", 0]);
    if (S.active === "home") list.push(["groceries", DATA.cost.standard]);
    if (S.active === "freelancer" || S.active === "artist") list.push(["money", DATA.cost.standard]);
    return list.map(function (x) {
      return '<button type="button" class="ask" data-act="ai" data-v="' + x[0] + '"><span>' + esc(t("ai_" + x[0])) + '</span><span class="cost">' + (x[1] ? esc(t("ai_cost", { n: x[1] })) : "0") + "</span></button>";
    }).join("");
  }

  function eventRow(e) {
    return '<li class="item"><span class="time">' + esc(e.time || "—") + '</span><span class="grow">' + esc(e.title) + '</span><span class="tag" style="--c:' + (DATA.modes[e.mode] || DATA.modes.office).accent + '">' + esc(t("mode_" + (e.mode || "office"))) + '</span><button type="button" class="icon-btn" data-act="del-event" data-id="' + e.id + '" aria-label="' + esc(t("delete")) + '">' + icon("x", 16) + "</button></li>";
  }
  function taskRow(x) {
    return '<li class="item"><button type="button" class="box' + (x.done ? " on" : "") + '" data-act="toggle-task" data-id="' + x.id + '" aria-pressed="' + x.done + '" aria-label="' + esc(x.title) + '">' + (x.done ? icon("check", 14) : "") + '</button><span class="grow' + (x.done ? " struck" : "") + '">' + esc(x.title) + (x.due ? ' <span class="muted small">· ' + esc(x.due === today() ? t("today_label") : dayLabel(x.due)) + "</span>" : "") + '</span><button type="button" class="icon-btn" data-act="del-task" data-id="' + x.id + '" aria-label="' + esc(t("delete")) + '">' + icon("x", 16) + "</button></li>";
  }

  function scrPlan() {
    var seg = '<div class="seg wide"><button type="button" class="' + (UI.planTab === "calendar" ? "on" : "") + '" data-act="plan-tab" data-v="calendar">' + esc(t("plan_calendar")) + '</button><button type="button" class="' + (UI.planTab === "tasks" ? "on" : "") + '" data-act="plan-tab" data-v="tasks">' + esc(t("plan_tasks")) + "</button></div>";
    if (UI.planTab === "calendar") {
      var days = []; for (var i = 0; i < 7; i++) days.push(addDays(today(), i));
      var later = S.events.filter(function (e) { return e.date > days[6]; });
      return '<h1 class="h1">' + esc(t("nav_plan")) + "</h1>" + seg +
        '<form class="card form inline" data-form="event"><input name="title" required maxlength="80" placeholder="' + esc(t("ev_title")) + '" aria-label="' + esc(t("ev_title")) + '"><input name="date" type="date" required value="' + today() + '" aria-label="' + esc(t("ev_date")) + '"><input name="time" type="time" aria-label="' + esc(t("ev_time")) + '"><button type="submit" class="btn">' + icon("plus", 16) + esc(t("add_event")) + "</button></form>" +
        days.map(function (d) {
          var evs = S.events.filter(function (e) { return e.date === d; }).sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });
          return '<section class="day"><h2 class="day-h' + (d === today() ? " now" : "") + '">' + esc(d === today() ? t("today_label") + " · " + dayLabel(d) : dayLabel(d)) + "</h2>" + (evs.length ? '<ul class="list">' + evs.map(eventRow).join("") + "</ul>" : '<p class="muted small">—</p>') + "</section>";
        }).join("") +
        (later.length ? '<section class="day"><h2 class="day-h">…</h2><ul class="list">' + later.sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (e) { return eventRow(Object.assign({}, e, { time: dayLabel(e.date) })); }).join("") + "</ul></section>" : "");
    }
    var list = S.tasks.filter(function (x) { return UI.showDone || !x.done; });
    return '<h1 class="h1">' + esc(t("nav_plan")) + "</h1>" + seg +
      '<form class="card form inline" data-form="task"><input name="title" required maxlength="100" placeholder="' + esc(t("task_title")) + '" aria-label="' + esc(t("task_title")) + '"><input name="due" type="date" aria-label="' + esc(t("ev_date")) + '"><button type="submit" class="btn">' + icon("plus", 16) + esc(t("add_task")) + "</button></form>" +
      '<label class="check"><input type="checkbox" data-act="show-done"' + (UI.showDone ? " checked" : "") + "> <span>" + esc(t("show_done")) + "</span></label>" +
      '<section class="card">' + (list.length ? '<ul class="list">' + list.map(taskRow).join("") + "</ul>" : '<p class="muted">' + esc(t("nothing_yet")) + "</p>") + "</section>";
  }

  function scrRoutine() {
    var d = today(); var s = S.sleep[d] || {}; var sl = sleepHours(d);
    var en = S.energy[d] || []; var c = calorieInfo(); var meals = S.meals[d] || []; var w = S.water[d] || 0;
    var food;
    if (!S.track) {
      food = '<p class="muted">' + esc(t("ob_skip_body")) + '</p><button type="button" class="btn ghost" data-act="toggle-track">' + esc(t("r_track")) + "</button>";
    } else if (!S.profile) {
      food = '<p class="muted">' + esc(t("ob_body_note")) + "</p>" + profileForm("body");
    } else if (c.blocked) {
      food = '<p class="warn">' + esc(t("r_blocked")) + "</p>";
    } else {
      var pct = Math.min(100, Math.round((c.eaten / c.target) * 100));
      food = (S.hideNumbers ? '<p class="muted">' + esc(t("r_hidden_numbers")) + "</p>" :
        '<div class="stats"><div><span>' + esc(t("r_target")) + "</span><b>" + num(c.target) + "</b></div><div><span>" + esc(t("r_eaten")) + "</span><b>" + num(c.eaten) + "</b></div><div><span>" + esc(t("r_left")) + "</span><b>" + num(c.left) + '</b></div></div><div class="bar"><span style="width:' + pct + '%"></span></div>') +
        '<form class="form inline" data-form="meal"><input name="name" required maxlength="60" placeholder="' + esc(t("r_meal_name")) + '" aria-label="' + esc(t("r_meal_name")) + '"><input name="kcal" type="number" min="0" max="3000" required placeholder="' + esc(t("r_meal_kcal")) + '" aria-label="' + esc(t("r_meal_kcal")) + '"><button type="submit" class="btn">' + esc(t("add")) + "</button></form>" +
        (meals.length ? '<ul class="list">' + meals.map(function (m, i) { return '<li class="item"><span class="grow">' + esc(m.name) + "</span>" + (S.hideNumbers ? "" : '<span class="muted">' + num(m.kcal) + " kcal</span>") + '<button type="button" class="icon-btn" data-act="del-meal" data-i="' + i + '" aria-label="' + esc(t("delete")) + '">' + icon("x", 16) + "</button></li>"; }).join("") + "</ul>" : "") +
        '<div class="row gap wrap"><button type="button" class="ask" data-act="ai" data-v="meal"><span>' + esc(t("r_suggest")) + '</span><span class="cost">' + esc(t("ai_cost", { n: DATA.cost.standard })) + "</span></button></div>" +
        '<label class="check"><input type="checkbox" data-act="hide-numbers"' + (S.hideNumbers ? " checked" : "") + "> <span>" + esc(t("r_hide_numbers")) + "</span></label>" +
        '<p class="note">' + esc(t("r_formula")) + " " + esc(t("r_floor", { n: num(c.floor) })) + "</p>";
    }
    return '<h1 class="h1">' + esc(t("nav_routine")) + "</h1>" +
      '<section class="card"><h2 class="card-h">' + esc(t("r_sleep")) + '</h2><form class="form inline" data-form="sleep"><label class="field"><span>' + esc(t("r_bed")) + '</span><input name="bed" type="time" value="' + esc(s.bed || "") + '" required></label><label class="field"><span>' + esc(t("r_wake")) + '</span><input name="wake" type="time" value="' + esc(s.wake || "") + '" required></label><button type="submit" class="btn">' + esc(t("save")) + "</button></form>" +
      (sl ? '<p class="big-num">' + esc(t("r_sleep_hours", { h: sl })) + "</p>" + (sl < 7 ? '<p class="warn">' + esc(t("r_sleep_low")) + "</p>" : "") : "") + '<p class="note">' + esc(t("r_sleep_goal")) + "</p></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("r_energy")) + '</h2><div class="energy">' + [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" data-act="energy" data-v="' + v + '" aria-label="' + v + '/5">' + v + "</button>"; }).join("") + "</div>" +
      (en.length ? '<div class="spark">' + en.map(function (e) { return '<span title="' + esc(e.t) + '" style="height:' + e.v * 20 + '%"></span>'; }).join("") + '</div><p class="note">' + en.map(function (e) { return e.t + " · " + e.v + "/5"; }).join("   ") + "</p>" : '<p class="muted">' + esc(t("r_energy_none")) + "</p>") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("r_water")) + '</h2><div class="row gap"><button type="button" class="icon-btn lg" data-act="water" data-v="-1" aria-label="−">−</button><b class="big-num">' + esc(t("r_glasses", { n: w })) + '</b><button type="button" class="icon-btn lg" data-act="water" data-v="1" aria-label="+">+</button></div></section>' +
      '<section class="card"><h2 class="card-h">' + esc(t("r_food")) + "</h2>" + food + "</section>";
  }

  function scrMode() {
    return { office: modeOffice, home: modeHome, freelancer: modeFreelancer, artist: modeArtist }[S.active]();
  }
  function modeOffice() {
    var found = UI.inboxFound;
    return '<h1 class="h1">' + esc(t("o_title")) + '</h1><p class="sub">' + esc(t("o_desc")) + "</p>" +
      '<section class="card"><textarea id="inbox" rows="6" placeholder="' + esc(t("o_placeholder")) + '" aria-label="' + esc(t("o_title")) + '">' + esc(UI.inboxText) + '</textarea><button type="button" class="btn" data-act="scan">' + esc(t("o_scan")) + "</button></section>" +
      (UI.scanned ? '<section class="card"><h2 class="card-h">' + esc(found.length ? t("o_found", { n: found.length }) : t("o_none")) + "</h2>" +
        (found.length ? '<ul class="list">' + found.map(function (f) { return '<li class="item"><span class="time">' + esc(f.time || "") + '</span><span class="grow">' + esc(f.title) + (f.date ? ' <span class="muted small">· ' + esc(dayLabel(f.date)) + "</span>" : "") + "</span></li>"; }).join("") + '</ul><button type="button" class="btn" data-act="add-found">' + esc(t("o_add_all")) + "</button>" : "") + "</section>" : "");
  }
  function modeHome() {
    if (!S.mealPlan.length) S.mealPlan = newWeek();
    var days = t("days");
    var ing = {}; S.mealPlan.forEach(function (id) { var m = meal(id); if (m) m.ing.forEach(function (i) { ing[i] = true; }); });
    var items = Object.keys(ing);
    return '<h1 class="h1">' + esc(t("h_title")) + "</h1>" +
      '<section class="card"><ul class="list">' + S.mealPlan.map(function (id, i) { var m = meal(id); return '<li class="item"><span class="time">' + esc(days[i]) + '</span><span class="grow">' + esc(mealName(m)) + "</span>" + (S.hideNumbers ? "" : '<span class="muted small">~' + m.kcal + " kcal</span>") + "</li>"; }).join("") + '</ul><button type="button" class="btn ghost" data-act="shuffle">' + esc(t("h_shuffle")) + "</button></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("h_grocery")) + '</h2><p class="note">' + esc(t("h_grocery_note")) + '</p><ul class="list">' + items.map(function (k) { var on = !!S.grocery[k]; return '<li class="item"><button type="button" class="box' + (on ? " on" : "") + '" data-act="grocery" data-k="' + k + '" aria-pressed="' + on + '" aria-label="' + esc(DATA.ingredients[k][S.lang === "vi" ? 1 : 0]) + '">' + (on ? icon("check", 14) : "") + '</button><span class="grow' + (on ? " struck" : "") + '">' + esc(DATA.ingredients[k][S.lang === "vi" ? 1 : 0]) + "</span></li>"; }).join("") + "</ul></section>";
  }
  function modeFreelancer() {
    var st = t("f_stages");
    var sum = [0, 0, 0, 0]; S.quotes.forEach(function (q) { sum[q.stage] += +q.amount || 0; });
    return '<h1 class="h1">' + esc(t("f_title")) + "</h1>" +
      '<div class="stats card"><div><span>' + esc(t("f_pipeline")) + "</span><b>" + money(sum[0] + sum[1]) + "</b></div><div><span>" + esc(t("f_owed")) + "</span><b>" + money(sum[2]) + "</b></div><div><span>" + esc(t("f_paid")) + "</span><b>" + money(sum[3]) + "</b></div></div>" +
      '<form class="card form inline" data-form="quote"><input name="client" required maxlength="60" placeholder="' + esc(t("f_client")) + '" aria-label="' + esc(t("f_client")) + '"><input name="service" maxlength="60" placeholder="' + esc(t("f_service")) + '" aria-label="' + esc(t("f_service")) + '"><input name="amount" type="number" min="0" required placeholder="' + esc(t("f_amount")) + '" aria-label="' + esc(t("f_amount")) + '"><button type="submit" class="btn">' + esc(t("f_add")) + "</button></form>" +
      '<div class="board">' + st.map(function (name, i) {
        var qs = S.quotes.filter(function (q) { return q.stage === i; });
        return '<section class="col"><h2 class="col-h">' + esc(name) + " <span>" + qs.length + "</span></h2>" + qs.map(function (q) {
          return '<div class="tile"><b>' + esc(q.client) + "</b><span class=\"muted small\">" + esc(q.service) + "</span><span>" + money(q.amount) + '</span><div class="row gap">' + (i < 3 ? '<button type="button" class="mini" data-act="advance" data-id="' + q.id + '">→ ' + esc(st[i + 1]) + "</button>" : "") + '<button type="button" class="icon-btn" data-act="del-quote" data-id="' + q.id + '" aria-label="' + esc(t("delete")) + '">' + icon("x", 14) + "</button></div></div>";
        }).join("") + "</section>";
      }).join("") + "</div>";
  }
  function modeArtist() {
    var gigs = S.gigs.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var upcoming = 0, owed = 0;
    gigs.forEach(function (g) { if (g.date >= today()) upcoming += +g.fee || 0; if (!g.fullPaid) owed += (+g.fee || 0) - (g.depPaid ? (+g.deposit || 0) : 0); });
    return '<h1 class="h1">' + esc(t("a_title")) + "</h1>" +
      '<div class="stats card"><div><span>' + esc(t("a_upcoming")) + "</span><b>" + money(upcoming) + "</b></div><div><span>" + esc(t("a_owed")) + "</span><b>" + money(owed) + "</b></div></div>" +
      '<form class="card form inline" data-form="gig"><input name="venue" required maxlength="60" placeholder="' + esc(t("a_venue")) + '" aria-label="' + esc(t("a_venue")) + '"><input name="date" type="date" required value="' + today() + '" aria-label="' + esc(t("a_date")) + '"><input name="fee" type="number" min="0" required placeholder="' + esc(t("a_fee")) + '" aria-label="' + esc(t("a_fee")) + '"><input name="deposit" type="number" min="0" placeholder="' + esc(t("a_deposit")) + '" aria-label="' + esc(t("a_deposit")) + '"><button type="submit" class="btn">' + esc(t("a_add")) + "</button></form>" +
      '<section class="card"><ul class="list">' + gigs.map(function (g) {
        var status = g.fullPaid ? t("a_fully_paid") : (g.deposit > 0 ? (g.depPaid ? t("a_dep_paid") : t("a_dep_unpaid")) : "");
        return '<li class="item col-item"><div class="row gap"><span class="time">' + esc(dayLabel(g.date)) + '</span><b class="grow">' + esc(g.venue) + "</b><span>" + money(g.fee) + '</span><button type="button" class="icon-btn" data-act="del-gig" data-id="' + g.id + '" aria-label="' + esc(t("delete")) + '">' + icon("x", 14) + '</button></div><div class="row gap wrap">' +
          (status ? '<span class="pill' + (g.fullPaid || g.depPaid ? " ok" : " bad") + '">' + esc(status) + "</span>" : "") +
          (!g.fullPaid && g.deposit > 0 && !g.depPaid ? '<button type="button" class="mini" data-act="dep-paid" data-id="' + g.id + '">' + esc(t("a_mark_paid")) + "</button>" : "") +
          (!g.fullPaid ? '<button type="button" class="mini" data-act="full-paid" data-id="' + g.id + '">' + esc(t("a_mark_full")) + "</button>" : "") + "</div></li>";
      }).join("") + "</ul></section>";
  }

  function scrMore() {
    var survey = CFG.SURVEY_FORM_URL, wait = CFG.WAITLIST_FORM_URL;
    return '<h1 class="h1">' + esc(t("m_feedback")) + '</h1><p class="sub">' + esc(t("m_feedback_desc")) + "</p>" +
      '<section class="card">' + (survey || wait ?
        '<div class="row gap wrap">' + (survey ? '<a class="btn" href="' + esc(survey) + '" target="_blank" rel="noopener">' + esc(t("m_survey")) + "</a>" : "") + (wait ? '<a class="btn ghost" href="' + esc(wait) + '" target="_blank" rel="noopener">' + esc(t("m_waitlist")) + "</a>" : "") + "</div>" +
        (survey ? '<iframe class="form-frame" src="' + esc(survey.indexOf("embedded=true") > -1 ? survey : survey + (survey.indexOf("?") > -1 ? "&" : "?") + "embedded=true") + '" title="' + esc(t("m_survey")) + '" loading="lazy"></iframe>' : "")
        : '<p class="muted">' + esc(t("m_not_configured")) + "</p>") + "</section>" +
      '<h2 class="h2">' + esc(t("m_settings")) + "</h2>" +
      '<section class="card"><h3 class="card-h">' + esc(t("m_language")) + '</h3><div class="seg"><button type="button" class="' + (S.lang === "en" ? "on" : "") + '" data-act="set-lang" data-v="en">English</button><button type="button" class="' + (S.lang === "vi" ? "on" : "") + '" data-act="set-lang" data-v="vi">Tiếng Việt</button></div></section>' +
      '<section class="card"><h3 class="card-h">' + esc(t("m_modes")) + "</h3>" + DATA.modeOrder.map(function (m) {
        var on = S.modes.indexOf(m) > -1;
        return '<label class="check mode-toggle" style="--c:' + DATA.modes[m].accent + '"><input type="checkbox" data-act="toggle-mode" data-v="' + m + '"' + (on ? " checked" : "") + (m === "office" ? " disabled" : "") + "> <span><b>" + esc(t("mode_" + m)) + '</b><br><span class="muted small">' + esc(t("mode_" + m + "_desc")) + "</span></span></label>";
      }).join("") + "</section>" +
      '<section class="card"><h3 class="card-h">' + esc(t("m_profile")) + '</h3><label class="check"><input type="checkbox" data-act="toggle-track"' + (S.track ? " checked" : "") + "> <span>" + esc(t("r_track")) + "</span></label>" + (S.track ? profileForm("body") : "") + "</section>" +
      '<section class="card"><h3 class="card-h">' + esc(t("m_samples")) + '</h3><p class="note">' + esc(t("m_samples_note")) + "</p>" + sampleCards() + "</section>" +
      '<section class="card"><h3 class="card-h">' + esc(t("m_data")) + '</h3><p class="note">' + esc(t("m_data_note")) + '</p><div class="row gap wrap"><button type="button" class="btn ghost" data-act="export">' + esc(t("m_export")) + '</button><label class="btn ghost file-btn">' + esc(t("m_import")) + '<input type="file" accept=".json,application/json" data-act="import"></label><button type="button" class="btn danger" data-act="reset">' + esc(t("m_reset")) + '</button></div><p class="note">' + esc(t("m_install")) + "</p></section>" +
      '<p class="note center">' + esc(t("m_about")) + "</p>";
  }

  function modal() {
    if (!UI.modal) return "";
    return '<div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(UI.modal.title) + '" data-stop="1"><div class="row between"><h2 class="card-h">' + icon("spark", 16) + esc(UI.modal.title) + '</h2><button type="button" class="icon-btn" data-act="close-modal" aria-label="' + esc(t("close")) + '">' + icon("x", 18) + "</button></div>" +
      '<div class="ai-text">' + UI.modal.html + "</div>" + (UI.modal.spent ? '<p class="note">' + esc(t("ai_spent", { n: UI.modal.spent })) + "</p>" : "") + "</div></div>";
  }

  // ---------- assistant (offline) ----------
  function aiLocal(task) {
    var L = function (arr) { return "<ul>" + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    if (task === "plan") {
      var evs = S.events.filter(function (e) { return e.date === today(); }).sort(function (a, b) { return (a.time || "").localeCompare(b.time || ""); });
      var open = S.tasks.filter(function (x) { return !x.done; }).sort(function (a, b) { return (a.due || "9999").localeCompare(b.due || "9999"); });
      var focus = bestFocusHour();
      var items = evs.map(function (e) { return (e.time || "—") + "  " + e.title; });
      open.slice(0, 3).forEach(function (x) { items.push("☐ " + x.title); });
      var html = items.length ? "<p>" + esc(t("ai_r_plan_head")) + "</p>" + L(items) : "<p>" + esc(t("ai_r_plan_none")) + "</p>";
      return html + "<p>" + esc(focus ? t("ai_r_focus", { t: focus }) : t("ai_r_focus_default")) + "</p>";
    }
    if (task === "meal") {
      var c = calorieInfo(); var h = new Date().getHours();
      var type = h < 10 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack";
      var pool = DATA.meals.filter(function (m) { return m.type === type || (type === "lunch" && m.type === "dinner") || (type === "dinner" && m.type === "lunch"); });
      if (c && !c.blocked) { var fit = pool.filter(function (m) { return m.kcal <= Math.max(c.left, 250); }); if (fit.length) pool = fit; else pool = DATA.meals.filter(function (m) { return m.type === "snack"; }); }
      pool = pool.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
      var head = c && !c.blocked && !S.hideNumbers ? t("ai_r_meal_head", { n: num(c.left) }) : t("ai_r_meal_free");
      return "<p>" + esc(head) + "</p>" + L(pool.map(function (m) { return mealName(m) + (S.hideNumbers ? "" : " (~" + m.kcal + " kcal)"); })) + '<p class="note">' + esc(t("r_formula")) + "</p>";
    }
    if (task === "money") {
      var rows = [];
      if (S.modes.indexOf("freelancer") > -1) S.quotes.filter(function (q) { return q.stage === 2; }).forEach(function (q) { rows.push(q.client + " — " + money(q.amount)); });
      if (S.modes.indexOf("artist") > -1) S.gigs.filter(function (g) { return !g.fullPaid && (g.date < today() || (g.deposit > 0 && !g.depPaid)); }).forEach(function (g) {
        rows.push(g.venue + " — " + money(g.date < today() ? g.fee - (g.depPaid ? g.deposit : 0) : g.deposit));
      });
      return rows.length ? "<p>" + esc(t("ai_r_money_head")) + "</p>" + L(rows) : "<p>" + esc(t("ai_r_money_none")) + "</p>";
    }
    if (task === "groceries") {
      var ing = {}; S.mealPlan.forEach(function (id) { var m = meal(id); if (m) m.ing.forEach(function (i) { ing[i] = 1; }); });
      return "<p>" + esc(t("ai_r_groceries", { n: Object.keys(ing).length })) + "</p>";
    }
    return "<p>" + esc(t("ai_r_inbox")) + "</p>";
  }

  function runAI(task) {
    if (task === "inbox") { UI.tab = "mode"; render(); UI.focus = "inbox"; return; }
    var cost = DATA.cost.standard;
    if (S.credits < cost) { toast(t("ai_not_enough")); return; }
    var title = t("ai_" + task);
    var finish = function (html) {
      S.credits -= cost; save();
      if (task === "groceries") { UI.tab = "mode"; }
      UI.modal = { title: title, html: html, spent: cost }; render();
    };
    if (CFG.AI_ENDPOINT) {
      fetch(CFG.AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: task, mode: S.active, lang: S.lang, context: { events: S.events, tasks: S.tasks, calories: calorieInfo() } }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { finish("<p>" + esc(j.text || "").replace(/\n/g, "<br>") + "</p>"); })
        .catch(function () { finish(aiLocal(task)); });
    } else {
      finish(aiLocal(task));
    }
  }

  // ---------- inbox parser (rule-based, free) ----------
  function parseInbox(text) {
    var out = [];
    var lower = function (s) { return s.toLowerCase(); };
    var wd = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    var viwd = { "chủ nhật": 0, "cn": 0, "thứ hai": 1, "thứ 2": 1, "t2": 1, "thứ ba": 2, "thứ 3": 2, "t3": 2, "thứ tư": 3, "thứ 4": 3, "t4": 3, "thứ năm": 4, "thứ 5": 4, "t5": 4, "thứ sáu": 5, "thứ 6": 5, "t6": 5, "thứ bảy": 6, "thứ 7": 6, "t7": 6 };
    function nextWeekday(n) { var d = new Date(); var diff = (n - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); return iso(d); }
    text.split(/[\n.!?;]+|\s(?:also|and then|plus|ngoài ra|còn nữa)\s/i).forEach(function (raw) {
      var s = raw.trim(); if (s.split(/\s+/).length < 3) return;
      var l = lower(s), date = "", time = "";
      if (/\btoday\b|hôm nay/.test(l)) date = today();
      else if (/\btomorrow\b|ngày mai|\bmai\b/.test(l)) date = addDays(today(), 1);
      else {
        Object.keys(viwd).forEach(function (k) { if (!date && new RegExp("(^|\\s)" + k + "(\\s|$|,)").test(l)) date = nextWeekday(viwd[k]); });
        Object.keys(wd).forEach(function (k) { if (!date && new RegExp("\\b" + k + "\\b").test(l)) date = nextWeekday(wd[k]); });
      }
      var dm = l.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
      if (!date && dm) { var y = dm[3] ? (dm[3].length === 2 ? "20" + dm[3] : dm[3]) : new Date().getFullYear(); var a = +dm[1], b = +dm[2]; var dd = S.lang === "vi" ? a : b, mm = S.lang === "vi" ? b : a; if (dd <= 31 && mm <= 12) date = y + "-" + pad(mm) + "-" + pad(dd); }
      var tm = l.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || l.match(/\b(\d{1,2}):(\d{2})\b/) || l.match(/\b(\d{1,2})\s*(?:h|giờ)(\d{2})?\b/);
      if (tm) { var hh = +tm[1], mi = tm[2] ? +tm[2] : 0; if (tm[3] === "pm" && hh < 12) hh += 12; if (tm[3] === "am" && hh === 12) hh = 0; if (hh < 24 && mi < 60) time = pad(hh) + ":" + pad(mi); }
      var title = s.replace(/^(hi|hello|chào)[^,]*,\s*/i, "").replace(/^(also|and|please|can you|could you|pls|nhờ|làm ơn|bạn ơi)\s+/i, "").replace(/\s*(nhé|nha|please)\s*$/i, "");
      title = title.charAt(0).toUpperCase() + title.slice(1);
      if (title.length > 90) title = title.slice(0, 87) + "…";
      out.push({ title: title, date: date, time: time });
    });
    return out;
  }

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById("toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  // ---------- events ----------
  function findById(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    if (el.tagName === "INPUT") return; // handled by change
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v"), id = el.getAttribute("data-id");
    if (act === "close-modal") { if (el.classList.contains("modal-bg") && e.target.closest("[data-stop]")) return; UI.modal = null; render(); return; }
    switch (act) {
      case "lang": S.lang = S.lang === "vi" ? "en" : "vi"; if (!S.onboarded) { var n = document.getElementById("ob-name"); if (n) S.name = n.value.trim(); } break;
      case "set-lang": S.lang = v; break;
      case "ob-next":
        if (UI.ob === 0) { var nm = document.getElementById("ob-name"); S.name = nm ? nm.value.trim() : ""; }
        if (UI.ob === 2) { S.modes = obModes(); S.active = "office"; }
        UI.ob = Math.min(3, UI.ob + 1); render(); return;
      case "ob-back": UI.ob = UI.ob === "demo" ? 0 : Math.max(0, UI.ob - 1); render(); return;
      case "ob-demo": var nm2 = document.getElementById("ob-name"); if (nm2) S.name = nm2.value.trim(); UI.ob = "demo"; render(); return;
      case "sample":
        if (S.onboarded && !window.confirm(t("sample_confirm"))) return;
        loadSample(v); return;
      case "ob-ans": UI.obAnswers[el.getAttribute("data-k")] = v === "1"; render(); return;
      case "ob-skip": S.track = false; finishOnboarding(); return;
      case "mode": S.active = v; break;
      case "tab": UI.tab = v; UI.modal = null; window.scrollTo(0, 0); break;
      case "plan-tab": UI.planTab = v; break;
      case "bonus":
        if (S.lastBonus === today()) { toast(t("daily_claimed")); return; }
        S.lastBonus = today(); S.credits += CFG.DAILY_BONUS || 2; save(); render(); toast(t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })); return;
      case "energy":
        var d = today(); S.energy[d] = S.energy[d] || []; S.energy[d].push({ t: nowHM(), v: +v }); save(); render(); toast(t("energy_saved", { v: v, t: nowHM() })); return;
      case "toggle-task": var tk = findById(S.tasks, id); if (tk) tk.done = !tk.done; break;
      case "del-task": S.tasks = S.tasks.filter(function (x) { return x.id !== id; }); break;
      case "del-event": S.events = S.events.filter(function (x) { return x.id !== id; }); break;
      case "del-meal": (S.meals[today()] || []).splice(+el.getAttribute("data-i"), 1); break;
      case "water": S.water[today()] = Math.max(0, (S.water[today()] || 0) + (+v)); break;
      case "ai": runAI(v); return;
      case "scan":
        var ta = document.getElementById("inbox"); UI.inboxText = ta ? ta.value : ""; UI.inboxFound = parseInbox(UI.inboxText); UI.scanned = true; render(); return;
      case "add-found":
        UI.inboxFound.forEach(function (f) {
          if (f.date && f.time) S.events.push({ id: uid(), title: f.title, date: f.date, time: f.time, mode: "office" });
          else S.tasks.push({ id: uid(), title: f.title, done: false, mode: "office", due: f.date || "" });
        });
        UI.inboxFound = []; UI.inboxText = ""; UI.scanned = false; save(); render(); toast(t("o_added")); return;
      case "shuffle": S.mealPlan = newWeek(); S.grocery = {}; break;
      case "grocery": var k = el.getAttribute("data-k"); S.grocery[k] = !S.grocery[k]; break;
      case "advance": var q = findById(S.quotes, id); if (q && q.stage < 3) q.stage++; break;
      case "del-quote": S.quotes = S.quotes.filter(function (x) { return x.id !== id; }); break;
      case "dep-paid": var g = findById(S.gigs, id); if (g) g.depPaid = true; break;
      case "full-paid": var g2 = findById(S.gigs, id); if (g2) { g2.fullPaid = true; g2.depPaid = true; } break;
      case "del-gig": S.gigs = S.gigs.filter(function (x) { return x.id !== id; }); break;
      case "export":
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
        var a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob); a2.download = "dahand-data-" + today() + ".json"; document.body.appendChild(a2); a2.click(); a2.remove(); return;
      case "reset":
        if (window.confirm(t("m_reset_confirm"))) { try { localStorage.removeItem(KEY); } catch (er) { /* ignore */ } S = fresh(); UI.ob = 0; UI.tab = "today"; render(); } return;
      default: return;
    }
    save(); render();
  });

  document.addEventListener("change", function (e) {
    var el = e.target; var act = el.getAttribute && el.getAttribute("data-act"); if (!act) return;
    if (act === "import") {
      var file = el.files && el.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== "object" || !Array.isArray(obj.events) || !Array.isArray(obj.tasks)) throw new Error("bad");
          S = Object.assign(fresh(), obj, { onboarded: true }); save(); UI.tab = "today"; render(); toast(t("import_ok"));
        } catch (er) { toast(t("import_bad")); }
      };
      reader.readAsText(file); return;
    }
    if (act === "show-done") UI.showDone = el.checked;
    if (act === "hide-numbers") S.hideNumbers = el.checked;
    if (act === "toggle-track") S.track = el.checked;
    if (act === "toggle-mode") {
      var m = el.getAttribute("data-v");
      if (el.checked && S.modes.indexOf(m) < 0) S.modes.push(m);
      if (!el.checked) { S.modes = S.modes.filter(function (x) { return x !== m; }); if (S.active === m) S.active = "office"; }
      S.modes = DATA.modeOrder.filter(function (x) { return S.modes.indexOf(x) > -1; });
    }
    save(); render();
  });
  // toggle-track button (not checkbox) on Routine screen
  document.addEventListener("click", function (e) { var b = e.target.closest("button[data-act='toggle-track']"); if (b) { S.track = true; save(); render(); } });

  document.addEventListener("submit", function (e) {
    var f = e.target; var kind = f.getAttribute("data-form"); if (!kind) return;
    e.preventDefault();
    var fd = new FormData(f); var g = function (k) { return (fd.get(k) || "").toString().trim(); };
    if (kind === "event") S.events.push({ id: uid(), title: g("title"), date: g("date"), time: g("time"), mode: S.active });
    if (kind === "task") S.tasks.push({ id: uid(), title: g("title"), done: false, mode: S.active, due: g("due") });
    if (kind === "meal") { var d = today(); S.meals[d] = S.meals[d] || []; S.meals[d].push({ name: g("name"), kcal: +g("kcal") || 0 }); }
    if (kind === "sleep") S.sleep[today()] = { bed: g("bed"), wake: g("wake") };
    if (kind === "quote") S.quotes.push({ id: uid(), client: g("client"), service: g("service"), amount: +g("amount") || 0, stage: 0 });
    if (kind === "gig") S.gigs.push({ id: uid(), venue: g("venue"), date: g("date"), fee: +g("fee") || 0, deposit: +g("deposit") || 0, depPaid: false, fullPaid: false });
    if (kind === "body" || kind === "ob-body") {
      S.profile = { sex: g("sex"), age: +g("age"), height: +g("height"), weight: +g("weight"), activity: +g("activity"), pregnant: fd.get("pregnant") === "on" };
      S.track = true;
      if (kind === "ob-body") { finishOnboarding(); return; }
      toast(t("save") + " ✓");
    }
    save(); render();
  });

  function finishOnboarding() {
    S.onboarded = true; seed(); save(); UI.tab = "today"; render(); toast(t("sample_loaded"));
  }

  // keep inbox text while typing
  document.addEventListener("input", function (e) { if (e.target.id === "inbox") UI.inboxText = e.target.value; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && UI.modal) { UI.modal = null; render(); } });

  render();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline cache optional */ }); });
  }
})();
