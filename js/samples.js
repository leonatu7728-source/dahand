/* DaHand – sample personas. Data is generated relative to "today" so the demo always looks current.
   Each persona: 3 weeks of calendar, tasks, 14 days of sleep / energy / meals / water, plus mode data. */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function add(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function dow(s) { return parse(s).getDay(); } // 0 = Sunday
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hm(mins) { mins = ((mins % 1440) + 1440) % 1440; return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60); }
  function L(pair, lang) { return lang === "vi" ? pair[1] : pair[0]; }

  var id = 0;
  function uid() { id++; return "s" + id.toString(36) + Math.random().toString(36).slice(2, 6); }

  // weekly: [weekday(0-6), "HH:MM", [en, vi], mode]   once: [dayOffset, "HH:MM", [en, vi], mode]
  function buildEvents(p, today, lang) {
    var out = [];
    for (var o = -7; o <= 14; o++) {
      var d = add(today, o), wd = dow(d);
      (p.weekly || []).forEach(function (w) { if (w[0] === wd) out.push({ id: uid(), title: L(w[2], lang), date: d, time: w[1], mode: w[3] }); });
    }
    (p.once || []).forEach(function (e) { out.push({ id: uid(), title: L(e[2], lang), date: add(today, e[0]), time: e[1], mode: e[3] }); });
    return out;
  }
  function buildTasks(p, today, lang) {
    return (p.tasks || []).map(function (t) { return { id: uid(), title: L(t[0], lang), done: !!t[2], mode: t[3], due: t[1] === null ? "" : add(today, t[1]) }; });
  }
  function buildHealth(p, today, r) {
    var sleep = {}, energy = {}, meals = {}, water = {};
    var M = window.DAHAND_DATA.meals;
    for (var o = -13; o <= 0; o++) {
      var d = add(today, o);
      var weekend = dow(d) === 0 || dow(d) === 6;
      var bed = p.bed + Math.round((r() - 0.5) * 60) + (weekend ? 40 : 0);
      var wake = p.wake + Math.round((r() - 0.5) * 40) + (weekend ? 60 : 0);
      sleep[d] = { bed: hm(bed), wake: hm(wake) };
      var nowH = new Date().getHours(), list = [];
      for (var c = 0; c < 3; c++) {
        var hour = [9, 14, 19][c];
        if (o === 0 && hour >= nowH) continue;
        var v = Math.max(1, Math.min(5, Math.round(3 + (Math.abs(hour - p.peak) < 3 ? 1.4 : -0.3) + (r() - 0.5) * 1.6)));
        list.push({ t: pad(hour) + ":" + pad(Math.floor(r() * 50)), v: v });
      }
      energy[d] = list;
      if (o >= -6) {
        var picks = o < 0 ? ["breakfast", "lunch", "dinner"] : (nowH >= 13 ? ["breakfast", "lunch"] : nowH >= 9 ? ["breakfast"] : []);
        meals[d] = picks.map(function (type) {
          var pool = M.filter(function (m) { return m.type === type || (type === "dinner" && m.type === "lunch"); });
          var m = pool[Math.floor(r() * pool.length)];
          return { name: p.lang === "vi" ? m.vi : m.en, kcal: m.kcal + Math.round((r() - 0.5) * 60) };
        });
        if (o < 0 && r() > 0.5) meals[d].push({ name: p.lang === "vi" ? "Cà phê sữa" : "Latte", kcal: 150 });
      }
      water[d] = o === 0 ? 3 : 4 + Math.floor(r() * 5);
    }
    return { sleep: sleep, energy: energy, meals: meals, water: water };
  }

  var PERSONAS = [
    {
      id: "office", name: "Emma Carter", modes: ["office"], seed: 11,
      desc: ["Marketing manager in London. Back-to-back meetings, deadlines, gym twice a week.", "Trưởng nhóm marketing ở London. Họp liên tục, nhiều deadline, tập gym 2 buổi/tuần."],
      profile: { sex: "female", age: 32, height: 165, weight: 62, activity: 2, pregnant: false }, bed: 23 * 60 + 30, wake: 6 * 60 + 45, peak: 10,
      weekly: [
        [1, "09:30", ["Team stand-up", "Họp nhanh đầu tuần"], "office"], [1, "14:00", ["1:1 with Sarah", "Họp 1:1 với Sarah"], "office"],
        [2, "11:00", ["Campaign review", "Duyệt chiến dịch"], "office"], [2, "18:30", ["Gym", "Tập gym"], "office"],
        [3, "09:30", ["Team stand-up", "Họp nhanh"], "office"], [3, "15:00", ["Agency call", "Gọi agency"], "office"],
        [4, "10:00", ["Budget meeting", "Họp ngân sách"], "office"], [4, "18:30", ["Gym", "Tập gym"], "office"],
        [5, "16:00", ["Weekly report due", "Hạn nộp báo cáo tuần"], "office"], [6, "11:00", ["Brunch with Chloe", "Ăn brunch với Chloe"], "office"]
      ],
      once: [[2, "13:00", ["Dentist", "Khám răng"], "office"], [6, "10:00", ["Q4 planning workshop", "Workshop kế hoạch Q4"], "office"], [9, "19:00", ["Mum's birthday dinner", "Ăn tối sinh nhật mẹ"], "office"]],
      tasks: [
        [["Send Q3 campaign results to Sarah", "Gửi kết quả chiến dịch Q3 cho Sarah"], 0, false, "office"],
        [["Approve new landing page copy", "Duyệt nội dung landing page mới"], 0, false, "office"],
        [["Book flights for the Berlin trip", "Đặt vé máy bay đi Berlin"], 3, false, "office"],
        [["Renew gym membership", "Gia hạn thẻ gym"], 5, false, "office"],
        [["Prepare slides for budget meeting", "Chuẩn bị slide họp ngân sách"], 1, false, "office"],
        [["Reply to recruiter email", "Trả lời email nhà tuyển dụng"], null, false, "office"],
        [["Expense report for September", "Báo cáo chi phí tháng 9"], -2, true, "office"],
        [["Update team OKRs", "Cập nhật OKR của nhóm"], -1, true, "office"]
      ]
    },
    {
      id: "home", name: "Linh Nguyen", modes: ["office", "home"], seed: 22,
      desc: ["Mum of two, part-time remote bookkeeper. School runs, meals and client deadlines.", "Mẹ hai con, làm kế toán online bán thời gian. Đưa đón con, nấu nướng và deadline khách hàng."],
      profile: { sex: "female", age: 35, height: 158, weight: 55, activity: 1, pregnant: false }, bed: 23 * 60, wake: 6 * 60, peak: 9,
      weekly: [
        [1, "07:30", ["School drop-off", "Đưa con đi học"], "home"], [1, "16:30", ["School pickup", "Đón con"], "home"], [1, "09:00", ["Client books – Bloom Café", "Làm sổ sách – Bloom Café"], "office"],
        [2, "07:30", ["School drop-off", "Đưa con đi học"], "home"], [2, "17:00", ["Swimming class (Bin)", "Học bơi (Bin)"], "home"],
        [3, "07:30", ["School drop-off", "Đưa con đi học"], "home"], [3, "10:00", ["Video call with accountant team", "Họp video với nhóm kế toán"], "office"], [3, "16:30", ["School pickup", "Đón con"], "home"],
        [4, "07:30", ["School drop-off", "Đưa con đi học"], "home"], [4, "17:00", ["Piano lesson (Na)", "Học piano (Na)"], "home"],
        [5, "07:30", ["School drop-off", "Đưa con đi học"], "home"], [5, "15:00", ["Send weekly invoices", "Gửi hóa đơn hằng tuần"], "office"],
        [6, "09:00", ["Grocery run", "Đi chợ cuối tuần"], "home"], [0, "11:00", ["Lunch at grandma's", "Ăn trưa nhà bà"], "home"]
      ],
      once: [[1, "08:30", ["Parent–teacher meeting", "Họp phụ huynh"], "home"], [4, "14:00", ["Kids' vaccination", "Tiêm phòng cho con"], "home"], [8, "10:00", ["Tax filing deadline – client", "Hạn khai thuế cho khách"], "office"]],
      tasks: [
        [["Pay electricity and water bills", "Đóng tiền điện, nước"], 0, false, "home"],
        [["Reconcile Bloom Café bank statement", "Đối chiếu sao kê Bloom Café"], 1, false, "office"],
        [["Buy Na's school shoes", "Mua giày đi học cho Na"], 2, false, "home"],
        [["Sign field-trip form", "Ký giấy đi dã ngoại cho con"], 0, false, "home"],
        [["Plan Bin's birthday party", "Lên kế hoạch sinh nhật Bin"], 10, false, "home"],
        [["Book car service", "Đặt lịch bảo dưỡng xe"], null, false, "home"],
        [["Send September report to client", "Gửi báo cáo tháng 9 cho khách"], -1, true, "office"]
      ],
      mealPlan: ["fishsoup", "tofu", "curry", "pho", "salmon", "pasta", "lentil"]
    },
    {
      id: "freelancer", name: "Marco Rossi", modes: ["office", "freelancer"], seed: 33,
      desc: ["Freelance photographer. Weddings, headshots, product shoots and a lot of editing.", "Nhiếp ảnh gia tự do. Chụp cưới, chân dung, sản phẩm và rất nhiều giờ chỉnh ảnh."],
      profile: { sex: "male", age: 29, height: 178, weight: 74, activity: 3, pregnant: false }, bed: 24 * 60 + 40, wake: 8 * 60, peak: 15,
      weekly: [
        [1, "10:00", ["Editing block", "Khối giờ chỉnh ảnh"], "freelancer"], [2, "09:00", ["Product shoot – Lumi Lamps", "Chụp sản phẩm – Lumi Lamps"], "freelancer"],
        [3, "14:00", ["Client calls", "Gọi khách hàng"], "freelancer"], [4, "10:00", ["Editing block", "Khối giờ chỉnh ảnh"], "freelancer"],
        [5, "17:00", ["Send galleries & invoices", "Gửi album và hóa đơn"], "freelancer"], [6, "13:00", ["Wedding shoot", "Chụp đám cưới"], "freelancer"],
        [1, "19:00", ["Climbing", "Leo núi trong nhà"], "office"], [4, "19:00", ["Climbing", "Leo núi trong nhà"], "office"]
      ],
      once: [[1, "11:00", ["Site visit – Park wedding", "Khảo sát địa điểm – cưới nhà Park"], "freelancer"], [3, "16:00", ["Headshots – Studio Kite", "Chụp chân dung – Studio Kite"], "freelancer"], [12, "12:00", ["Park wedding", "Cưới nhà Park"], "freelancer"]],
      tasks: [
        [["Deliver Lee birthday gallery", "Giao album sinh nhật nhà Lee"], 0, false, "freelancer"],
        [["Follow up Gomez quote", "Nhắc lại báo giá cho Gomez"], 0, false, "freelancer"],
        [["Back up SD cards", "Sao lưu thẻ nhớ"], 1, false, "freelancer"],
        [["Update portfolio website", "Cập nhật website portfolio"], 6, false, "freelancer"],
        [["Quarterly tax payment", "Nộp thuế quý"], 9, false, "office"],
        [["Clean camera sensor", "Vệ sinh cảm biến máy ảnh"], null, false, "freelancer"],
        [["Invoice Bloom Café", "Gửi hóa đơn Bloom Café"], -3, true, "freelancer"]
      ],
      quotes: [
        ["Grace Park", ["Wedding photography", "Chụp ảnh cưới"], 2400, 1], ["Carlos Gomez", ["Anniversary shoot + MC", "Chụp kỷ niệm + MC"], 1100, 0],
        ["Startup Hub", ["Launch event", "Sự kiện ra mắt"], 1600, 0], ["Studio Kite", ["Team headshots", "Chân dung nhân viên"], 650, 2],
        ["Lee family", ["Birthday party", "Tiệc sinh nhật"], 1200, 2], ["Lumi Lamps", ["Product photos", "Ảnh sản phẩm"], 900, 1],
        ["Bloom Café", ["Menu photos", "Ảnh thực đơn"], 480, 3], ["Northwind", ["Corporate portraits", "Chân dung doanh nghiệp"], 1350, 3]
      ]
    },
    {
      id: "artist", name: "Maya Lopez", modes: ["office", "artist", "freelancer"], seed: 44,
      desc: ["Indie singer and DJ. Late gigs, studio days and a few brand deals.", "Ca sĩ indie kiêm DJ. Diễn khuya, ngày ở phòng thu và vài hợp đồng nhãn hàng."],
      profile: { sex: "female", age: 27, height: 168, weight: 60, activity: 3, pregnant: false }, bed: 26 * 60 + 15, wake: 9 * 60 + 30, peak: 18,
      weekly: [
        [1, "13:00", ["Vocal practice", "Luyện thanh"], "artist"], [2, "14:00", ["Studio – new single", "Phòng thu – single mới"], "artist"],
        [3, "20:00", ["Rehearsal with band", "Tập với ban nhạc"], "artist"], [4, "13:00", ["Vocal practice", "Luyện thanh"], "artist"],
        [5, "22:00", ["DJ set – Rooftop", "DJ set – Rooftop"], "artist"], [6, "21:00", ["Live set", "Diễn live"], "artist"],
        [0, "12:00", ["Post weekly content", "Đăng nội dung tuần"], "freelancer"]
      ],
      once: [[2, "21:00", ["The Velvet Room", "The Velvet Room"], "artist"], [5, "15:00", ["Photo shoot – press kit", "Chụp ảnh press kit"], "artist"], [10, "19:30", ["Harbor Fest soundcheck", "Soundcheck Harbor Fest"], "artist"], [11, "20:00", ["Harbor Fest", "Harbor Fest"], "artist"]],
      tasks: [
        [["Send rider to Harbor Fest", "Gửi rider cho Harbor Fest"], 0, false, "artist"],
        [["Chase Velvet Room deposit", "Nhắc cọc The Velvet Room"], 0, false, "artist"],
        [["Approve single cover art", "Duyệt ảnh bìa single"], 1, false, "artist"],
        [["Film reel for Glow Skincare", "Quay reel cho Glow Skincare"], 2, false, "freelancer"],
        [["Register song with collecting society", "Đăng ký bản quyền bài hát"], 7, false, "artist"],
        [["Restring guitar", "Thay dây đàn"], null, false, "artist"],
        [["Pay band members for last gig", "Trả tiền ban nhạc show trước"], -2, true, "artist"]
      ],
      gigs: [
        ["Lumen Bar", -9, 800, 0, false, true], ["Riverside Jazz Club", -4, 900, 300, true, false],
        ["The Velvet Room", 2, 1200, 600, false, false], ["Rooftop Sessions", 3, 600, 0, false, false],
        ["Harbor Fest", 11, 3500, 1050, true, false], ["Northwind corporate gala", 20, 4000, 1200, false, false]
      ],
      quotes: [["Glow Skincare", ["3 videos", "3 video"], 4500, 2], ["Nimbus Audio", ["2 videos", "2 video"], 3200, 0], ["City Bikes", ["1 reel", "1 reel"], 1400, 1]]
    }
  ];

  function build(pid, lang, today) {
    var p = PERSONAS.filter(function (x) { return x.id === pid; })[0];
    if (!p) return null;
    id = 0;
    var r = rng(p.seed);
    p.lang = lang;
    var health = buildHealth(p, today, r);
    return {
      v: 1, lang: lang, onboarded: true, name: p.name.split(" ")[0], modes: p.modes.slice(), active: p.modes[p.modes.length > 1 ? 1 : 0],
      profile: Object.assign({}, p.profile), track: true, hideNumbers: false,
      credits: 50, lastBonus: "",
      events: buildEvents(p, today, lang), tasks: buildTasks(p, today, lang),
      sleep: health.sleep, energy: health.energy, meals: health.meals, water: health.water,
      mealPlan: p.mealPlan ? p.mealPlan.slice() : [], grocery: {},
      quotes: (p.quotes || []).map(function (q) { return { id: uid(), client: q[0], service: L(q[1], lang), amount: q[2], stage: q[3] }; }),
      gigs: (p.gigs || []).map(function (g) { return { id: uid(), venue: g[0], date: add(today, g[1]), fee: g[2], deposit: g[3], depPaid: g[4], fullPaid: g[5] }; }),
      sample: pid
    };
  }

  window.DAHAND_SAMPLES = {
    list: PERSONAS.map(function (p) { return { id: p.id, name: p.name, modes: p.modes, desc: p.desc }; }),
    build: build
  };
})();
