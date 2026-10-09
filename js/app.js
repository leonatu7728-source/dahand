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
  function newDeviceId() {
    var a = new Uint8Array(10);
    try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(a, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  }
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
      mealPlan: [], grocery: {}, quotes: [], gigs: [], sample: "",
      deviceId: newDeviceId(), updatedAt: 0, lastSync: 0,
      rhythm: null, reminders: { morning: "08:00", evening: "21:00", notify: false, set: false },
      logs: [], run: null, restUntil: 0, focus: {}, checkins: {}, checks: {}, streakRewards: {}, unlocks: {}, lastWeekly: ""
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
    if (!s.deviceId || !/^[a-z0-9]{8,64}$/i.test(s.deviceId)) s.deviceId = newDeviceId();
    if (!s.reminders || !s.reminders.morning) s.reminders = { morning: "08:00", evening: "21:00", notify: false, set: false };
    if (!Array.isArray(s.logs)) s.logs = [];
    ["focus", "checkins", "checks", "streakRewards", "unlocks"].forEach(function (k) { if (!s[k] || typeof s[k] !== "object") s[k] = {}; });
    return prune(s);
  }
  // Keep only the last KEEP_DAYS days of daily logs.
  function prune(s) {
    var cutoff = addDays(today(), -KEEP_DAYS);
    ["sleep", "energy", "meals", "water", "focus", "checkins", "checks"].forEach(function (k) {
      Object.keys(s[k] || {}).forEach(function (d) { if (d < cutoff) delete s[k][d]; });
    });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* ignore */ }
    return fresh();
  }
  function save(silent) {
    if (!silent) { S.updatedAt = Date.now(); if (S.onboarded) checkMilestones(); }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
    if (!silent) scheduleSync();
  }

  var S = load();
  var UI = { ob: 0, obModes: { home: false, freelancer: false, artist: false }, tab: "today", planTab: "calendar", showDone: false,
    inboxText: "", found: null, modal: null, drafts: {}, undo: null, showBody: false, focusKey: null,
    obR: { bed: "23:00", wake: "07:00", peak: null } };

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
    if (CFG.SHEET_ENDPOINT) { sheetEvents.push({ t: Date.now(), name: name, mode: S.active, lang: S.lang }); scheduleSync(); }
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


  // ---------- Google Sheets sync (optional) ----------
  var sheetEvents = [], syncTimer = null;
  UI.sync = CFG.SHEET_ENDPOINT ? "idle" : "off";
  function summary() {
    var week = []; for (var i = 0; i < 7; i++) week.push(addDays(today(), -i));
    var en = [], sl = [], meals = 0;
    week.forEach(function (d) {
      var day = S.energy[d] || {}; SLOTS.forEach(function (k) { if (day[k]) en.push(day[k]); });
      var h = sleepHours(d); if (h) sl.push(h);
      meals += (S.meals[d] || []).length;
    });
    var avg = function (a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 10) / 10 : ""; };
    return { name: S.name, lang: S.lang, modes: S.modes, active: S.active, sample: S.sample || "",
      tasksOpen: S.tasks.filter(function (x) { return !x.done; }).length, tasksDone: S.tasks.filter(function (x) { return x.done; }).length,
      events: S.events.length, energy7d: en.length, avgEnergy7d: avg(en), avgSleep7d: avg(sl), meals7d: meals,
      tracking: !!(S.track && S.profile), credits: S.credits, quotes: S.quotes.length, gigs: S.gigs.length,
      streak: streakInfo().n, bestSlot: (bestSlot() || {}).slot || "", reminders: S.reminders && S.reminders.set };
  }
  function scheduleSync() {
    if (!CFG.SHEET_ENDPOINT || !S.onboarded) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(function () { syncTimer = null; pushSync(); }, 2500);
  }
  function pushSync(useKeepalive) {
    if (!CFG.SHEET_ENDPOINT || !S.onboarded) return;
    clearTimeout(syncTimer); syncTimer = null;
    var dirty = S.updatedAt && S.updatedAt !== S.syncedVersion;
    if (!dirty && !sheetEvents.length && !sheetTimings.length) { UI.sync = "ok"; paintSync(); return Promise.resolve(); }
    var events = sheetEvents.splice(0, sheetEvents.length), version = S.updatedAt;
    var timings = sheetTimings.splice(0, sheetTimings.length);
    var payload = { type: "sync", id: S.deviceId, updatedAt: version, summary: summary(), events: events, timings: timings };
    if (dirty) payload.state = JSON.stringify(S);
    var body = JSON.stringify(payload);
    var opts = { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body };
    if (useKeepalive && body.length < 60000) opts.keepalive = true;
    UI.sync = "saving"; paintSync();
    return fetch(CFG.SHEET_ENDPOINT, opts).then(function () {
      S.lastSync = Date.now(); if (dirty) S.syncedVersion = version; save(true); UI.sync = "ok"; paintSync();
    }).catch(function () {
      sheetEvents = events.concat(sheetEvents); sheetTimings = timings.concat(sheetTimings); UI.sync = "error"; paintSync();
    });
  }
  function pullSync(id) {
    var url = CFG.SHEET_ENDPOINT + (CFG.SHEET_ENDPOINT.indexOf("?") > -1 ? "&" : "?") + "id=" + encodeURIComponent(id);
    return fetch(url).then(function (r) { return r.json(); });
  }
  function paintSync() {
    var el = document.getElementById("sync-status"); if (el) el.textContent = syncLabel();
  }
  function syncLabel() {
    if (UI.sync === "off") return t("sync_off");
    if (UI.sync === "saving") return t("sync_saving");
    if (UI.sync === "error") return t("sync_error");
    return S.lastSync ? t("sync_last", { t: new Date(S.lastSync).toLocaleString(locale(), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) }) : t("sync_waiting");
  }
  // On start: if another device saved newer data under the same code, use it.
  function startupPull() {
    if (!CFG.SHEET_ENDPOINT || !S.onboarded) return;
    pullSync(S.deviceId).then(function (r) {
      if (r && r.found && r.updatedAt > (S.updatedAt || 0) && r.state) {
        S = migrate(JSON.parse(r.state)); S.syncedVersion = S.updatedAt = r.updatedAt; save(true); render(); toast(t("sync_pulled"));
      } else if (!r || !r.found) { scheduleSync(); }
    }).catch(function () { UI.sync = "error"; paintSync(); });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && (syncTimer || sheetEvents.length || sheetTimings.length)) pushSync(true); });

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

  // ---------- habits: streak, rhythm, reviews ----------
  var MILESTONES = [[3, 5], [7, 10], [14, 15], [30, 30]]; // [days in a row, bonus credits]
  var MONTH_COST = 10;                                     // credits to unlock one month's review
  var PEAK = { m: ["09:00", "10:30"], a: ["14:00", "15:30"], e: ["19:00", "20:30"] }; // 90-min focus block per slot
  function mean(a) { return a.length ? Math.round(a.reduce(function (x, y) { return x + y; }, 0) / a.length * 10) / 10 : null; }
  function dec(n) { return n == null ? "–" : String(n).replace(".", S.lang === "vi" ? "," : "."); }
  function checkedIn(d) { return !!(Object.keys(S.energy[d] || {}).length || S.sleep[d] || (S.checkins || {})[d]); }
  function streakInfo() {
    var d = today(), n = 0, start = "";
    if (!checkedIn(d)) d = addDays(d, -1);
    while (n < 400 && checkedIn(d)) { n++; start = d; d = addDays(d, -1); }
    return { n: n, start: start, today: checkedIn(today()) };
  }
  function nextMilestone(n) { for (var i = 0; i < MILESTONES.length; i++) if (MILESTONES[i][0] > n) return MILESTONES[i]; return null; }
  // Sample / imported data already has a long streak: don't pay rewards for days the person didn't do.
  function markStreakSeen() {
    var s = streakInfo(); S.streakRewards = {};
    MILESTONES.forEach(function (m) { if (s.n >= m[0]) S.streakRewards[m[0] + "@" + s.start] = today(); });
  }
  function checkMilestones() {
    var s = streakInfo(), got = null; S.streakRewards = S.streakRewards || {};
    MILESTONES.forEach(function (m) {
      var k = m[0] + "@" + s.start;
      if (s.n >= m[0] && !S.streakRewards[k]) { S.streakRewards[k] = today(); S.credits += m[1]; got = m; }
    });
    if (got) { setTimeout(function () { toast(t("streak_reward", { n: got[0], c: got[1] })); }, 900); track("streak_" + got[0]); }
  }
  function bestSlot() {
    var st = energyStats();
    if (st.best) return { slot: st.best, real: true };
    if (S.rhythm && S.rhythm.peak) return { slot: S.rhythm.peak, real: false };
    return null;
  }
  function hoursBetween(bed, wake) {
    var b = bed.split(":"), w = wake.split(":"), m = (+w[0] * 60 + +w[1]) - (+b[0] * 60 + +b[1]);
    if (m <= 0) m += 1440; return Math.round(m / 6) / 10;
  }
  function usualSleep() {
    for (var i = 1; i <= 7; i++) { var s = S.sleep[addDays(today(), -i)]; if (s && s.bed && s.wake) return s; }
    return S.rhythm ? { bed: S.rhythm.bed, wake: S.rhythm.wake } : null;
  }
  function lastSunday() { var d = today(), wi = weekdayIndex(d); return wi === 6 ? d : addDays(d, -(wi + 1)); }
  function daysSince(s) { return s ? Math.round((parseIso(today()) - parseIso(s)) / 864e5) : null; }

  function periodStats(end, days) {
    var en = [], sl = [], ci = 0, slot = { m: [], a: [], e: [] }, byDay = [], hi = [], lo = [], wk = [[], [], [], [], [], [], []];
    var from = addDays(end, -(days - 1));
    for (var i = 0; i < days; i++) {
      var d = addDays(end, -i), day = S.energy[d] || {}, vals = [];
      SLOTS.forEach(function (k) { if (day[k]) { vals.push(day[k]); slot[k].push(day[k]); } });
      var av = mean(vals), h = sleepHours(d);
      if (av != null) { en.push(av); byDay.push({ d: d, v: av }); wk[weekdayIndex(d)].push(av); }
      if (h) sl.push(h);
      if (h && av != null) (h >= 7 ? hi : lo).push(av); // sleep on date d = the night before day d
      if (checkedIn(d)) ci++;
    }
    var inRange = function (x) { return x && x >= from && x <= end; };
    var done = S.tasks.filter(function (x) { return x.done && inRange(x.doneAt); }).length;
    var paid = S.quotes.filter(function (q) { return q.stage === 3 && inRange(q.paidAt); }).reduce(function (a, q) { return a + (+q.amount || 0); }, 0) +
      S.gigs.filter(function (g) { return g.fullPaid && inRange(g.paidAt); }).reduce(function (a, g) { return a + (+g.fee || 0); }, 0);
    byDay.sort(function (a, b) { return b.v - a.v; });
    var bs = null;
    SLOTS.forEach(function (k) { if (slot[k].length >= 2 && (!bs || mean(slot[k]) > mean(slot[bs]))) bs = k; });
    var link = hi.length >= 2 && lo.length >= 2 && mean(hi) - mean(lo) >= 0.3; // only when the difference is clear
    return { days: days, from: from, end: end, energy: mean(en), sleep: mean(sl), checkins: ci, done: done, paid: paid,
      best: byDay.length >= 3 ? byDay[0] : null, worst: byDay.length >= 3 ? byDay[byDay.length - 1] : null, slot: bs,
      hi: link ? mean(hi) : null, lo: link ? mean(lo) : null, wk: wk.map(mean) };
  }
  function deltaHtml(cur, prev, unit) {
    if (cur == null || prev == null) return "";
    var diff = Math.round((cur - prev) * 10) / 10;
    if (!diff) return '<small class="delta">= ' + esc(t("rv_same")) + "</small>";
    return '<small class="delta ' + (diff > 0 ? "up" : "down") + '">' + (diff > 0 ? "+" : "−") + esc(dec(Math.abs(diff))) + (unit || "") + " " + esc(t("rv_vs")) + "</small>";
  }
  function reviewHtml(days, end) {
    var c = periodStats(end, days), p = periodStats(addDays(end, -days), days), L = [];
    var row = function (label, val, cur, prev, unit) {
      if (cur == null || prev == null) return [label, val];
      var diff = Math.round((cur - prev) * 10) / 10;
      return [label, val + " (" + (diff ? (diff > 0 ? "+" : "−") + dec(Math.abs(diff)) + (unit || "") + " " + t("rv_vs") : t("rv_same")) + ")", diff > 0 ? "ok-text" : diff < 0 ? "bad-text" : ""];
    };
    var html = '<p class="note">' + esc(dayLabel(c.from) + " – " + dayLabel(c.end)) + "</p>" + kv([
      row(t("rv_sleep"), c.sleep != null ? dec(c.sleep) + "h" : "–", c.sleep, p.sleep, "h"),
      row(t("rv_energy"), c.energy != null ? dec(c.energy) + "/5" : "–", c.energy, p.energy, ""),
      row(t("rv_done"), String(c.done), c.done, p.done, ""),
      [t("rv_checkins"), c.checkins + "/" + days]]);
    if (c.best && c.worst && c.best.d !== c.worst.d) L.push(t("rv_best_day", { best: dayLabel(c.best.d), b: dec(c.best.v), worst: dayLabel(c.worst.d), w: dec(c.worst.v) }));
    if (c.slot) L.push(t("rv_slot", { slot: t("slot_" + c.slot + "_long") }));
    if (c.hi != null) L.push(t("rv_sleep_link", { hi: dec(c.hi), lo: dec(c.lo) }));
    if (days > 7) {
      var filled = c.wk.map(function (v, i) { return { v: v, i: i }; }).filter(function (x) { return x.v != null; }).sort(function (a, b) { return b.v - a.v; });
      if (filled.length >= 4) L.push(t("rv_weekday", { best: t("days")[filled[0].i], worst: t("days")[filled[filled.length - 1].i] }));
    }
    if (c.paid) L.push(t("rv_paid", { amount: money(c.paid) }));
    var s = streakInfo(); if (s.n >= 2) L.push(t("rv_streak", { n: s.n }));
    var tip = c.checkins < Math.ceil(days * 0.6) ? t("rv_tip_checkin")
      : (c.sleep != null && c.sleep < 7) ? t("rv_tip_sleep")
      : c.slot ? t("rv_tip_slot", { slot: t("slot_" + c.slot + "_long"), range: PEAK[c.slot].join("–") })
      : t("rv_tip_keep");
    html += L.length ? '<h3 class="sub-h">' + esc(t("an_title")) + "</h3>" + ulist(L) : '<p class="muted">' + esc(t("rv_empty")) + "</p>";
    if (days > 7 && c.wk.some(function (v) { return v != null; })) {
      html += '<h3 class="sub-h">' + esc(t("rv_by_weekday")) + '</h3><div class="sleep-bars">' + c.wk.map(function (v, i) {
        return '<div class="sb"><span class="sb-val">' + (v != null ? esc(dec(v)) : "") + '</span><div class="sb-track short"><span class="sb-bar" style="height:' + (v ? v / 5 * 100 : 0) + '%"></span></div><span class="sb-day">' + esc(t("days")[i]) + "</span></div>";
      }).join("") + "</div>";
    }
    return html + '<h3 class="sub-h">' + esc(t("rv_next")) + "</h3>" + ulist([tip], "tip-list");
  }
  function openReview(days, end) {
    if (days > 7) {
      var key = "month:" + today().slice(0, 7);
      S.unlocks = S.unlocks || {};
      if (!S.unlocks[key]) {
        if (S.credits < MONTH_COST) { toast(t("ai_not_enough")); openModal({ kind: "credits" }); return; }
        if (!window.confirm(t("rv_unlock_confirm", { n: MONTH_COST }))) return;
        S.credits -= MONTH_COST; S.unlocks[key] = today(); save(); track("review_month_unlock");
      }
    }
    if (end && end !== today()) { S.lastWeekly = end; save(); }
    track(days > 7 ? "review_month" : "review_week");
    openModal({ kind: "review", days: days, end: end || today() });
  }

  // ---------- money nudges (Freelancer / Artist) ----------
  function hasMode(m) { return S.modes.indexOf(m) > -1; }
  function moneyItems(only) {
    var d = today(), out = [];
    if (hasMode("freelancer") && (!only || only === "freelancer")) {
      S.quotes.forEach(function (q) {
        if (q.stage === 2) out.push({ kind: "inv", id: q.id, who: q.client, amount: q.amount, age: daysSince(q.invoicedAt), sort: q.invoicedAt || "0" });
        else if (q.stage === 0 && daysSince(q.createdAt) >= 5) out.push({ kind: "quote", id: q.id, who: q.client, amount: q.amount, age: daysSince(q.createdAt), sort: q.createdAt });
      });
    }
    if (hasMode("artist") && (!only || only === "artist")) {
      S.gigs.forEach(function (g) {
        if (!g.fullPaid && g.date < d && gigOwed(g) > 0) out.push({ kind: "bal", id: g.id, who: g.venue, amount: gigOwed(g), date: g.date, sort: g.date });
        else if (g.date >= d && g.deposit > 0 && !g.depPaid && g.date <= addDays(d, 30)) out.push({ kind: "dep", id: g.id, who: g.venue, amount: g.deposit, date: g.date, sort: g.date });
      });
    }
    return out.sort(function (a, b) { return String(a.sort).localeCompare(String(b.sort)); });
  }
  function moneyRow(m) {
    var meta, bad, until = m.date ? -daysSince(m.date) : 0;
    if (m.kind === "inv") { meta = m.age != null ? t("mr_inv_age", { n: m.age }) : t("mr_inv"); bad = m.age >= 14; }
    else if (m.kind === "quote") { meta = t("mr_quote_age", { n: m.age }); bad = false; }
    else if (m.kind === "dep") { meta = t("mr_dep", { date: dayLabel(m.date), n: until }); bad = until <= 7; }
    else { meta = t("mr_bal", { date: dayLabel(m.date) }); bad = true; }
    var doneAct = { inv: "paid-quote", quote: "advance", dep: "dep-paid", bal: "full-paid" }[m.kind];
    var doneLabel = { inv: t("mr_got_paid"), quote: t("mr_accepted"), dep: t("mr_got_dep"), bal: t("mr_got_paid") }[m.kind];
    return '<li class="item col-item"><div class="row between"><b>' + esc(m.who) + "</b><span>" + esc(money(m.amount)) + '</span></div><span class="small ' + (bad ? "bad-text" : "muted") + '">' + esc(meta) + "</span>" +
      '<div class="row gap wrap"><button type="button" class="mini accent" data-act="nudge" data-k="' + m.kind + '" data-id="' + esc(m.id) + '">' + esc(t("mr_nudge")) + '</button><button type="button" class="mini" data-act="' + doneAct + '" data-id="' + esc(m.id) + '">✓ ' + esc(doneLabel) + "</button></div></li>";
  }
  function nudgeText(kind, id) {
    if (kind === "inv" || kind === "quote") {
      var q = findById(S.quotes, id); if (!q) return "";
      return t(kind === "inv" ? "msg_invoice" : "msg_quote", { client: q.client, service: q.service || t("msg_work"), amount: money(q.amount) });
    }
    var g = findById(S.gigs, id); if (!g) return "";
    return t(kind === "dep" ? "msg_deposit" : "msg_balance", { venue: g.venue, date: dayLabel(g.date), amount: money(kind === "dep" ? g.deposit : gigOwed(g)) });
  }
  function copyText(text, okMsg) {
    var fallback = function () {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(okMsg); } catch (e) { toast(text.slice(0, 120)); }
      ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); } catch (e) { fallback(); }
  }
  function shareText(text, okMsg) {
    if (navigator.share && /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)) { navigator.share({ text: text }).catch(function () { /* cancelled */ }); return; }
    copyText(text, okMsg);
  }
  function focusBlock() {
    var d = today(), now = nowHM();
    return S.events.filter(function (e) { return e.focus && (e.date > d || (e.date === d && (e.end || "23:59") > now)); })
      .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })[0];
  }
  function addFocusBlock() {
    var bs = bestSlot(); if (!bs) return;
    var start = PEAK[bs.slot][0], date = nowHM() < start ? today() : addDays(today(), 1);
    var top = S.tasks.filter(function (x) { return !x.done; }).sort(byDue)[0];
    S.events.push({ id: uid(), title: t("focus_event", { task: top ? top.title : t("focus_generic") }), date: date, time: start, end: PEAK[bs.slot][1], mode: "office", focus: true });
    save(); render(); toast(t("hl_focus_added", { when: (date === today() ? t("today_label") : dayLabel(date)) + " " + start })); track("focus_block");
  }

  // ---------- reminders ----------
  var remindTimers = [];
  function scheduleReminders() {
    remindTimers.forEach(clearTimeout); remindTimers = [];
    var R = S.reminders;
    if (!S.onboarded || !R || !R.notify || !("Notification" in window) || Notification.permission !== "granted") return;
    [["morning", R.morning], ["evening", R.evening]].forEach(function (x) {
      var p = x[1].split(":"), at = new Date(); at.setHours(+p[0], +p[1], 0, 0);
      var ms = at.getTime() - Date.now();
      if (ms > 0) remindTimers.push(setTimeout(function () { fireReminder(x[0]); }, ms));
    });
  }
  function fireReminder(kind) {
    var d = today(), day = S.energy[d] || {};
    if ((kind === "evening" && day.e) || (kind === "morning" && day.m)) return;
    var title = t(kind === "morning" ? "rm_ev_morning" : "rm_ev_evening");
    var opts = { body: t(kind === "morning" ? "rm_ev_morning_d" : "rm_ev_evening_d"), icon: "icons/icon-192.png", tag: "dahand-" + kind };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then(function (r) { if (r && r.showNotification) r.showNotification(title, opts); else new Notification(title, opts); });
      } else new Notification(title, opts);
    } catch (e) { /* ignore */ }
  }
  function icsStamp(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z"; }
  function icsEsc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function remindersIcs() {
    var R = S.reminders, url = location.origin + location.pathname, start = today().replace(/-/g, ""), now = icsStamp(new Date());
    var ev = function (key, time, rule, title, desc) {
      return ["BEGIN:VEVENT", "UID:dahand-" + key + "-" + S.deviceId + "@dahand.app", "DTSTAMP:" + now, "DTSTART:" + start + "T" + time.replace(":", "") + "00",
        "DURATION:PT10M", "RRULE:" + rule, "SUMMARY:" + icsEsc(title), "DESCRIPTION:" + icsEsc(desc + "\n" + url), "URL:" + url, "TRANSP:TRANSPARENT",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(title), "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].join("\r\n");
    };
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DaHand//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      ev("morning", R.morning, "FREQ=DAILY", t("rm_ev_morning"), t("rm_ev_morning_d")),
      ev("evening", R.evening, "FREQ=DAILY", t("rm_ev_evening"), t("rm_ev_evening_d")),
      ev("weekly", "18:00", "FREQ=WEEKLY;BYDAY=SU", t("rm_ev_weekly"), t("rm_ev_weekly_d")),
      "END:VCALENDAR"].join("\r\n") + "\r\n";
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  // ---------- calendar import (.ics from Google Calendar, Outlook, Apple) ----------
  function icsDate(v) {
    var m = String(v || "").match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) return null;
    if (!m[4]) return { date: m[1] + "-" + m[2] + "-" + m[3], time: "" };
    if (m[7]) { var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); return { date: iso(d), time: pad(d.getHours()) + ":" + pad(d.getMinutes()) }; }
    return { date: m[1] + "-" + m[2] + "-" + m[3], time: m[4] + ":" + m[5] };
  }
  function parseICS(text) {
    var lines = String(text).replace(/\r?\n[ \t]/g, "").split(/\r?\n/), list = [], cur = null;
    lines.forEach(function (l) {
      if (l === "BEGIN:VEVENT") { cur = {}; return; }
      if (l === "END:VEVENT") { if (cur && cur.start && cur.title && !/CANCELLED/i.test(cur.status || "")) list.push(cur); cur = null; return; }
      if (!cur) return;
      var i = l.indexOf(":"); if (i < 0) return;
      var key = l.slice(0, i).split(";")[0].toUpperCase(), val = l.slice(i + 1);
      if (key === "SUMMARY") cur.title = val.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim().slice(0, 80);
      else if (key === "DTSTART") cur.start = icsDate(val);
      else if (key === "RRULE") cur.rrule = val;
      else if (key === "STATUS") cur.status = val;
      else if (key === "EXDATE") val.split(",").forEach(function (x) { var dd = icsDate(x); if (dd) (cur.ex = cur.ex || {})[dd.date] = 1; });
    });
    var from = addDays(today(), -7), to = addDays(today(), 60), out = [];
    var WD = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
    list.forEach(function (e) {
      var s = e.start.date;
      if (!e.rrule) { if (s >= from && s <= to) out.push({ title: e.title, date: s, time: e.start.time }); return; }
      var r = {}; e.rrule.split(";").forEach(function (p) { var kv = p.split("="); r[(kv[0] || "").toUpperCase()] = kv[1] || ""; });
      var iv = Math.max(1, +(r.INTERVAL || 1)), count = r.COUNT ? +r.COUNT : 0, until = r.UNTIL ? (icsDate(r.UNTIL) || {}).date : "";
      var byday = r.BYDAY ? r.BYDAY.split(",").map(function (x) { return WD[x.replace(/[^A-Z]/g, "")]; }).filter(function (x) { return x != null; }) : null;
      var sd = parseIso(s), startMon = parseIso(addDays(s, -weekdayIndex(s))), n = 0;
      var d = (!count && s < from) ? from : s; // without COUNT we can skip straight to the window
      for (var k = 0; k < 4000 && d <= to; k++, d = addDays(d, 1)) {
        if (until && d > until) break;
        var cd = parseIso(d), hit = false;
        if (r.FREQ === "DAILY") hit = Math.round((cd - sd) / 864e5) % iv === 0;
        else if (r.FREQ === "WEEKLY") hit = Math.floor(Math.round((cd - startMon) / 864e5) / 7) % iv === 0 && (byday ? byday.indexOf(weekdayIndex(d)) > -1 : weekdayIndex(d) === weekdayIndex(s));
        else if (r.FREQ === "MONTHLY") hit = cd.getDate() === sd.getDate() && ((cd.getFullYear() - sd.getFullYear()) * 12 + cd.getMonth() - sd.getMonth()) % iv === 0;
        else if (r.FREQ === "YEARLY") hit = cd.getDate() === sd.getDate() && cd.getMonth() === sd.getMonth();
        else hit = d === s;
        if (!hit || d < s) continue;
        n++; if (count && n > count) break;
        if (d >= from && !(e.ex && e.ex[d])) out.push({ title: e.title, date: d, time: e.start.time });
      }
    });
    return out;
  }
  function importIcs(text) {
    var have = {}; S.events.forEach(function (e) { have[e.title + "|" + e.date + "|" + (e.time || "")] = 1; });
    var added = 0;
    parseICS(text).forEach(function (e) {
      var k = e.title + "|" + e.date + "|" + (e.time || "");
      if (have[k] || added >= 400) return; have[k] = 1; added++;
      S.events.push({ id: uid(), title: e.title, date: e.date, time: e.time, mode: "office", imported: true });
    });
    return added;
  }

  // ---------- energy model: body capacity (sleep, food, water) vs schedule demand + mood check-ins ----------
  // Points per hour of activity. Order matters: the first match wins.
  var EV_KIND = [
    ["perform", 30, /\bgig\b|\bshow\b|concert|perform|live set|festival|gala|biểu diễn|đêm nhạc|\bdiễn\b/i],
    ["exercise", 20, /\bgym\b|\brun\b|running|yoga|workout|swim|football|tennis|pilates|chạy bộ|\bbơi\b|thể dục|đá bóng|tập luyện|tập gym|rehears|vocal practice|luyện thanh|tập hát|tập nhạc/i],
    ["focus", 15, /focus|deep work|tập trung|\bshoot\b|chụp|record|thu âm|editing|dựng phim/i],
    ["meeting", 12, /meet|\bcall\b|stand-?up|1:1|review|interview|workshop|present|họp|\bgọi\b|phỏng vấn|thuyết trình|duyệt/i],
    ["care", 12, /school|pick ?up|drop ?off|\bkids?\b|child|baby|đưa con|đón con|đưa đón|học thêm|phụ huynh/i],
    ["travel", 10, /flight|travel|drive|commute|\btrain\b|chuyến bay|sân bay|di chuyển|lái xe/i],
    ["social", 6, /brunch|lunch|dinner|party|coffee|drinks|birthday|ăn trưa|ăn tối|cà phê|tiệc|sinh nhật|grandma|bà ngoại|bà nội/i]
  ];
  var TASK_PTS = 6, LIVING_PTS = 30;
  function evKind(title) { for (var i = 0; i < EV_KIND.length; i++) if (EV_KIND[i][2].test(title || "")) return EV_KIND[i]; return ["other", 10]; }
  function toMin(hm) { var p = String(hm || "").split(":"); return p.length < 2 || p[0] === "" ? null : +p[0] * 60 + +p[1]; }
  function fromMin(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function evHours(e) { var a = toMin(e.time), b = toMin(e.end); return a != null && b != null && b > a ? (b - a) / 60 : 1; }
  function signed(n) { return n > 0 ? "+" + n : n < 0 ? "−" + Math.abs(n) : "0"; }
  function ateToday(d) { return ((S.checks || {})[d] || []).some(function (c) { return c.ate === 1; }); }
  function kv(rows) {
    return '<ul class="kv-list">' + rows.map(function (r) { return "<li><span>" + esc(r[0]) + "</span><b" + (r[2] ? ' class="' + r[2] + '"' : "") + ">" + esc(r[1]) + "</b></li>"; }).join("") + "</ul>";
  }
  function ulist(lines, cls) { return '<ul class="' + (cls || "dot-list") + '">' + lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>"; }

  function energyModel(d) {
    d = d || today();
    var isToday = d === today(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    // 1) Capacity: what the body brings today
    var cap = [[t("em_base"), 100]], h = sleepHours(d), flags = {};
    if (h == null) cap.push([t("em_sleep_unknown"), 0]);
    else if (h < 7.5) { cap.push([t("em_sleep_short", { h: dec(h), miss: dec(Math.round((7.5 - h) * 10) / 10) }), -Math.round((7.5 - h) * 12)]); flags.shortSleep = h; }
    else if (h > 9.5) cap.push([t("em_sleep_long", { h: dec(h) }), -5]);
    else cap.push([t("em_sleep_ok", { h: dec(h) }), 0]);
    var prev = []; for (var i = 1; i <= 3; i++) { var ph = sleepHours(addDays(d, -i)); if (ph) prev.push(ph); }
    var pa = mean(prev); if (pa != null && pa < 7) cap.push([t("em_debt", { h: dec(pa) }), -Math.round((7 - pa) * 8)]);
    if (isToday && now.getHours() >= 13 && !(S.meals[d] || []).length && !ateToday(d)) { cap.push([t("em_no_food"), -10]); flags.noFood = true; }
    if (isToday && now.getHours() >= 15 && (S.water[d] || 0) < 3) { cap.push([t("em_low_water"), -5]); flags.lowWater = true; }
    var capT = Math.max(30, Math.min(110, cap.reduce(function (a, x) { return a + x[1]; }, 0)));
    // 2) Demand: what today's schedule asks for
    var s = S.sleep[d], wake = toMin((s && s.wake) || (S.rhythm && S.rhythm.wake) || "07:00"), bed = toMin((S.rhythm && S.rhythm.bed) || "23:00");
    if (bed <= wake) bed += 1440;
    var frac = isToday ? Math.max(0, Math.min(1, (nowMin - wake) / (bed - wake))) : (d < today() ? 1 : 0);
    var dem = [[t("em_living"), LIVING_PTS]], used = LIVING_PTS * frac, heavy = [];
    S.events.filter(function (e) { return e.date === d; }).sort(byTime).forEach(function (e) {
      var k = evKind(e.title), lr = learnRatio(k[0]), hrs = evHours(e) * (lr ? lr.r : 1), pts = Math.round(k[1] * hrs), st = toMin(e.time);
      dem.push([(e.time ? e.time + " · " : "") + e.title + " (" + t("ek_" + k[0]) + ")", pts]);
      if (d < today()) used += pts;
      else if (isToday && st != null && nowMin >= st) used += pts * Math.min(1, (nowMin - st) / (hrs * 60));
      if (k[1] >= 20 && st != null) heavy.push({ title: e.title, time: e.time, min: st });
    });
    S.gigs.filter(function (g) { return g.date === d; }).forEach(function (g) {
      if (S.events.some(function (e) { return e.date === d && e.title.toLowerCase().indexOf(String(g.venue).toLowerCase()) > -1; })) return;
      dem.push([t("em_gig", { venue: g.venue }) + " (" + t("ek_perform") + ")", 30]);
    });
    var dueN = S.tasks.filter(function (x) { return !x.done && x.due && x.due <= d; }).length;
    var doneN = S.tasks.filter(function (x) { return x.done && x.doneAt === d; }).length;
    var taskN = Math.min(6, dueN + doneN);
    if (taskN) { dem.push([t("em_tasks", { n: taskN }), taskN * TASK_PTS]); used += Math.min(taskN, doneN) * TASK_PTS; }
    var demT = dem.reduce(function (a, x) { return a + x[1]; }, 0), bal = capT - demT;
    var status = bal >= 15 ? "ok" : bal >= -10 ? "fit" : "over";
    var left = Math.max(0, Math.min(100, Math.round((capT - used) / capT * 100)));
    // 3) Feeling: the latest check-in (within 4 hours) is blended in
    var checks = (S.checks || {})[d] || [], last = checks[checks.length - 1];
    var recent = !!(last && isToday && nowMin - toMin(last.t) <= 240 && nowMin >= toMin(last.t));
    var nowPct = recent ? Math.round(left * 0.6 + (last.body - 1) / 4 * 100 * 0.4) : left;
    return { cap: cap, capT: capT, dem: dem, demT: demT, bal: bal, status: status, left: left, nowPct: nowPct, last: last, recent: recent,
      checks: checks, flags: flags, heavy: heavy.filter(function (x) { return x.min > nowMin && x.min - nowMin <= 240; }), bed: fromMin(bed) };
  }
  function energyTips(m) {
    var out = [], d = today(), hr = new Date().getHours();
    if (m.status === "over") {
      var mv = S.tasks.filter(function (x) { return !x.done && x.due === d; }).slice(-1)[0];
      out.push(mv ? { text: t("tip_defer", { task: mv.title, n: Math.min(Math.abs(m.bal), TASK_PTS) }), act: "defer-task", id: mv.id, btn: t("tip_defer_btn") } : { text: t("tip_over") });
    }
    if (m.heavy[0]) out.push({ text: t("tip_before", { title: m.heavy[0].title, time: m.heavy[0].time }) });
    if (m.flags.shortSleep && hr < 15) out.push({ text: t("tip_nap") });
    if (m.flags.shortSleep && hr >= 15) out.push({ text: t("tip_bed", { time: fromMin(toMin(m.bed) - 30) }) });
    if (m.flags.noFood) out.push({ text: t("tip_eat") });
    if (m.flags.lowWater) out.push({ text: t("tip_water") });
    if (m.last && m.last.stress === 3) out.push({ text: t("tip_stress") });
    if (!out.length) out.push({ text: t(m.status === "ok" ? "tip_ok" : "tip_fit") });
    return out;
  }
  function tipsHtml(list) {
    return '<ul class="tip-list">' + list.map(function (x) {
      return "<li><span>" + esc(x.text) + "</span>" + (x.act ? '<button type="button" class="mini accent" data-act="' + x.act + '" data-id="' + esc(x.id) + '">' + esc(x.btn) + "</button>" : "") + "</li>";
    }).join("") + "</ul>";
  }
  function batteryHtml(m) {
    var pct = m.nowPct, cls = pct >= 60 ? "hi" : pct >= 30 ? "mid" : "lo";
    return '<div class="battery ' + cls + '"><div class="bat-top"><b>' + pct + '%</b><span class="pill ' + { ok: "ok", fit: "mid", over: "bad" }[m.status] + '">' + esc(t("em_status_" + m.status)) + "</span></div>" +
      '<div class="bat-track" role="img" aria-label="' + pct + '%"><span style="width:' + pct + '%"></span></div><p class="note">' + esc(t(m.recent ? "em_now_blend" : "em_now_plan")) + "</p></div>";
  }
  function lastCheckText(c) { return c ? t("ci_line", { t: c.t, body: t("lv" + c.body), mood: t("md" + c.mood), stress: t("st" + c.stress) }) : t("em_no_check"); }
  function energyCard() {
    var m = energyModel();
    return '<section class="card" id="energy-card"><h2 class="card-h">' + icon("bolt", 16) + esc(t("em_title")) + "</h2>" + batteryHtml(m) +
      kv([[t("em_cap"), String(m.capT)], [t("em_dem"), String(m.demT)], [t("em_bal"), signed(m.bal), m.status === "over" ? "bad-text" : m.status === "ok" ? "ok-text" : ""], [t("em_left_plan"), m.left + "%"], [t("em_last"), lastCheckText(m.last)]]) +
      '<div class="row gap wrap"><button type="button" class="btn" data-act="checkin">' + esc(t("ci_open")) + '</button><button type="button" class="link-btn" data-act="tab" data-v="routine">' + esc(t("em_how")) + " →</button></div>" +
      '<h3 class="sub-h">' + esc(t("tips_title")) + "</h3>" + tipsHtml(energyTips(m).slice(0, 2)) + "</section>";
  }
  function checkStep(slot) {
    var d = today(), list = ((S.checks || {})[d] || []).filter(function (c) { return slotOfTime(c.t) === slot; }), c = list[list.length - 1];
    return c ? '<p class="done-line">' + icon("check", 14) + esc(lastCheckText(c)) + "</p>" :
      '<button type="button" class="btn" data-act="checkin">' + esc(t("ci_step")) + "</button>";
  }
  function checkinForm(after) {
    var d = today(), hr = new Date().getHours(), m = energyModel();
    var radios = function (name, opts, req) {
      return '<div class="opt-row" role="radiogroup">' + opts.map(function (o) { return '<label class="opt-radio"><input type="radio" name="' + name + '" value="' + o[0] + '"' + (req ? " required" : "") + "><span>" + esc(o[1]) + "</span></label>"; }).join("") + "</div>";
    };
    var q = function (text) { return '<p class="q">' + esc(text) + "</p>"; };
    var head = "";
    if (after) {
      var diff = after.actual - after.planned, lr = learnRatio(after.cat);
      head = kv([[t("ci_after_done"), after.title], [t("ci_after_plan"), fmtDur(after.planned)], [t("ci_after_real"), fmtDur(after.actual) + " (" + (diff >= 0 ? "+" : "−") + fmtDur(Math.abs(diff)) + ")", diff > 5 ? "bad-text" : diff < -5 ? "ok-text" : ""]]) +
        (lr ? ulist([t("ci_after_learn", { kind: t("ek_" + after.cat), pct: Math.round(Math.abs(lr.r - 1) * 100), dir: t(lr.r >= 1 ? "ci_longer" : "ci_shorter"), n: lr.n })]) : "");
    }
    var html = '<form class="form" data-form="checkin">' + head + '<p class="note">' + esc(t(after ? "ci_intro_after" : "ci_intro")) + "</p>" +
      q(t("ci_body")) + radios("body", [1, 2, 3, 4, 5].map(function (v) { return [v, v + " · " + t("lv" + v)]; }), true) +
      q(t("ci_mood")) + radios("mood", [1, 2, 3, 4, 5].map(function (v) { return [v, t("md" + v)]; }), true) +
      q(t("ci_stress")) + radios("stress", [[1, t("st1")], [2, t("st2")], [3, t("st3")]], true);
    if (after) {
      html += q(t("ci_fuel")) + radios("fuel", [[2, t("fuel2")], [1, t("fuel1")], [0, t("fuel0")]], true) +
        q(t("ci_rest")) + radios("rest", [[0, t("rest0")], [5, t("rest_n", { n: 5 })], [15, t("rest_n", { n: 15 })], [30, t("rest_n", { n: 30 })]], true);
    } else {
      if (hr >= 11 && !(S.meals[d] || []).length && !ateToday(d)) html += q(t("ci_ate")) + radios("ate", [[1, t("ci_yes")], [0, t("ci_notyet")]]);
      if (hr >= 10 && (S.water[d] || 0) < 6) html += q(t("ci_water")) + radios("water", [[1, "0–2"], [4, "3–5"], [6, "6+"]]);
    }
    if (m.heavy[0]) html += q(t("ci_ready", { title: m.heavy[0].title, time: m.heavy[0].time })) + radios("ready", [[1, t("rd1")], [2, t("rd2")], [3, t("rd3")]]);
    return html + '<label class="field"><span>' + esc(t("ci_note")) + '</span><input name="note" maxlength="120" placeholder="' + esc(t("ci_note_ph")) + '"></label>' +
      '<button type="submit" class="btn full">' + esc(t("ci_save")) + '</button><p class="note">' + esc(t("ci_privacy")) + "</p></form>";
  }
  function checkinResult(c) {
    var m = energyModel(), L = [], rows = [[t("ci_body_s"), c.body + "/5 · " + t("lv" + c.body)], [t("ci_mood_s"), t("md" + c.mood)], [t("ci_stress_s"), t("st" + c.stress)]];
    if (c.ate != null) rows.push([t("ci_ate_s"), t(c.ate ? "ci_yes" : "ci_notyet")]);
    if (c.water != null) rows.push([t("ci_water_s"), { 1: "0–2", 4: "3–5", 6: "6+" }[c.water] + " " + t("ci_glasses")]);
    if (c.ready != null) rows.push([t("ci_ready_s"), t("rd" + c.ready)]);
    if (c.fuel != null) rows.push([t("ci_fuel_s"), t("fuel" + c.fuel)]);
    if (c.rest != null) rows.push([t("ci_rest_s"), c.rest ? t("ci_rest_until", { n: c.rest, time: fromMin(toMin(c.t) + c.rest) }) : t("rest0")]);
    if (c.after) rows.unshift([t("ci_after_done"), c.after]);
    if (c.note) rows.push([t("ci_note_s"), c.note]);
    if (c.body <= 2 && m.left >= 50) {
      var why = [];
      if (c.stress === 3) why.push(t("why_stress"));
      if (m.flags.shortSleep) why.push(t("why_sleep"));
      if (c.ate === 0 || m.flags.noFood) why.push(t("why_food"));
      if (c.water === 1 || m.flags.lowWater) why.push(t("why_water"));
      L.push(t("an_tired", { pct: m.left }) + (why.length ? " " + t("an_maybe", { r: why.join(", ") }) : ""));
    } else if (c.body >= 4 && m.left < 40) L.push(t("an_better", { pct: m.left }));
    else L.push(t("an_match", { pct: m.left }));
    L.push(t("an_bal_" + m.status, { cap: m.capT, dem: m.demT, n: Math.abs(m.bal) }));
    if (c.stress === 3 && m.status === "over") L.push(t("an_stress_real"));
    if (c.mood <= 2) L.push(t("an_mood_low"));
    if (c.ready === 3) L.push(t("an_not_ready"));
    if (c.fuel === 0) L.push(t("an_fuel0"));
    if (c.rest === 0 && c.body <= 2) L.push(t("an_no_rest"));
    return '<p class="note">' + esc(t("ci_saved_at", { t: c.t })) + "</p>" + kv(rows) +
      '<h3 class="sub-h">' + esc(t("an_title")) + "</h3>" + ulist(L) +
      '<h3 class="sub-h">' + esc(t("tips_title")) + "</h3>" + tipsHtml(energyTips(m)) +
      '<button type="button" class="btn full" data-act="close-modal">' + esc(t("ci_done")) + "</button>";
  }
  function syncSlotFromChecks(d, slot) {
    var list = ((S.checks || {})[d] || []).filter(function (c) { return slotOfTime(c.t) === slot; }), day = S.energy[d] = S.energy[d] || {};
    if (list.length) day[slot] = list[list.length - 1].body; else delete day[slot];
  }

  // ---------- live assistant: timeline, gaps, live tracking, learning from real durations ----------
  var TASK_DEFAULT_MIN = 30;
  var sheetTimings = [];
  function nowMinutes() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function fmtDur(min) {
    min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? t("dur_hm", { h: h, m: m }) : t("dur_h", { h: h })) : t("dur_m", { m: m });
  }
  function fmtShort(min) { min = Math.round(min || 0); return min >= 60 ? Math.floor(min / 60) + "h" + (min % 60 ? pad(min % 60) : "") : min + "′"; }
  function catOf(kind, item) { return kind === "task" ? "task" : evKind(item.title)[0]; }
  function plannedOf(kind, item) {
    if (kind === "task") return +item.est || TASK_DEFAULT_MIN;
    var a = toMin(item.time), b = toMin(item.end); return a != null && b != null && b > a ? b - a : 60;
  }
  // Average of actual / planned for one category (needs 2+ real measurements).
  function learnRatio(cat) {
    var L = (S.logs || []).filter(function (x) { return x.cat === cat && x.planned > 0 && x.actual > 0; }).slice(-20);
    if (L.length < 2) return null;
    var r = L.reduce(function (a, x) { return a + Math.min(4, Math.max(0.25, x.actual / x.planned)); }, 0) / L.length;
    return { r: Math.round(r * 100) / 100, n: L.length };
  }
  function predictMin(kind, item) { var p = plannedOf(kind, item), lr = learnRatio(catOf(kind, item)); return lr ? Math.round(p * lr.r) : p; }
  function loggedDone(ref, d) { return (S.logs || []).some(function (x) { return x.ref === ref && x.date === d; }); }

  function timeline(d) {
    var nowM = nowMinutes(), isToday = d === today();
    return S.events.filter(function (e) { return e.date === d && e.time; }).sort(byTime).map(function (e) {
      var st = toMin(e.time), plan = plannedOf("event", e), pred = predictMin("event", e), tr = +e.travel || 0;
      var running = S.run && S.run.ref === e.id, done = loggedDone(e.id, d) || e.doneAt === d;
      var status = done ? "done" : running ? "now" : !isToday ? "later" : nowM >= st + pred ? "past" : nowM >= st ? "now" : "later";
      return { e: e, start: st, end: st + plan, predEnd: st + pred, leave: st - tr, travel: tr, status: status, cat: evKind(e.title)[0] };
    });
  }
  // Free windows between now (or wake-up) and bedtime, around events + travel.
  function freeGaps(d, tl) {
    var s = S.sleep[d], wake = toMin((s && s.wake) || (S.rhythm && S.rhythm.wake) || "07:00"), bed = toMin((S.rhythm && S.rhythm.bed) || "23:00");
    if (bed <= wake) bed += 1440;
    var from = Math.max(wake, d === today() ? nowMinutes() : wake), busy = [], meals = (S.meals[d] || []).length;
    tl.forEach(function (x) { if (x.status !== "done") busy.push([x.leave, Math.max(x.end, x.predEnd), "busy"]); });
    if (S.run && S.run.date === d) { var st = toMin(S.run.startHM); busy.push([st, st + S.run.pred, "busy"]); }
    if (S.restUntil && S.restUntil > Date.now()) { var r = new Date(S.restUntil); busy.push([from, r.getHours() * 60 + r.getMinutes(), "busy"]); }
    // Planned blocks that free time should respect: meals (if not eaten yet) and winding down before bed.
    var fixed = [];
    if (meals < 2 && !ateToday(d)) fixed.push([toMin("12:00"), toMin("12:45"), "lunch"]);
    if (meals < 3) fixed.push([toMin("18:30"), toMin("19:15"), "dinner"]);
    fixed.push([bed - 30, bed, "wind"]);
    busy.sort(function (a, b) { return a[0] - b[0]; });
    var raw = [], cur = from;
    busy.forEach(function (b) { if (b[0] - cur >= 15) raw.push([cur, b[0]]); cur = Math.max(cur, b[1]); });
    if (bed - cur >= 15) raw.push([cur, bed]);
    var out = [];
    raw.forEach(function (g) {
      var pieces = [[g[0], g[1], "free"]];
      fixed.forEach(function (f) {
        var next = [];
        pieces.forEach(function (p) {
          if (p[2] !== "free" || f[1] <= p[0] || f[0] >= p[1]) { next.push(p); return; }
          if (f[0] - p[0] >= 15) next.push([p[0], f[0], "free"]);
          next.push([Math.max(p[0], f[0]), Math.min(p[1], f[1]), f[2]]);
          if (p[1] - f[1] >= 15) next.push([f[1], p[1], "free"]);
        });
        pieces = next;
      });
      pieces.forEach(function (p) {
        if (p[2] !== "free" || p[1] - p[0] <= 150) { out.push(p); return; }
        for (var x = p[0]; x < p[1]; x += 120) out.push([x, Math.min(p[1], x + 120), "free"]); // long stretches → 2-hour blocks
      });
    });
    return out.filter(function (p) { return p[1] - p[0] >= 10; });
  }
  function gapIdea(g, used) {
    var len = g[1] - g[0];
    if (g[2] === "lunch") return t("gap_lunch");
    if (g[2] === "dinner") return t("gap_dinner");
    if (g[2] === "wind") return t("gap_wind");
    if (len < 30) return t("gap_break");
    var fit = S.tasks.filter(function (x) { return !x.done && !used[x.id] && predictMin("task", x) <= len - 10; }).sort(byDue)[0];
    if (fit) { used[fit.id] = 1; return t("gap_task", { task: fit.title, n: fmtDur(predictMin("task", fit)) }); }
    return len >= 90 ? t("gap_free") : t("gap_rest");
  }
  function runButtons(kind, id, small) {
    var running = S.run && S.run.ref === id;
    return running ? '<button type="button" class="mini accent" data-act="run-stop">' + icon("check", 12) + esc(t("run_done")) + "</button>"
      : '<button type="button" class="mini" data-act="run-start" data-kind="' + kind + '" data-id="' + esc(id) + '">' + icon("play", 12) + esc(small ? "" : t("run_start")) + "</button>";
  }
  function assistantCard(extra) {
    var d = today(), nowM = nowMinutes(), tl = timeline(d), name = S.name || t("friend");
    var items = [];
    items.push("<li>" + esc(t("as_hello", { name: name, time: nowHM(), date: dayLabel(d) })) + "</li>");
    // schedule
    var sched = tl.length ? '<ul class="tl-list">' + tl.map(function (x) {
      var lr = learnRatio(x.cat), predTxt = lr && Math.abs(x.predEnd - x.end) >= 5 ? " · " + t("as_pred", { time: fromMin(x.predEnd) }) : "";
      var chip = { done: t("st_done"), past: t("st_past"), now: t("st_now"), later: "" }[x.status];
      var act = x.status === "now" || (x.status === "later" && x.start - nowM <= 120) ? runButtons("event", x.e.id) : "";
      return '<li class="tl ' + x.status + '"><div><b>' + esc(fromMin(x.start) + "–" + fromMin(x.end)) + "</b> · " + esc(x.e.title) +
        (chip ? ' <span class="pill ' + (x.status === "now" ? "ok" : "") + '">' + esc(chip) + "</span>" : "") +
        (x.travel ? '<span class="muted small">' + esc(t("as_leave", { time: fromMin(x.leave), n: x.travel })) + "</span>" : "") +
        (predTxt ? '<span class="muted small">' + esc(predTxt.slice(3)) + "</span>" : "") + "</div>" + act + "</li>";
    }).join("") + "</ul>" : "";
    items.push("<li>" + esc(tl.length ? t("as_sched", { n: tl.length }) : t("as_sched_none")) + sched + "</li>");
    // now / next
    var cur = tl.filter(function (x) { return x.status === "now"; })[0], next = tl.filter(function (x) { return x.status === "later"; })[0];
    if (S.restUntil && S.restUntil > Date.now()) items.push("<li>" + esc(t("as_resting", { time: new Date(S.restUntil).toTimeString().slice(0, 5) })) + "</li>");
    if (cur) items.push("<li>" + esc(t("as_now", { title: cur.e.title, left: fmtDur(cur.predEnd - nowM), end: fromMin(cur.predEnd) })) + "</li>");
    if (next) {
      var txt = next.travel ? t("as_next_travel", { title: next.e.title, time: fromMin(next.start), leave: fromMin(next.leave), left: fmtDur(next.leave - nowM) })
        : t("as_next", { title: next.e.title, time: fromMin(next.start), left: fmtDur(next.start - nowM) });
      items.push('<li class="strong">' + esc(txt) + "</li>");
    } else if (tl.length) items.push("<li>" + esc(t("as_no_more")) + "</li>");
    // free time
    var gaps = freeGaps(d, tl), used = {}, total = gaps.reduce(function (a, g) { return a + (g[2] === "free" ? g[1] - g[0] : 0); }, 0);
    if (gaps.length) items.push("<li>" + esc(t("as_free", { total: fmtDur(total) })) + '<ul class="tl-list">' + gaps.slice(0, 7).map(function (g) {
      return '<li class="tl gap' + (g[2] !== "free" ? " fixed" : "") + '"><div><b>' + esc(fromMin(g[0]) + "–" + fromMin(g[1])) + "</b> · " + esc(fmtDur(g[1] - g[0])) + '<span class="muted small">' + esc(gapIdea(g, used)) + "</span></div></li>";
    }).join("") + "</ul></li>");
    (extra || []).forEach(function (l) { items.push("<li>" + esc(l) + "</li>"); });
    return '<section class="card assistant"><h2 class="card-h">' + icon("spark", 16) + esc(t("as_title")) + '</h2><ul class="dot-list">' + items.join("") + "</ul></section>";
  }
  function runBar() {
    if (!S.run) return "";
    var r = S.run;
    return '<div class="run-bar"><div class="grow"><span class="small">' + esc(t("run_doing")) + "</span><b>" + esc(r.title) + '</b><span class="small"><span id="run-timer">' + esc(runElapsed()) + "</span> · " + esc(t("run_plan", { n: fmtDur(r.pred) })) + "</span></div>" +
      '<button type="button" class="btn" data-act="run-stop">' + esc(t("run_done")) + '</button><button type="button" class="icon-btn" data-act="run-cancel" aria-label="' + esc(t("cancel")) + '">' + icon("x", 16) + "</button></div>";
  }
  function runElapsed() { if (!S.run) return ""; var s = Math.max(0, Math.floor((Date.now() - S.run.start) / 1000)); return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
  function startRun(kind, id) {
    if (S.run) { toast(t("run_busy", { title: S.run.title })); return; }
    var item = kind === "task" ? findById(S.tasks, id) : findById(S.events, id); if (!item) return;
    S.run = { ref: id, kind: kind, title: item.title, cat: catOf(kind, item), planned: plannedOf(kind, item), pred: predictMin(kind, item), start: Date.now(), startHM: nowHM(), date: today() };
    save(); render(); toast(t("run_started", { title: item.title })); track("run_start_" + kind);
  }
  function stopRun() {
    var r = S.run; if (!r) return;
    var actual = Math.max(1, Math.round((Date.now() - r.start) / 60000));
    var log = { ref: r.ref, kind: r.kind, title: r.title, cat: r.cat, planned: r.planned, actual: actual, date: r.date, start: r.startHM, end: nowHM() };
    S.logs = (S.logs || []).concat([log]).slice(-300);
    if (r.kind === "task") { var tk = findById(S.tasks, r.ref); if (tk) { tk.done = true; tk.doneAt = today(); } }
    else { var ev = findById(S.events, r.ref); if (ev) ev.doneAt = today(); }
    S.run = null;
    if (CFG.SHEET_ENDPOINT) sheetTimings.push({ t: Date.now(), title: log.title, cat: log.cat, planned: log.planned, actual: log.actual, date: log.date, start: log.start, end: log.end });
    track("run_done_" + r.kind); save();
    UI.modal = { kind: "checkin", after: log }; UI.modalJustOpened = true; render();
  }
  function timeCard() {
    var cats = {}; (S.logs || []).forEach(function (x) { (cats[x.cat] = cats[x.cat] || []).push(x); });
    var keys = Object.keys(cats);
    var rows = keys.map(function (k) {
      var L = cats[k].slice(-20), p = mean(L.map(function (x) { return x.planned; })), a = mean(L.map(function (x) { return x.actual; })), lr = learnRatio(k);
      var pct = lr ? Math.round((lr.r - 1) * 100) : 0;
      return [t("ek_" + k) + " · " + t("tc_times", { n: L.length }), t("tc_row", { p: fmtShort(p), a: fmtShort(a) }) + (lr ? " · " + (pct >= 0 ? "+" : "−") + Math.abs(pct) + "%" : ""), pct > 10 ? "bad-text" : pct < -10 ? "ok-text" : ""];
    });
    var recent = (S.logs || []).slice(-5).reverse().map(function (x) {
      var diff = x.actual - x.planned;
      return x.date.slice(5) + " " + x.start + "–" + x.end + " · " + x.title + " · " + t("tc_recent", { p: fmtShort(x.planned), a: fmtShort(x.actual), d: (diff >= 0 ? "+" : "−") + fmtShort(Math.abs(diff)) });
    });
    return '<section class="card"><h2 class="card-h">' + icon("clock", 16) + esc(t("tc_title")) + '</h2><p class="note">' + esc(t("tc_note")) + "</p>" +
      (rows.length ? kv(rows) + '<details class="more"><summary>' + esc(t("tc_recent_h")) + "</summary>" + ulist(recent) + "</details>" : '<p class="muted">' + esc(t("tc_empty")) + "</p>") + "</section>";
  }
  setInterval(function () {
    var el = document.getElementById("run-timer"); if (el) el.textContent = runElapsed();
  }, 1000);
  setInterval(function () {
    var a = document.activeElement;
    if (!S.onboarded || UI.modal || UI.tab !== "today" || (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) return;
    render(); // keep "time left" and free gaps current
  }, 60000);

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
    play: '<path d="M7 4v16l13-8z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.3 2-1.5 3-2.5 3 0-3-1-6-4-9 0 4-5 6.5-5 13 0 4 3 7 8 7z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function icon(name, size) { return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + "</svg>"; }

  // ---------- render root ----------
  function render() {
    var active = document.activeElement;
    if (active && active.getAttribute && active.getAttribute("data-key")) UI.focusKey = active.getAttribute("data-key");
    document.documentElement.lang = S.lang;
    if (S.onboarded) S.active = autoMode(); // context chosen by the system, never by a switch
    var accent = DATA.modes[S.active] ? DATA.modes[S.active].accent : "#2F5BEA";
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    // Only touch theme colours when they really change (re-setting them every render repaints the whole background = flicker).
    var themeKey = accent + (dark ? "d" : "l");
    if (UI.themeKey !== themeKey) {
      UI.themeKey = themeKey;
      var rs = document.documentElement.style;
      rs.setProperty("--accent", accent);
      rs.setProperty("--accent-2", mix(accent, "#A855F7", 0.35));
      rs.setProperty("--accent-dark", mix(accent, "#000000", 0.18));
      rs.setProperty("--accent-soft", rgba(accent, dark ? 0.28 : 0.14));
      var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", accent);
    }
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
      if (el.type === "checkbox") el.checked = !!UI.drafts[key];
      else if (el.type === "radio") el.checked = el.value === String(UI.drafts[key]);
      else el.value = UI.drafts[key];
    });
  }
  function clearDrafts(form) { Object.keys(UI.drafts).forEach(function (k) { if (k.indexOf(form + ".") === 0) delete UI.drafts[k]; }); }

  function shell() {
    var claimed = S.lastBonus === today();
    var chips = "";
    var tabs = [["today", "sun", t("nav_today")], ["plan", "cal", t("nav_plan")], ["routine", "leaf", t("nav_routine")], ["mode", "briefcase", t("nav_work")], ["more", "dots", t("nav_more")]];
    var nav = tabs.map(function (x) {
      var on = UI.tab === x[0];
      return '<button type="button" class="nav-btn' + (on ? " on" : "") + '" data-act="tab" data-v="' + x[0] + '"' + (on ? ' aria-current="page"' : "") + ">" + icon(x[1], 22) + "<span>" + esc(x[2]) + "</span></button>";
    }).join("");
    var screen = { today: scrToday, plan: scrPlan, routine: scrRoutine, mode: scrMode, more: scrMore }[UI.tab]();
    return '<div class="layout no-chips">' +
      '<header class="top"><div class="brand"><span class="logo">' + icon("spark", 18) + '</span><span class="brand-name">DaHand</span></div>' +
      '<div class="top-right"><button type="button" class="credit-badge" data-act="credits" aria-label="' + esc(t("credits_title") + ": " + S.credits) + '">' + icon("spark", 14) + "<b>" + S.credits + '</b><span class="credit-word">' + esc(t("credits")) + "</span>" + (claimed ? "" : '<span class="dot" aria-hidden="true"></span>') + "</button>" +
      '<button type="button" class="lang-btn" data-act="lang" aria-label="' + esc(t("m_language")) + '">' + icon("globe", 16) + "<span>" + (S.lang === "vi" ? "EN" : "VI") + "</span></button></div></header>" +
      chips + (UI.tab === "today" ? "" : runBar()) + '<nav class="nav" aria-label="Main">' + nav + "</nav>" +
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
        '<button type="button" class="link-btn" data-act="ob-demo">' + esc(t("ob_demo")) + "</button>" +
        (CFG.SHEET_ENDPOINT ? '<p class="note center-text">' + esc(t("consent_note")) + "</p>" : "");
    } else if (step === 2) {
      var R = UI.obR;
      var chipRow = function (k, opts) {
        return '<div class="opt-row" role="group">' + opts.map(function (o) { var on = R[k] === o[0]; return '<button type="button" class="opt' + (on ? " on" : "") + '" data-act="ob-r" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + on + '">' + esc(o[1]) + "</button>"; }).join("") + "</div>";
      };
      var times = function (arr) { return arr.map(function (x) { return [x, x]; }); };
      body = '<h1 class="ob-h">' + esc(t("ob_r_title")) + '</h1><p class="ob-p">' + esc(t("ob_r_note")) + "</p>" +
        '<p class="q">' + esc(t("ob_r_bed")) + "</p>" + chipRow("bed", times(["22:00", "23:00", "00:00", "01:00"])) +
        '<p class="q">' + esc(t("ob_r_wake")) + "</p>" + chipRow("wake", times(["06:00", "07:00", "08:00", "09:00"])) +
        '<p class="q">' + esc(t("ob_r_peak")) + "</p>" + chipRow("peak", [["m", t("slot_m")], ["a", t("slot_a")], ["e", t("slot_e")]]) +
        '<div class="row gap ob-actions"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + '</button><button type="button" class="btn" data-act="ob-finish"' + (R.peak ? "" : " disabled") + ">" + esc(t("ob_start")) + "</button></div>" +
        '<button type="button" class="link-btn" data-act="ob-skip">' + esc(t("ob_r_skip")) + "</button>";
    } else {
      body = '<h1 class="ob-h">' + esc(t("ob_modes_title")) + '</h1><p class="ob-p">' + esc(t("ob_modes_note")) + "</p>" +
        DATA.modeOrder.map(function (m) {
          var on = m === "office" || UI.obModes[m];
          return '<button type="button" class="mode-card pick' + (on ? " on" : "") + '" data-act="ob-mode" data-v="' + m + '" aria-pressed="' + on + '"' + (m === "office" ? " disabled" : "") + ' style="--c:' + DATA.modes[m].accent + '">' + icon(DATA.modes[m].icon, 22) +
            "<div><b>" + esc(t("mode_" + m)) + "</b>" + (m === "office" ? ' <span class="muted small">· ' + esc(t("ob_always_on")) + "</span>" : "") + "<p>" + esc(t("mode_" + m + "_desc")) + '</p></div><span class="tick">' + (on ? icon("check", 16) : "") + "</span></button>";
        }).join("") +
        '<div class="row gap ob-actions"><button type="button" class="btn ghost" data-act="ob-back">' + esc(t("back")) + '</button><button type="button" class="btn" data-act="ob-rhythm">' + esc(t("next")) + "</button></div>";
    }
    return '<div class="ob"><div class="ob-card"><div class="brand big"><span class="logo">' + icon("spark", 22) + '</span><span class="brand-name">DaHand</span></div><p class="tagline">' + esc(t("tagline")) + '</p><div class="steps" aria-hidden="true">' + [0, 1, 2].map(function (i) { return '<span class="' + (i <= dots ? "on" : "") + '"></span>'; }).join("") + "</div>" + body + "</div></div>";
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
    S = migrate(Object.assign(fresh(), built, { currency: built.currency || "USD", tips: { welcome: false }, deviceId: S.deviceId }));
    S.logs.forEach(function (x) { if (!x.cat) x.cat = evKind(x.title)[0]; });
    markStreakSeen(); save();
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
  function taskRow(x, opts) {
    var focus = opts && opts.focus === true;
    var overdue = x.due && x.due < today() && !x.done;
    return '<li class="item"><button type="button" class="box' + (x.done ? " on" : "") + '" data-act="toggle-task" data-id="' + x.id + '" aria-pressed="' + x.done + '" aria-label="' + esc(x.title) + '">' + (x.done ? icon("check", 14) : "") + "</button>" +
      itemButton("task", x.id, '<span class="grow' + (x.done ? " struck" : "") + '">' + (focus ? '<span class="pill ok">' + esc(t("focus_pill")) + "</span> " : "") + esc(x.title) + (x.due ? ' <span class="small ' + (overdue ? "bad-text" : "muted") + '">· ' + esc(x.due === today() ? t("today_label") : dayLabel(x.due)) + "</span>" : "") + "</span>") + (x.done ? "" : runButtons("task", x.id, true)) + "</li>";
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
      if (S.rhythm && S.rhythm.peak) out.push(t("energy_guess", { slot: t("slot_" + S.rhythm.peak + "_long") }));
      out.push(t("energy_need_more", { n: Math.max(1, 4 - st.total) }));
    }
    var td = S.energy[today()] || {}, vals = SLOTS.map(function (k) { return td[k]; }).filter(Boolean);
    var sl = sleepHours(today());
    if (vals.length && vals.reduce(function (a, b) { return a + b; }, 0) / vals.length <= 2 && sl && sl < 7) out.push(t("energy_low_today"));
    return out;
  }

  // ---------- Today ----------
  // ---------- Today v5: one clear screen — Now, 3 numbers, timeline, tasks ----------
  function scrToday() {
    var h = new Date().getHours(), d = today(), s = streakInfo();
    var greet = t(h < 12 ? "greet_morning" : h < 18 ? "greet_afternoon" : "greet_evening", { name: S.name || t("friend") });
    return '<div class="today-head"><div class="grow"><h1 class="h1">' + esc(greet) + '</h1><p class="sub">' + esc(dayLabel(d) + " · " + nowHM()) + "</p></div>" +
      '<button type="button" class="streak-chip' + (s.today ? " on" : "") + '" data-act="review" data-v="7" aria-label="' + esc(t("streak_n", { n: s.n })) + '">' + icon("flame", 16) + "<b>" + s.n + "</b></button></div>" +
      nudgeCard() + nowCard() + statStrip() + modeHighlight() + timelineCard() + tasksCard() +
      '<section class="card"><h2 class="card-h">' + esc(t("ask_title")) + '</h2><div class="asks">' + aiButtons() + '</div><p class="note">' + esc(t("ask_offline_note")) + "</p></section>";
  }
  // Small to-dos for the day (sleep log, check-in, pick tomorrow's first task, weekly review, reminders) as one row of chips.
  function nudgeCard() {
    var d = today(), h = new Date().getHours(), out = [], checks = (S.checks || {})[d] || [];
    var hasSlot = function (k) { return checks.some(function (c) { return slotOfTime(c.t) === k; }); };
    if (h >= 4 && h < 12) {
      if (!S.sleep[d]) { var us = usualSleep(); out.push(us ? [t("ng_sleep", { bed: us.bed, wake: us.wake }), "sleep-usual", "check"] : [t("ng_sleep_other"), "sleep-other", "moon"]); }
      if (!hasSlot("m")) out.push([t("ng_check_m"), "checkin", "bolt"]);
    } else if (h >= 12 && h < 18) {
      if (!hasSlot("a")) out.push([t("ng_check_a"), "checkin", "bolt"]);
    } else {
      if (!hasSlot("e")) out.push([t("ng_check_e"), "checkin", "bolt"]);
      if (!(S.focus || {})[addDays(d, 1)] && S.tasks.some(function (x) { return !x.done; })) out.push([t("ng_focus"), "focus-modal", "check"]);
    }
    var wi = weekdayIndex(d), key = lastSunday();
    if ((wi === 6 || wi === 0) && S.lastWeekly !== key && periodStats(key, 7).checkins >= 3) out.push([t("ng_review"), "review-week", "spark"]);
    if (!S.sample && !(S.reminders && S.reminders.set)) out.push([t("ng_remind"), "gs-remind", "bell"]);
    if (!out.length) return "";
    return '<div class="nudges" role="group" aria-label="' + esc(t("ng_title")) + '">' + out.map(function (x) {
      return '<button type="button" class="nudge" data-act="' + x[1] + '"' + (x[1] === "review-week" ? ' data-end="' + key + '"' : "") + ">" + icon(x[2], 14) + "<span>" + esc(x[0]) + "</span></button>";
    }).join("") + "</div>";
  }
  function nowCard() {
    var d = today(), nowM = nowMinutes(), tl = timeline(d), label, title, big, meta = "", btn = "";
    var cur = tl.filter(function (x) { return x.status === "now"; })[0], next = tl.filter(function (x) { return x.status === "later"; })[0];
    if (S.run) {
      label = t("now_run"); title = S.run.title; big = '<span id="run-timer">' + esc(runElapsed()) + "</span>";
      meta = t("run_plan", { n: fmtDur(S.run.pred) });
      btn = '<button type="button" class="btn" data-act="run-stop">' + icon("check", 16) + esc(t("run_done")) + '</button><button type="button" class="btn ghost" data-act="run-cancel">' + esc(t("cancel")) + "</button>";
    } else if (S.restUntil && S.restUntil > Date.now()) {
      var r = new Date(S.restUntil);
      label = t("now_rest"); title = t("now_rest_t"); big = esc(fmtDur((S.restUntil - Date.now()) / 60000));
      meta = t("now_until", { time: pad(r.getHours()) + ":" + pad(r.getMinutes()) });
    } else if (cur) {
      label = t("now_now"); title = cur.e.title; big = esc(t("now_left", { t: fmtDur(cur.predEnd - nowM) }));
      meta = fromMin(cur.start) + "–" + fromMin(cur.end);
      btn = '<button type="button" class="btn" data-act="run-start" data-kind="event" data-id="' + esc(cur.e.id) + '">' + icon("play", 14) + esc(t("now_track")) + "</button>";
    } else if (next) {
      var target = next.travel ? next.leave : next.start;
      label = t("now_next") + " · " + fromMin(next.start); title = next.e.title; big = esc(t("now_in", { t: fmtDur(target - nowM) }));
      meta = next.travel ? t("now_leave", { time: fromMin(next.leave), n: next.travel }) : fromMin(next.start) + "–" + fromMin(next.end);
      if (next.start - nowM <= 120) btn = '<button type="button" class="btn ghost" data-act="run-start" data-kind="event" data-id="' + esc(next.e.id) + '">' + icon("play", 14) + esc(t("run_start")) + "</button>";
    } else {
      var top = topThree()[0];
      label = t(top ? "now_free" : "now_idle"); title = top ? top.title : t("now_nothing"); big = "";
      meta = top ? t("now_suggest", { n: fmtDur(predictMin("task", top)) }) : t("now_nothing_sub");
      if (top) btn = '<button type="button" class="btn" data-act="run-start" data-kind="task" data-id="' + esc(top.id) + '">' + icon("play", 14) + esc(t("run_start")) + "</button>";
    }
    return '<section class="card now-card" id="now-card"><p class="now-label">' + esc(label) + '</p><h2 class="now-title">' + esc(title) + "</h2>" +
      (big ? '<p class="now-big">' + big + "</p>" : "") + (meta ? '<p class="now-meta">' + esc(meta) + "</p>" : "") +
      (btn ? '<div class="row gap wrap now-actions">' + btn + "</div>" : "") + "</section>";
  }
  function statStrip() {
    var d = today(), m = energyModel(), open = S.tasks.filter(function (x) { return !x.done; }), due = open.filter(function (x) { return x.due && x.due <= d; }).length;
    var tl = timeline(d), gaps = freeGaps(d, tl), free = gaps.reduce(function (a, g) { return a + (g[2] === "free" ? g[1] - g[0] : 0); }, 0);
    var tile = function (act, v, label, value, sub, cls) {
      return '<button type="button" class="stat ' + (cls || "") + '" data-act="' + act + '"' + (v ? ' data-v="' + v + '"' : "") + "><span>" + esc(label) + "</span><b>" + esc(value) + "</b><small>" + esc(sub) + "</small></button>";
    };
    return '<div class="stat-strip">' +
      tile("checkin", "", t("stat_energy"), m.nowPct + "%", m.last ? t("em_status_" + m.status) : t("stat_checkin"), "st-" + m.status) +
      tile("tab", "plan", t("stat_tasks"), String(open.length), due ? t("stat_due", { n: due }) : t("stat_none_due")) +
      tile("goto-timeline", "", t("stat_free"), (Math.floor(free / 60) + "h" + pad(free % 60)), t("stat_free_sub")) + "</div>";
  }
  function timelineCard() {
    var d = today(), nowM = nowMinutes(), tl = timeline(d), gaps = freeGaps(d, tl), used = {};
    var past = tl.filter(function (x) { return x.status === "done" || x.status === "past"; });
    var rows = [];
    tl.forEach(function (x) { if (UI.showPast || (x.status !== "done" && x.status !== "past")) rows.push({ at: x.start, ev: x }); });
    gaps.forEach(function (g) { rows.push({ at: g[0], gap: g }); });
    rows.sort(function (a, b) { return a.at - b.at || (a.ev ? -1 : 1); });
    var html = rows.slice(0, 12).map(function (r) {
      if (r.ev) {
        var x = r.ev, sub = [];
        if (x.travel && x.status === "later") sub.push(t("as_leave", { time: fromMin(x.leave), n: x.travel }));
        if (Math.abs(x.predEnd - x.end) >= 5 && x.status !== "done") sub.push(t("as_pred", { time: fromMin(x.predEnd) }));
        var act = x.status === "now" || (x.status === "later" && x.start - nowM <= 120) ? runButtons("event", x.e.id, true) : "";
        return '<li class="tl-row ev ' + x.status + '"><span class="tl-time">' + esc(fromMin(x.start)) + "<small>" + esc(fromMin(x.end)) + '</small></span><span class="tl-dot"></span><div class="tl-body">' +
          itemButton("event", x.e.id, '<span class="grow"><b>' + esc(x.e.title) + "</b>" + (x.status === "now" ? ' <span class="pill ok">' + esc(t("st_now")) + "</span>" : "") + (sub.length ? "<small>" + esc(sub.join(" · ")) + "</small>" : "") + "</span>") + "</div>" + act + "</li>";
      }
      var g = r.gap, kind = g[2];
      var label = kind === "free" ? t("tl_free", { d: fmtDur(g[1] - g[0]) }) : gapIdea(g, used);
      var sub2 = kind === "free" ? gapIdea(g, used) : fmtDur(g[1] - g[0]);
      return '<li class="tl-row gap ' + kind + '"><span class="tl-time">' + esc(fromMin(g[0])) + '</span><span class="tl-dot"></span><div class="tl-body"><span>' + esc(label) + "</span><small>" + esc(sub2) + "</small></div></li>";
    }).join("");
    return '<section class="card" id="timeline"><div class="row between"><h2 class="card-h">' + icon("cal", 16) + esc(t("tl_title")) + '</h2><button type="button" class="link-btn" data-act="tab" data-v="plan">' + icon("plus", 14) + esc(t("tl_add")) + "</button></div>" +
      (past.length ? '<button type="button" class="link-btn small-link" data-act="toggle-past">' + esc(UI.showPast ? t("tl_hide_past") : t("tl_past", { n: past.length })) + "</button>" : "") +
      (html ? '<ol class="timeline">' + html + "</ol>" : '<p class="muted">' + esc(t("as_sched_none")) + "</p>") + "</section>";
  }
  function tasksCard() {
    var d = today(), open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue), focusId = (S.focus || {})[d];
    var f = focusId && findById(open, focusId), list = (f ? [f].concat(open.filter(function (x) { return x !== f; })) : open).slice(0, 5);
    return '<section class="card"><div class="row between"><h2 class="card-h">' + icon("check", 16) + esc(t("today_tasks")) + "</h2>" +
      (open.length > 5 ? '<button type="button" class="link-btn" data-act="tab" data-v="plan">' + esc(t("tk_all", { n: open.length })) + " →</button>" : "") + "</div>" +
      (list.length ? '<ul class="list">' + list.map(function (x) { return taskRow(x, { focus: x.id === focusId }); }).join("") + "</ul>" : '<p class="muted">' + esc(t("empty_tasks")) + "</p>") +
      '<form class="form inline quick" data-form="qtask"><input name="title" required maxlength="100" placeholder="' + esc(t("quick_task_ph")) + '" aria-label="' + esc(t("add_task")) + '"><button type="submit" class="btn" aria-label="' + esc(t("add_task")) + '">' + icon("plus", 18) + "</button></form></section>";
  }
  function focusPicker() {
    var tm = addDays(today(), 1), picked = (S.focus || {})[tm], open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue).slice(0, 8);
    return '<div class="pick-list">' + open.map(function (x) {
      var on = picked === x.id;
      return '<button type="button" class="pick' + (on ? " on" : "") + '" data-act="focus-pick" data-id="' + esc(x.id) + '" aria-pressed="' + on + '">' + (on ? icon("check", 14) : "") + "<span>" + esc(x.title) + "</span></button>";
    }).join("") + '</div><button type="button" class="btn full" data-act="close-modal">' + esc(t("ci_done")) + "</button>";
  }

  function welcomeCard() {
    if (!S.tips || !S.tips.welcome || S.sample) return "";
    var hasTask = S.tasks.length > 0, hasEnergy = Object.keys(S.energy).some(function (k) { return Object.keys(S.energy[k] || {}).length; }), hasFood = !!S.profile || !S.track, hasRemind = !!(S.reminders && S.reminders.set);
    if (hasTask && hasEnergy && hasFood && hasRemind) return "";
    var item = function (ok, label, act) { return '<li><button type="button" class="gs' + (ok ? " ok" : "") + '" data-act="' + act + '"><span class="box' + (ok ? " on" : "") + '">' + (ok ? icon("check", 14) : "") + "</span>" + esc(label) + "</button></li>"; };
    return '<section class="card welcome"><div class="row between"><h2 class="card-h">' + esc(t("welcome_title")) + '</h2><button type="button" class="link-btn" data-act="hide-welcome">' + esc(t("gs_hide")) + "</button></div>" +
      '<p class="note">' + esc(t("welcome_note")) + '</p><ul class="gs-list">' + item(hasTask, t("gs_task"), "gs-task") + item(hasEnergy, t("gs_energy"), "gs-energy") + item(hasFood, t("gs_food"), "gs-food") + item(hasRemind, t("gs_remind"), "gs-remind") + "</ul>" +
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

  // ---------- automatic context: the system decides which role matters right now ----------
  function modeScores() {
    var d = today(), h = new Date().getHours(), nowM = nowMinutes(), sc = {}, why = {};
    S.modes.forEach(function (m) { sc[m] = 0; why[m] = ""; });
    var ww = {};
    var add = function (m, n, w) { if (sc[m] == null) return; sc[m] += n; if (!why[m] || n > ww[m]) { why[m] = w; ww[m] = n; } }; // keep the strongest reason
    var tl = timeline(d), cur = tl.filter(function (x) { return x.status === "now"; })[0], next = tl.filter(function (x) { return x.status === "later"; })[0];
    if (cur && cur.e.mode) add(cur.e.mode, 4, t("why_now", { title: cur.e.title }));
    if (next && next.e.mode && next.start - nowM <= 180) add(next.e.mode, 3, t("why_next", { title: next.e.title, time: fromMin(next.start) }));
    if (hasMode("artist")) {
      var gt = S.gigs.filter(function (g) { return g.date === d; })[0];
      if (gt) add("artist", 4, t("why_gig_today", { venue: gt.venue }));
      moneyItems("artist").forEach(function (m) {
        if (m.kind === "dep" && -daysSince(m.date) <= 7) add("artist", 2, t("why_deposit", { venue: m.who }));
        if (m.kind === "bal") add("artist", 1, t("why_balance", { venue: m.who }));
      });
    }
    if (hasMode("freelancer")) moneyItems("freelancer").forEach(function (m) {
      if (m.kind === "inv") add("freelancer", m.age >= 14 ? 3 : 2, t("why_invoice", { who: m.who, n: m.age || 0 }));
      else add("freelancer", 1, t("why_quote", { who: m.who }));
    });
    if (hasMode("home")) {
      if (h >= 16 && h < 20) add("home", 2, t("why_dinner"));
      if (weekdayIndex(d) >= 5 && groceryItems().some(function (k) { return !S.grocery[k]; })) add("home", 1, t("why_grocery"));
      if (S.events.some(function (e) { return e.date === d && evKind(e.title)[0] === "care"; })) add("home", 1, t("why_kids"));
    }
    if (weekdayIndex(d) < 5 && h >= 8 && h < 18) add("office", 2, t("why_workhours"));
    return S.modes.map(function (m) { return { m: m, s: sc[m], why: why[m] }; })
      .sort(function (a, b) { return b.s - a.s || (a.m === "office" ? 1 : b.m === "office" ? -1 : 0); });
  }
  function autoMode() { var r = modeScores(); return r.length ? r[0].m : "office"; }
  function contextBody(m) {
    var d = today();
    if (m === "office") {
      var bs = bestSlot(), fb = focusBlock();
      return fb ? "<p>" + esc(t("hl_focus_set", { when: (fb.date === d ? t("today_label") : dayLabel(fb.date)) + " " + fb.time + (fb.end ? "–" + fb.end : ""), title: fb.title })) + "</p>"
        : bs ? "<p>" + esc(t("hl_focus_tip", { range: PEAK[bs.slot].join("–"), slot: t("slot_" + bs.slot + "_long") })) + '</p><button type="button" class="btn ghost" data-act="focus-block">' + esc(t("hl_focus_btn")) + "</button>"
        : "<p>" + esc(t("hl_focus_need")) + "</p>";
    }
    if (m === "home") {
      if (!S.mealPlan.length) S.mealPlan = newWeek();
      var left = groceryItems().filter(function (k) { return !S.grocery[k]; }).length;
      return "<p>" + esc(t("hl_home")) + ": <b>" + esc(mealName(meal(S.mealPlan[weekdayIndex(d)]))) + '</b> <span class="muted">· ' + esc(t("h_grocery")) + ": " + esc(t("h_left", { n: left })) + "</span></p>" +
        (left ? '<button type="button" class="btn ghost" data-act="share-grocery">' + esc(t("hl_share_grocery")) + "</button>" : "");
    }
    var items = moneyItems(m);
    var gig = m === "artist" ? nextGig() : null;
    return (gig ? "<p>" + esc(t("ctx_next_gig", { venue: gig.venue, date: dayLabel(gig.date), fee: money(gig.fee) })) + "</p>" : "") +
      (items.length ? '<ul class="list">' + items.slice(0, 2).map(moneyRow).join("") + "</ul>" + (items.length > 2 ? '<p class="note">' + esc(t("hl_money_more", { n: items.length - 2 })) + "</p>" : "")
        : "<p>" + esc(t(m === "freelancer" ? "hl_money_none" : "hl_money_none_artist")) + "</p>");
  }
  // Today: only the 1–2 roles that matter now, chosen automatically.
  function modeHighlight() {
    var r = modeScores(), show = r.filter(function (x, i) { return i === 0 || x.s >= 2; }).slice(0, 2);
    return '<section class="card ctx-card"><div class="row between"><h2 class="card-h">' + icon("spark", 16) + esc(t("ctx_title")) + '</h2><button type="button" class="link-btn" data-act="tab" data-v="mode">' + esc(t("ctx_all")) + " →</button></div>" +
      show.map(function (x) {
        var M = DATA.modes[x.m];
        return '<div class="ctx" style="--c:' + M.accent + '"><p class="eyebrow">' + icon(M.icon, 14) + esc(t("mode_" + x.m)) + (x.why ? '<span class="ctx-why">' + esc(x.why) + "</span>" : "") + "</p>" + contextBody(x.m) + "</div>";
      }).join("") + "</section>";
  }

  function aiButtons() {
    var list = [["plan", DATA.cost.standard], ["meal", DATA.cost.standard]];
    list.push(["inbox", 0]);
    if (hasMode("home")) list.push(["groceries", DATA.cost.standard]);
    if (hasMode("freelancer") || hasMode("artist")) list.push(["money", DATA.cost.standard]);
    return list.map(function (x) {
      return '<button type="button" class="ask" data-act="ai" data-v="' + x[0] + '"><span>' + esc(t("ai_" + x[0])) + '</span><span class="cost">' + esc(x[1] ? t("ai_cost", { n: x[1] }) : t("ai_free")) + "</span></button>";
    }).join("");
  }

  // ---------- Today: daily rhythm cards ----------
  function streakRow() {
    var s = streakInfo(), nm = nextMilestone(s.n);
    var txt = s.n ? t("streak_n", { n: s.n }) : t("streak_zero");
    var extra = s.n && nm ? t("streak_next", { d: nm[0] - s.n, c: nm[1] }) : "";
    return '<div class="streak-row"><span class="streak' + (s.today ? " on" : "") + '">' + icon("flame", 16) + "<b>" + esc(txt) + "</b></span>" +
      (extra ? '<span class="muted small">' + esc(extra) + "</span>" : "") +
      '<button type="button" class="link-btn" data-act="review" data-v="7">' + esc(t("rv_week_btn")) + " →</button></div>";
  }
  function weeklyBanner() {
    var wi = weekdayIndex(today()); if (wi !== 6 && wi !== 0) return "";
    var key = lastSunday(); if (S.lastWeekly === key || periodStats(key, 7).checkins < 3) return "";
    return '<section class="card highlight"><h2 class="card-h">' + icon("spark", 16) + esc(t("rv_ready")) + "</h2><p>" + esc(t("rv_ready_note")) + '</p><button type="button" class="btn" data-act="review" data-v="7" data-end="' + key + '">' + esc(t("rv_open")) + "</button></section>";
  }
  function firstInsight() {
    if (!S.rhythm || energyStats().best) return "";
    var h = hoursBetween(S.rhythm.bed, S.rhythm.wake), L = [];
    L.push(t("fi_sleep", { h: dec(h), bed: S.rhythm.bed, wake: S.rhythm.wake }));
    if (h < 7) { var w = S.rhythm.wake.split(":"), m = ((+w[0] * 60 + +w[1] - 450) % 1440 + 1440) % 1440; L.push(t("fi_sleep_low", { time: pad(Math.floor(m / 60)) + ":" + pad(m % 60) })); }
    if (S.rhythm.peak) L.push(t("fi_peak", { slot: t("slot_" + S.rhythm.peak + "_long"), range: PEAK[S.rhythm.peak].join("–") }));
    L.push(t("fi_check", { n: Math.max(1, 4 - energyStats().total) }));
    return '<section class="card insight-card"><h2 class="card-h">' + icon("spark", 16) + esc(t("fi_title")) + "</h2>" + ulist(L) + "</section>";
  }
  function topThree() {
    var d = today(), open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue);
    var f = S.focus && S.focus[d] && findById(open, S.focus[d]);
    return (f ? [f].concat(open.filter(function (x) { return x !== f; })) : open).slice(0, 3);
  }
  function phaseCard() {
    var h = new Date().getHours();
    if (h >= 4 && h < 12) return morningCard();
    if (h >= 18 || h < 4) return eveningCard();
    return ""; // afternoon: the energy card below covers it
  }
  function morningCard() {
    var d = today(), sl = sleepHours(d), us = usualSleep(), cur = (S.energy[d] || {}).m, top = topThree(), bs = bestSlot(), focusId = (S.focus || {})[d];
    var sleepPart = sl ? '<p class="done-line">' + icon("check", 14) + esc(t("mc_slept", { h: dec(sl) })) + "</p>" :
      '<p class="q">' + esc(t("mc_sleep_q")) + '</p><div class="row gap wrap">' +
      (us ? '<button type="button" class="btn" data-act="sleep-usual">' + esc(t("mc_usual", { bed: us.bed, wake: us.wake })) + "</button>" : "") +
      '<button type="button" class="btn ghost" data-act="sleep-other">' + esc(t("mc_other")) + "</button></div>";
    var step = function (n, inner, ok) { return '<div class="phase-step' + (ok ? " ok" : "") + '"><span class="num">' + (ok ? icon("check", 14) : n) + '</span><div class="grow">' + inner + "</div></div>"; };
    return '<section class="card phase" id="phase-card"><h2 class="card-h">' + icon("sun", 16) + esc(t("mc_title")) + '<span class="muted small push">' + esc(t("mc_time")) + "</span></h2>" +
      step(1, sleepPart, !!sl) +
      step(2, '<p class="q">' + esc(t("ci_q_morning")) + "</p>" + checkStep("m"), !!cur) +
      step(3, '<p class="q">' + esc(t("mc_top3")) + "</p>" + (top.length ? '<ul class="list">' + top.map(function (x) { return taskRow(x, { focus: x.id === focusId }); }).join("") + "</ul>" : '<p class="muted">' + esc(t("empty_tasks")) + "</p>") +
        (bs ? '<p class="note">' + esc(t(bs.real ? "mc_hard" : "mc_hard_guess", { range: PEAK[bs.slot].join("–"), slot: t("slot_" + bs.slot + "_long") })) + "</p>" : ""), false) +
      "</section>";
  }
  function eveningCard() {
    var d = today(), tm = addDays(d, 1), cur = (S.energy[d] || {}).e;
    var doneToday = S.tasks.filter(function (x) { return x.done && x.doneAt === d; }).length;
    var open = S.tasks.filter(function (x) { return !x.done; }).sort(byDue).slice(0, 5);
    var picked = (S.focus || {})[tm], finished = cur && (picked || !open.length);
    var step = function (n, inner, ok) { return '<div class="phase-step' + (ok ? " ok" : "") + '"><span class="num">' + (ok ? icon("check", 14) : n) + '</span><div class="grow">' + inner + "</div></div>"; };
    return '<section class="card phase" id="phase-card"><h2 class="card-h">' + icon("moon", 16) + esc(t("ec_title")) + '<span class="muted small push">' + esc(t("ec_time")) + "</span></h2>" +
      (finished ? '<p class="done-line big">' + icon("check", 16) + esc(t("ec_done", { n: streakInfo().n })) + "</p>" : "") +
      step(1, '<p class="q">' + esc(t("ci_q_evening")) + "</p>" + checkStep("e"), !!cur) +
      step(2, '<p class="q">' + esc(t("ec_tomorrow")) + "</p>" + (open.length ? '<div class="pick-list">' + open.map(function (x) {
        var on = picked === x.id;
        return '<button type="button" class="pick' + (on ? " on" : "") + '" data-act="focus-pick" data-id="' + esc(x.id) + '" aria-pressed="' + on + '">' + (on ? icon("check", 14) : "") + "<span>" + esc(x.title) + "</span></button>";
      }).join("") + "</div>" : '<p class="muted">' + esc(t("ec_no_tasks")) + "</p>"), !!picked) +
      '<p class="note">' + esc(doneToday ? t("ec_done_today", { n: doneToday }) : t("ec_none_today")) + "</p></section>";
  }
  function reviewCard() {
    var open = S.unlocks && S.unlocks["month:" + today().slice(0, 7)];
    return '<section class="card"><h2 class="card-h">' + icon("spark", 16) + esc(t("rv_title")) + '</h2><p class="note">' + esc(t("rv_note")) + '</p><div class="row gap wrap">' +
      '<button type="button" class="btn" data-act="review" data-v="7">' + esc(t("rv_week_btn")) + "</button>" +
      '<button type="button" class="btn ghost" data-act="review" data-v="30">' + esc(open ? t("rv_month_btn") : t("rv_month_lock", { n: MONTH_COST })) + "</button></div></section>";
  }
  function remindCard() {
    var R = S.reminders, hasN = "Notification" in window, on = hasN && R.notify && Notification.permission === "granted";
    return '<section class="card" id="remind-card"><h2 class="card-h">' + icon("bell", 16) + esc(t("rm_title")) + '</h2><p class="note">' + esc(t("rm_note")) + "</p>" +
      '<form class="form inline" data-form="remind">' + timeSelect("morning", R.morning, t("rm_morning")) + timeSelect("evening", R.evening, t("rm_evening")) + '<button type="submit" class="btn ghost">' + esc(t("save")) + "</button></form>" +
      '<div class="row gap wrap"><button type="button" class="btn" data-act="remind-ics">' + icon("cal", 16) + esc(t("rm_ics")) + "</button>" +
      (hasN ? '<button type="button" class="btn ghost" data-act="remind-notify"' + (on ? " disabled" : "") + ">" + icon("bell", 16) + esc(on ? t("rm_notify_on") : t("rm_notify")) + "</button>" : "") + "</div>" +
      '<p class="note">' + esc(t("rm_ics_note")) + "</p></section>";
  }
  function icsCard() {
    return '<section class="card" id="ics-card"><h2 class="card-h">' + icon("cal", 16) + esc(t("ics_title")) + '</h2><p class="note">' + esc(t("ics_note")) + "</p>" +
      '<ol class="steps-list"><li>' + esc(t("ics_g")) + "</li><li>" + esc(t("ics_o")) + "</li></ol>" +
      '<label class="btn ghost file-btn">' + esc(t("ics_btn")) + '<input type="file" accept=".ics,text/calendar" data-act="import-ics"></label></section>';
  }

  // ---------- Plan ----------
  function scrPlan() {
    var seg = '<div class="seg wide" role="tablist"><button type="button" role="tab" aria-selected="' + (UI.planTab === "calendar") + '" class="' + (UI.planTab === "calendar" ? "on" : "") + '" data-act="plan-tab" data-v="calendar">' + esc(t("plan_calendar")) + '</button><button type="button" role="tab" aria-selected="' + (UI.planTab === "tasks") + '" class="' + (UI.planTab === "tasks" ? "on" : "") + '" data-act="plan-tab" data-v="tasks">' + esc(t("plan_tasks")) + "</button></div>";
    if (UI.planTab === "calendar") {
      var days = []; for (var i = 0; i < 7; i++) days.push(addDays(today(), i));
      var later = S.events.filter(function (e) { return e.date > days[6]; }).sort(function (a, b) { return (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")); });
      return '<h1 class="h1">' + esc(t("nav_plan")) + "</h1>" + seg +
        '<form class="card form inline" data-form="event"><input name="title" required maxlength="80" placeholder="' + esc(t("ev_title")) + '" aria-label="' + esc(t("ev_title")) + '"><input name="date" type="date" required value="' + today() + '" aria-label="' + esc(t("ev_date")) + '"><input name="time" type="time" aria-label="' + esc(t("ev_time")) + '"><input name="end" type="time" aria-label="' + esc(t("ev_end")) + '" title="' + esc(t("ev_end")) + '">' + (S.modes.length > 1 ? '<label class="sel-wrap" aria-label="' + esc(t("mode_label")) + '">' + modeSelect("mode", S.active) + "</label>" : "") + '<button type="submit" class="btn">' + icon("plus", 16) + esc(t("add_event")) + "</button></form>" +
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
    return '<h1 class="h1">' + esc(t("nav_routine")) + "</h1>" + firstInsight() + reviewCard() + energyFull() + timeCard() + sleepCard() + waterCard() + foodCard();
  }
  function energyFull() {
    var d = today(), m = energyModel();
    var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(d, -i));
    var grid = '<div class="heat" role="table" aria-label="' + esc(t("energy_week")) + '"><div role="row" class="heat-row"><span role="columnheader"></span>' + days.map(function (x) { return '<span role="columnheader" class="heat-day' + (x === d ? " now" : "") + '">' + esc(dayShort(x)) + "</span>"; }).join("") + "</div>" +
      SLOTS.map(function (k) {
        return '<div role="row" class="heat-row"><span role="rowheader" class="heat-slot">' + esc(t("slot_" + k)) + "</span>" + days.map(function (x) {
          var v = (S.energy[x] || {})[k];
          return '<span role="cell" class="heat-cell' + (v ? " v" + v : "") + '" title="' + esc(dayLabel(x) + " · " + t("slot_" + k) + (v ? " · " + v + "/5 " + t("lv" + v) : "")) + '">' + (v || "") + "</span>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    var log = m.checks.length ? '<ul class="check-log">' + m.checks.map(function (c, i) {
      return "<li><div><b>" + esc(c.t) + "</b> · " + esc(t("lv" + c.body)) + " · " + esc(t("md" + c.mood)) + " · " + esc(t("ci_stress_s").toLowerCase() + " " + t("st" + c.stress).toLowerCase()) +
        (c.note ? '<span class="muted small">' + esc(c.note) + "</span>" : "") + '</div><button type="button" class="mini" data-act="del-check" data-i="' + i + '" aria-label="' + esc(t("delete")) + '">' + esc(t("delete")) + "</button></li>";
    }).join("") + "</ul>" : '<p class="muted">' + esc(t("em_no_check")) + "</p>";
    return '<section class="card"><h2 class="card-h">' + icon("bolt", 16) + esc(t("em_title")) + "</h2>" + batteryHtml(m) +
      kv([[t("em_cap"), String(m.capT)], [t("em_dem"), String(m.demT)], [t("em_bal"), signed(m.bal) + " · " + t("em_status_" + m.status), m.status === "over" ? "bad-text" : m.status === "ok" ? "ok-text" : ""], [t("em_left_plan"), m.left + "%"]]) +
      '<details class="more"><summary>' + esc(t("em_how")) + "</summary>" +
      '<h3 class="sub-h">' + esc(t("em_cap_h")) + "</h3>" + kv(m.cap.map(function (x) { return [x[0], x === m.cap[0] ? String(x[1]) : signed(x[1]), x[1] < 0 ? "bad-text" : ""]; }).concat([[t("em_total"), String(m.capT)]])) +
      '<h3 class="sub-h">' + esc(t("em_dem_h")) + "</h3>" + kv(m.dem.map(function (x) { return [x[0], "−" + x[1]]; }).concat([[t("em_total"), String(m.demT)]])) +
      '<p class="note">' + esc(t("em_formula")) + "</p></details>" +
      '<h3 class="sub-h">' + esc(t("em_log_h")) + "</h3>" + log +
      '<button type="button" class="btn full" data-act="checkin">' + esc(t("ci_open")) + "</button>" +
      '<h3 class="sub-h">' + esc(t("tips_title")) + "</h3>" + tipsHtml(energyTips(m)) +
      '<h3 class="sub-h">' + esc(t("energy_week")) + "</h3>" + grid + ulist(energyInsightLines()) + "</section>";
  }
  function sleepCard() {
    var d = today(), s = S.sleep[d] || {}, sl = sleepHours(d);
    var days = []; for (var i = 6; i >= 0; i--) days.push(addDays(d, -i));
    var vals = days.map(sleepHours), logged = vals.filter(function (x) { return x; });
    var avg = logged.length ? Math.round(logged.reduce(function (a, b) { return a + b; }, 0) / logged.length * 10) / 10 : 0;
    var bars = logged.length ? '<div class="sleep-bars" aria-label="' + esc(t("r_sleep_week", { h: dec(avg) })) + '">' + days.map(function (x, i) {
      var h = vals[i];
      return '<div class="sb"><span class="sb-val">' + (h ? h : "") + '</span><div class="sb-track"><span class="goal"></span><span class="sb-bar' + (h && h < 7 ? " low" : "") + '" style="height:' + (h ? Math.min(100, h / 10 * 100) : 0) + '%"></span></div><span class="sb-day">' + esc(dayShort(x)) + "</span></div>";
    }).join("") + "</div>" : "";
    return '<section class="card" id="sleep-card"><h2 class="card-h">' + esc(t("r_sleep")) + " · " + esc(t("r_last_night")) + "</h2>" +
      '<form class="form inline" data-form="sleep">' + timeSelect("bed", s.bed, t("r_bed")) + timeSelect("wake", s.wake, t("r_wake")) + '<button type="submit" class="btn">' + esc(t("save")) + "</button></form>" +
      (sl ? '<p class="big-num">' + esc(t("r_sleep_hours", { h: dec(sl) })) + "</p>" + (sl < 7 ? '<p class="warn">' + esc(t("r_sleep_low")) + "</p>" : "") : "") +
      '<h3 class="sub-h">' + esc(logged.length ? t("r_sleep_week", { h: dec(avg) }) : t("r_sleep_none")) + "</h3>" + bars +
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
  // One "Work" page for the whole person: every role they have, most relevant first (no manual switching).
  function scrMode() {
    var fn = { office: modeOffice, home: modeHome, freelancer: modeFreelancer, artist: modeArtist };
    var order = modeScores().map(function (x) { return x.m; }).filter(function (m) { return m !== "office"; }).concat(["office"]);
    return '<h1 class="h1">' + esc(t("nav_work")) + '</h1><p class="sub">' + esc(t("work_sub")) + "</p>" + order.map(function (m) {
      var M = DATA.modes[m];
      return '<section class="work-sec" id="sec-' + m + '" style="--c:' + M.accent + '"><p class="eyebrow">' + icon(M.icon, 14) + esc(t("mode_" + m)) + "</p>" +
        fn[m]().replace(/<h1 class="h1">/g, '<h2 class="sec-h">').replace(/<\/h1>/g, "</h2>") + "</section>";
    }).join("");
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
      '<section class="card"><h2 class="card-h">' + icon("spark", 16) + esc(t("credits_title")) + " · " + S.credits + '</h2><p>' + esc(t("credits_what")) + "</p>" + ulist([t("credits_costs"), t("credits_earn"), t("credits_test")]) +
      '<button type="button" class="btn' + (claimed ? " ghost" : "") + '" data-act="bonus"' + (claimed ? " disabled" : "") + ">" + esc(claimed ? t("daily_claimed") : t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + "</button></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_language")) + " & " + esc(t("m_currency")) + '</h2><div class="row gap wrap"><div class="seg"><button type="button" class="' + (S.lang === "en" ? "on" : "") + '" data-act="set-lang" data-v="en" aria-pressed="' + (S.lang === "en") + '">English</button><button type="button" class="' + (S.lang === "vi" ? "on" : "") + '" data-act="set-lang" data-v="vi" aria-pressed="' + (S.lang === "vi") + '">Tiếng Việt</button></div>' +
      '<label class="sel-wrap" aria-label="' + esc(t("m_currency")) + '"><select data-act="currency">' + currencies.map(function (c) { return '<option value="' + c + '"' + (S.currency === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label></div></section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_modes")) + '</h2><p class="note">' + esc(t("m_modes_note")) + "</p>" + DATA.modeOrder.map(function (m) {
        var on = S.modes.indexOf(m) > -1;
        return '<label class="check mode-toggle" style="--c:' + DATA.modes[m].accent + '"><input type="checkbox" data-act="toggle-mode" data-v="' + m + '"' + (on ? " checked" : "") + (m === "office" ? " disabled" : "") + "> <span><b>" + esc(t("mode_" + m)) + '</b><br><span class="muted small">' + esc(t("mode_" + m + "_desc")) + "</span></span></label>";
      }).join("") + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_profile")) + '</h2><label class="check"><input type="checkbox" data-act="toggle-track"' + (S.track ? " checked" : "") + "> <span>" + esc(t("r_track")) + "</span></label>" + (S.track ? profileForm("body") : "") + "</section>" +
      remindCard() + icsCard() + syncCard() +
      '<section class="card"><h2 class="card-h">' + esc(t("m_samples")) + '</h2><p class="note">' + esc(t("m_samples_note")) + "</p>" + sampleCards() + "</section>" +
      '<section class="card"><h2 class="card-h">' + esc(t("m_data")) + '</h2><p class="note">' + esc(t("m_data_note")) + '</p><div class="row gap wrap"><button type="button" class="btn ghost" data-act="export">' + esc(t("m_export")) + '</button><label class="btn ghost file-btn">' + esc(t("m_import")) + '<input type="file" accept=".json,application/json" data-act="import"></label><button type="button" class="btn danger" data-act="reset">' + esc(t("m_reset")) + '</button></div><p class="note">' + esc(t("m_install")) + "</p></section>" +
      '<p class="note center">' + esc(t("m_about")) + "</p>";
  }

  function syncCard() {
    if (!CFG.SHEET_ENDPOINT) return "";
    return '<section class="card"><h2 class="card-h">' + esc(t("sync_title")) + '</h2><p class="note" id="sync-status" role="status">' + esc(syncLabel()) + "</p>" +
      '<p>' + esc(t("sync_code_note")) + '</p><div class="code-row"><code class="sync-code">' + esc(S.deviceId) + '</code><button type="button" class="mini" data-act="copy-code">' + esc(t("sync_copy")) + "</button></div>" +
      '<form class="form inline" data-form="restore"><input name="code" required maxlength="64" placeholder="' + esc(t("sync_restore_ph")) + '" aria-label="' + esc(t("sync_restore_ph")) + '" autocomplete="off" spellcheck="false"><button type="submit" class="btn ghost">' + esc(t("sync_restore_btn")) + "</button></form>" +
      '<div class="row gap wrap"><button type="button" class="btn ghost" data-act="sync-now">' + esc(t("sync_now")) + '</button></div><p class="note">' + esc(t("consent_note")) + "</p></section>";
  }

  // ---------- modals ----------
  function modal() {
    var M = UI.modal; if (!M) return "";
    var title = M.title, inner = "";
    if (M.kind === "ai") inner = '<div class="ai-text">' + M.html + "</div>" + (M.spent ? '<p class="note">' + esc(t("ai_spent", { n: M.spent })) + "</p>" : "");
    if (M.kind === "credits") {
      var claimed = S.lastBonus === today();
      title = t("credits_title") + " · " + S.credits;
      inner = "<p>" + esc(t("credits_what")) + "</p>" + ulist([t("credits_costs"), t("credits_earn"), t("credits_test")]) +
        '<button type="button" class="btn full' + (claimed ? " ghost" : "") + '" data-act="bonus"' + (claimed ? " disabled" : "") + ">" + esc(claimed ? t("daily_claimed") : t("daily_bonus", { n: CFG.DAILY_BONUS || 2 })) + "</button>";
    }
    if (M.kind === "focus") { title = t("fc_title"); inner = focusPicker(); }
    if (M.kind === "checkin") { title = t(M.after ? "ci_title_after" : "ci_title"); inner = checkinForm(M.after); }
    if (M.kind === "checkin-done") { title = t("ci_done_title"); inner = checkinResult(M.c); }
    if (M.kind === "review") { title = t(M.days > 7 ? "rv_month_title" : "rv_week_title"); inner = reviewHtml(M.days, M.end); }
    if (M.kind === "samples") { title = t("m_samples"); inner = '<p class="note">' + esc(t("m_samples_note")) + "</p>" + sampleCards(); }
    if (M.kind === "edit") { var e = editForm(M.type, M.id); if (!e) return ""; title = e.title; inner = e.html; }
    return '<div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-stop="1"><div class="row between"><h2 class="card-h" id="modal-title">' + (M.kind === "ai" || M.kind === "review" ? icon("spark", 16) : M.kind === "checkin" || M.kind === "checkin-done" ? icon("bolt", 16) : "") + esc(title) + '</h2><button type="button" class="icon-btn" data-act="close-modal" aria-label="' + esc(t("close")) + '">' + icon("x", 18) + "</button></div>" + inner + "</div></div>";
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
    if (type === "task") body = f(t("task_title"), inp("title", x.title, 'required maxlength="100"')) + '<div class="grid2">' + f(t("due"), inp("due", x.due, 'type="date"')) + f(t("mode_label"), modeSelect("mode", x.mode)) + "</div>" + f(t("task_est"), inp("est", x.est || "", 'type="number" min="5" max="600" step="5" inputmode="numeric" placeholder="' + TASK_DEFAULT_MIN + '"')) + chk("done", x.done, t("done"));
    if (type === "event") body = f(t("ev_title"), inp("title", x.title, 'required maxlength="80"')) + '<div class="grid2">' + f(t("ev_date"), inp("date", x.date, 'type="date" required')) + f(t("ev_time"), inp("time", x.time, 'type="time"')) + f(t("ev_end"), inp("end", x.end, 'type="time"')) + f(t("ev_travel"), inp("travel", x.travel, 'type="number" min="0" max="240" inputmode="numeric"')) + "</div>" + f(t("mode_label"), modeSelect("mode", x.mode));
    if (type === "quote") body = f(t("f_client"), inp("client", x.client, 'required maxlength="60"')) + f(t("f_service"), inp("service", x.service, 'maxlength="60"')) + '<div class="grid2">' + f(t("f_amount") + " (" + S.currency + ")", inp("amount", x.amount, 'type="number" min="0" required')) +
      f(t("f_stage"), '<select name="stage">' + t("f_stages").map(function (s, i) { return '<option value="' + i + '"' + (i === x.stage ? " selected" : "") + ">" + esc(s) + "</option>"; }).join("") + "</select>") + "</div>";
    if (type === "gig") body = f(t("a_venue"), inp("venue", x.venue, 'required maxlength="60"')) + f(t("a_date"), inp("date", x.date, 'type="date" required')) + '<div class="grid2">' + f(t("a_fee") + " (" + S.currency + ")", inp("fee", x.fee, 'type="number" min="0" required')) + f(t("a_deposit"), inp("deposit", x.deposit, 'type="number" min="0"')) + "</div>" + chk("depPaid", x.depPaid, t("a_dep_paid")) + chk("fullPaid", x.fullPaid, t("a_fully_paid"));
    if (type === "meal") body = f(t("r_meal_name"), inp("name", x.name, 'required maxlength="60"')) + f(t("r_meal_kcal"), inp("kcal", x.kcal, 'type="number" min="0" max="3000" required'));
    return { title: title, html: '<form class="form" data-form="edit">' + body + '<div class="row between wrap"><button type="button" class="btn danger" data-act="delete">' + esc(t("delete")) + '</button><div class="row gap"><button type="button" class="btn ghost" data-act="close-modal">' + esc(t("cancel")) + '</button><button type="submit" class="btn">' + esc(t("save")) + "</button></div></div></form>" };
  }
  function saveEdit(fd) {
    var M = UI.modal, x = getItem(M.type, M.id); if (!x) return;
    var g = function (k) { return (fd.get(k) || "").toString().trim(); };
    if (M.type === "task") { var was = x.done; x.title = g("title"); x.due = g("due"); x.mode = g("mode") || x.mode; x.est = +g("est") || 0; x.done = fd.get("done") === "on"; if (x.done && !was) x.doneAt = today(); if (!x.done) x.doneAt = ""; }
    if (M.type === "event") { x.title = g("title"); x.date = g("date"); x.time = g("time"); x.end = g("end") > g("time") ? g("end") : ""; x.travel = Math.max(0, +g("travel") || 0); x.mode = g("mode") || x.mode; }
    if (M.type === "quote") { x.client = g("client"); x.service = g("service"); x.amount = +g("amount") || 0; x.stage = +g("stage") || 0; stageDates(x); }
    if (M.type === "gig") { x.venue = g("venue"); x.date = g("date"); x.fee = +g("fee") || 0; x.deposit = +g("deposit") || 0; x.depPaid = fd.get("depPaid") === "on"; x.fullPaid = fd.get("fullPaid") === "on"; if (x.fullPaid) { x.depPaid = true; if (!x.paidAt) x.paidAt = today(); } else x.paidAt = ""; }
    if (M.type === "meal") { x.name = g("name"); x.kcal = +g("kcal") || 0; }
    UI.modal = null; clearDrafts("edit"); save(); render(); toast(t("saved"));
  }
  function stageDates(q) {
    if (q.stage >= 2 && !q.invoicedAt) q.invoicedAt = today();
    if (q.stage === 3 && !q.paidAt) q.paidAt = today();
    if (q.stage < 3) q.paidAt = "";
    if (q.stage < 2) q.invoicedAt = "";
  }
  function finishOnboarding(withRhythm) {
    if (withRhythm && UI.obR.peak) S.rhythm = { bed: UI.obR.bed, wake: UI.obR.wake, peak: UI.obR.peak };
    S.modes = DATA.modeOrder.filter(function (m) { return m === "office" || UI.obModes[m]; });
    S.active = S.modes[S.modes.length > 1 ? 1 : 0]; S.onboarded = true; S.tips = { welcome: true };
    save(); UI.tab = "today"; UI.enter = true; render(); track(withRhythm ? "onboarding_done" : "onboarding_done_skip"); pushSync(); scheduleReminders();
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
      case "ob-back": UI.ob = UI.ob === 2 ? 1 : 0; render(); return;
      case "ob-rhythm": UI.ob = 2; render(); track("onboarding_step3"); return;
      case "ob-r": UI.obR[el.getAttribute("data-k")] = v; render(); return;
      case "ob-skip": finishOnboarding(false); return;
      case "ob-demo": var nm2 = document.getElementById("ob-name"); if (nm2) S.name = nm2.value.trim(); UI.ob = "demo"; render(); return;
      case "ob-mode": UI.obModes[v] = !UI.obModes[v]; render(); return;
      case "ob-finish": finishOnboarding(true); return;
      case "sample": if (S.onboarded && !window.confirm(t("sample_confirm"))) return; loadSample(v); return;
      case "open-samples": openModal({ kind: "samples" }); return;
      case "hide-welcome": S.tips.welcome = false; break;
      case "gs-task": UI.focusKey = "qtask.title"; render(); var q = app.querySelector('[data-key="qtask.title"]'); if (q) { q.scrollIntoView({ block: "center" }); q.focus(); } return;
      case "gs-energy": var ec = document.getElementById("energy-card"); if (ec) ec.scrollIntoView({ block: "center", behavior: "smooth" }); return;
      case "gs-food": UI.tab = "routine"; UI.showBody = true; S.track = true; save(); render(); var fc = document.getElementById("food-card"); if (fc) fc.scrollIntoView({ block: "start" }); return;
      case "tab": UI.tab = v; UI.modal = null; UI.enter = true; window.scrollTo(0, 0); track("tab_" + v); render(); return;
      case "plan-tab": UI.planTab = v; render(); return;
      case "credits": openModal({ kind: "credits" }); return;
      case "sync-now": pushSync(); return;
      case "copy-code": copyText(S.deviceId, t("sync_copied")); return;
      case "bonus":
        if (S.lastBonus === today()) { toast(t("daily_claimed")); return; }
        S.lastBonus = today(); S.credits += CFG.DAILY_BONUS || 2; save(); render(); toast(t("daily_bonus", { n: CFG.DAILY_BONUS || 2 }) + " ✓"); track("daily_bonus"); return;
      case "energy": setEnergy(el.getAttribute("data-slot"), +v); return;
      case "toggle-task": if (S.run && S.run.ref === id) { stopRun(); return; } var tk = findById(S.tasks, id); if (tk) { tk.done = !tk.done; tk.doneAt = tk.done ? today() : ""; if (tk.done) track("task_done"); } break;
      case "sleep-usual": var us = usualSleep(); if (!us) return; S.sleep[today()] = { bed: us.bed, wake: us.wake }; track("sleep_quick"); toast(t("saved")); break;
      case "sleep-other": UI.tab = "routine"; UI.enter = true; render(); var sc = document.getElementById("sleep-card"); if (sc) sc.scrollIntoView({ block: "start" }); return;
      case "focus-pick": var tmr = addDays(today(), 1); S.focus[tmr] = S.focus[tmr] === id ? "" : id; if (!S.focus[tmr]) delete S.focus[tmr]; else { S.checkins[today()] = 1; track("evening_focus"); } break;
      case "focus-block": addFocusBlock(); return;
      case "checkin": openModal({ kind: "checkin" }); track("checkin_open"); return;
      case "review-week": openReview(7, el.getAttribute("data-end") || ""); return;
      case "focus-modal": openModal({ kind: "focus" }); return;
      case "toggle-past": UI.showPast = !UI.showPast; render(); return;
      case "goto-timeline": var tlc = document.getElementById("timeline"); if (tlc) tlc.scrollIntoView({ block: "start", behavior: "smooth" }); return;
      case "run-start": startRun(el.getAttribute("data-kind"), id); return;
      case "run-stop": stopRun(); return;
      case "run-cancel": S.run = null; save(); render(); toast(t("run_cancelled")); return;
      case "defer-task": var dt = findById(S.tasks, id); if (!dt) return; dt.due = addDays(today(), 1); UI.modal = null; save(); render(); toast(t("deferred")); track("defer_task"); return;
      case "del-check":
        var dd = today(), li = +el.getAttribute("data-i"), cl = (S.checks[dd] || []), gone = cl.splice(li, 1)[0];
        if (gone) { syncSlotFromChecks(dd, slotOfTime(gone.t)); toast(t("deleted")); }
        break;
      case "review": openReview(+v || 7, el.getAttribute("data-end") || ""); return;
      case "nudge": var txt = nudgeText(el.getAttribute("data-k"), id); if (!txt) return; shareText(txt, t("mr_copied")); track("nudge_" + el.getAttribute("data-k")); return;
      case "paid-quote": var pq = findById(S.quotes, id); if (pq) { pq.stage = 3; stageDates(pq); toast(t("mr_paid_ok")); track("paid"); } break;
      case "share-grocery":
        var gl = groceryItems().filter(function (k) { return !S.grocery[k]; }).map(function (k) { return "• " + ingName(k); });
        shareText(t("grocery_share_head") + "\n" + gl.join("\n"), t("grocery_copied")); track("grocery_share"); return;
      case "gs-remind": UI.tab = "more"; UI.enter = true; render(); var rc = document.getElementById("remind-card"); if (rc) rc.scrollIntoView({ block: "start" }); return;
      case "remind-ics": download("dahand-reminders.ics", remindersIcs(), "text/calendar;charset=utf-8"); S.reminders.set = true; save(); render(); toast(t("rm_ics_done")); track("remind_ics"); return;
      case "remind-notify":
        if (!("Notification" in window)) return;
        var onPerm = function (p) { S.reminders.notify = p === "granted"; if (S.reminders.notify) S.reminders.set = true; save(); render(); scheduleReminders(); toast(t(p === "granted" ? "rm_notify_ok" : "rm_notify_no")); track("remind_notify_" + p); };
        try { var pr = Notification.requestPermission(onPerm); if (pr && pr.then) pr.then(onPerm); } catch (er) { /* ignore */ }
        return;
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
      case "advance": var qq = findById(S.quotes, id); if (qq && qq.stage < 3) { qq.stage++; stageDates(qq); } break;
      case "dep-paid": var g = findById(S.gigs, id); if (g) { g.depPaid = true; toast(t("mr_paid_ok")); } break;
      case "full-paid": var g2 = findById(S.gigs, id); if (g2) { g2.fullPaid = true; g2.depPaid = true; g2.paidAt = today(); toast(t("mr_paid_ok")); } break;
      case "export": download("dahand-data-" + today() + ".json", JSON.stringify(S, null, 2), "application/json"); return;
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
    if (act === "import-ics") {
      var icf = el.files && el.files[0]; if (!icf) return;
      var rd = new FileReader();
      rd.onload = function () {
        var n = importIcs(String(rd.result || ""));
        el.value = ""; if (n) save(); render(); toast(n ? t("ics_ok", { n: n }) : t("ics_none")); track("ics_import");
      };
      rd.readAsText(icf); return;
    }
    if (act === "import") {
      var file = el.files && el.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj || typeof obj !== "object" || !Array.isArray(obj.events) || !Array.isArray(obj.tasks)) throw new Error("bad");
          S = migrate(Object.assign({}, obj, { onboarded: true, deviceId: S.deviceId })); markStreakSeen(); save(); UI.tab = "today"; render(); toast(t("import_ok")); track("import");
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
    if (kind === "restore") {
      var code = g("code").replace(/\s+/g, "").toLowerCase();
      if (!/^[a-z0-9]{8,64}$/.test(code)) { toast(t("sync_restore_none")); return; }
      UI.sync = "saving"; paintSync();
      pullSync(code).then(function (r) {
        UI.sync = "ok"; paintSync();
        if (!r || !r.found || !r.state) { toast(t("sync_restore_none")); return; }
        if (!window.confirm(t("sync_restore_confirm"))) return;
        S = migrate(JSON.parse(r.state)); S.deviceId = code; S.syncedVersion = S.updatedAt = r.updatedAt; save(true); scheduleReminders(); clearDrafts("restore"); UI.tab = "today"; UI.enter = true; render(); toast(t("sync_restore_ok")); track("sync_restore");
      }).catch(function () { UI.sync = "error"; paintSync(); toast(t("sync_error")); });
      return;
    }
    if (kind === "event") { S.events.push({ id: uid(), title: g("title"), date: g("date"), time: g("time"), end: g("end") > g("time") ? g("end") : "", mode: g("mode") || S.active }); track("event_add"); toast(t("saved")); }
    if (kind === "task" || kind === "qtask") { S.tasks.push({ id: uid(), title: g("title"), done: false, mode: g("mode") || S.active, due: kind === "qtask" ? today() : g("due") }); track("task_add"); toast(t("saved")); if (kind === "qtask") UI.focusKey = "qtask.title"; }
    if (kind === "meal") {
      var pick = g("pick"), d = today(), m = meal(pick);
      if (m) { S.meals[d] = S.meals[d] || []; S.meals[d].push({ name: mealName(m), kcal: m.kcal }); }
      else if (pick === "custom" && g("name")) { S.meals[d] = S.meals[d] || []; S.meals[d].push({ name: g("name"), kcal: +g("kcal") || 0 }); }
      else return;
      track("meal_add");
    }
    if (kind === "sleep") { S.sleep[today()] = { bed: g("bed_h") + ":" + g("bed_m"), wake: g("wake_h") + ":" + g("wake_m") }; track("sleep_log"); toast(t("saved")); }
    if (kind === "quote") { S.quotes.push({ id: uid(), client: g("client"), service: g("service"), amount: +g("amount") || 0, stage: 0, createdAt: today() }); toast(t("saved")); }
    if (kind === "gig") { S.gigs.push({ id: uid(), venue: g("venue"), date: g("date"), fee: +g("fee") || 0, deposit: +g("deposit") || 0, depPaid: false, fullPaid: false }); toast(t("saved")); }
    if (kind === "checkin") {
      var cd = today(), c = { t: nowHM(), body: +g("body"), mood: +g("mood"), stress: +g("stress") };
      if (!c.body || !c.mood || !c.stress) { toast(t("ci_need")); return; }
      if (g("ate") !== "") c.ate = +g("ate");
      if (g("water")) { c.water = +g("water"); S.water[cd] = Math.max(S.water[cd] || 0, c.water); }
      if (g("ready")) c.ready = +g("ready");
      if (g("note")) c.note = g("note");
      var aft = UI.modal && UI.modal.after;
      if (aft) {
        c.after = aft.title; c.fuel = +g("fuel"); c.rest = +g("rest");
        if (c.fuel === 2) c.ate = 1;
        if (c.fuel >= 1) S.water[cd] = (S.water[cd] || 0) + 1;
        S.restUntil = c.rest ? Date.now() + c.rest * 60000 : 0;
      }
      S.checks[cd] = S.checks[cd] || []; S.checks[cd].push(c);
      syncSlotFromChecks(cd, slotOfTime(c.t));
      clearDrafts("checkin"); track("checkin_save"); save();
      UI.modal = { kind: "checkin-done", c: c }; UI.modalJustOpened = true; render(); toast(t("ci_saved_at", { t: c.t }));
      return;
    }
    if (kind === "remind") {
      S.reminders.morning = g("morning_h") + ":" + g("morning_m"); S.reminders.evening = g("evening_h") + ":" + g("evening_m");
      scheduleReminders(); toast(t(S.reminders.set ? "rm_saved_again" : "saved")); track("remind_time");
    }
    if (kind === "body") {
      S.profile = { sex: g("sex"), age: +g("age"), height: +g("height"), weight: +g("weight"), activity: +g("activity"), pregnant: fd.get("pregnant") === "on" };
      S.track = true; UI.showBody = false; toast(t("saved")); track("profile_set");
    }
    clearDrafts(kind); save(); render();
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && UI.modal) { UI.modal = null; clearDrafts("edit"); render(); } });

  // ---------- start ----------
  initAnalytics();
  if (S.onboarded && S.lastOpen !== today()) { track(S.lastOpen ? "return_visit" : "first_open"); S.lastOpen = today(); save(true); }
  if (!S.onboarded) track("onboarding_start");
  render();
  startupPull();
  scheduleReminders();
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { scheduleReminders(); if (S.onboarded && UI.lastDay !== today()) { UI.lastDay = today(); render(); } } });
  UI.lastDay = today();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { /* offline cache optional */ }); });
  }
})();
