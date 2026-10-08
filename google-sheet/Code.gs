/**
 * DaHand – Google Sheets backend (Google Apps Script)
 * ---------------------------------------------------
 * Cách dùng (xem README.md, mục "Lưu dữ liệu về Google Sheets"):
 * 1. Tạo một Google Sheet mới.
 * 2. Tiện ích mở rộng (Extensions) → Apps Script → xóa hết, dán toàn bộ file này → Lưu.
 * 3. Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment) → Loại: Ứng dụng web (Web app)
 *    - Thực thi với tư cách (Execute as): Tôi (Me)
 *    - Người có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 4. Sao chép "URL ứng dụng web" → dán vào SHEET_ENDPOINT trong js/config.js của app.
 *
 * Sheet sẽ tự tạo 4 trang: Users (tổng quan mỗi người), Events (nhật ký thao tác), Timing (thời gian thực tế so với dự kiến), Data (bản lưu đầy đủ).
 */

var USERS_HEADERS = ["deviceId", "name", "lang", "modes", "activeMode", "sample", "createdAt", "lastSeen",
  "tasksOpen", "tasksDone", "events", "energyCheckins7d", "avgEnergy7d", "avgSleep7d", "mealsLogged7d",
  "calorieTracking", "credits", "quotes", "gigs", "streak", "bestSlot", "reminders"];
var EVENTS_HEADERS = ["time", "deviceId", "event", "mode", "lang"];
var DATA_HEADERS = ["deviceId", "updatedAt"]; // then chunk columns
var TIMING_HEADERS = ["time", "deviceId", "title", "category", "plannedMin", "actualMin", "diffMin", "date", "start", "end"];
var CHUNK = 45000;   // Google Sheets: max 50,000 characters per cell
var MAX_CHUNKS = 20; // ~900 KB per user

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var id = cleanId(body.id);
    if (!id) return json({ ok: false, error: "missing id" });
    if (body.type === "sync") {
      upsertUser(id, body.summary || {});
      if (typeof body.state === "string") saveData(id, body.updatedAt || Date.now(), body.state);
    }
    if (body.type === "events" || (body.events && body.events.length)) appendEvents(id, body.events || []);
    if (body.timings && body.timings.length) appendTimings(id, body.timings);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// GET ?id=<deviceId>  → returns the saved state so the user can continue on another device.
function doGet(e) {
  var id = cleanId(e && e.parameter && e.parameter.id);
  if (!id) return json({ ok: true, service: "DaHand" });
  var sh = sheet("Data", DATA_HEADERS);
  var row = findRow(sh, id);
  if (!row) return json({ ok: true, found: false });
  var values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var state = values.slice(2).join("");
  return json({ ok: true, found: true, updatedAt: Number(values[1]) || 0, state: state });
}

// ---------- helpers ----------
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function cleanId(id) {
  id = String(id || "").trim();
  return /^[a-z0-9]{8,64}$/i.test(id) ? id : "";
}
function sheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
function findRow(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  var hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}
function upsertUser(id, s) {
  var sh = sheet("Users", USERS_HEADERS);
  var now = new Date();
  var row = findRow(sh, id);
  var created = row ? sh.getRange(row, 7).getValue() : now;
  var values = [id, s.name || "", s.lang || "", (s.modes || []).join(", "), s.active || "", s.sample || "", created, now,
    num(s.tasksOpen), num(s.tasksDone), num(s.events), num(s.energy7d), s.avgEnergy7d || "", s.avgSleep7d || "", num(s.meals7d),
    s.tracking ? "yes" : "no", num(s.credits), num(s.quotes), num(s.gigs), num(s.streak), s.bestSlot || "", s.reminders ? "yes" : "no"];
  if (row) sh.getRange(row, 1, 1, values.length).setValues([values]);
  else sh.appendRow(values);
}
function saveData(id, updatedAt, state) {
  var sh = sheet("Data", DATA_HEADERS);
  var chunks = [];
  for (var i = 0; i < state.length && chunks.length < MAX_CHUNKS; i += CHUNK) chunks.push(state.slice(i, i + CHUNK));
  var values = [id, updatedAt].concat(chunks);
  var found = findRow(sh, id);
  if (found && Number(sh.getRange(found, 2).getValue()) > Number(updatedAt)) return; // keep the newer copy
  var row = found || sh.getLastRow() + 1;
  var width = Math.max(values.length, sh.getLastColumn());
  while (values.length < width) values.push("");
  sh.getRange(row, 1, 1, values.length).setValues([values]);
}
function appendEvents(id, list) {
  if (!list.length) return;
  var sh = sheet("Events", EVENTS_HEADERS);
  var rows = list.slice(0, 200).map(function (ev) {
    return [new Date(ev.t || Date.now()), id, String(ev.name || "").slice(0, 60), ev.mode || "", ev.lang || ""];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENTS_HEADERS.length).setValues(rows);
}
// Real time vs planned time for each task / event the user timed (Start → Done).
function appendTimings(id, list) {
  var sh = sheet("Timing", TIMING_HEADERS);
  var rows = list.slice(0, 200).map(function (x) {
    return [new Date(x.t || Date.now()), id, String(x.title || "").slice(0, 80), x.cat || "", num(x.planned), num(x.actual), num(x.actual) - num(x.planned), x.date || "", x.start || "", x.end || ""];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, TIMING_HEADERS.length).setValues(rows);
}
function num(x) { return Number(x) || 0; }
