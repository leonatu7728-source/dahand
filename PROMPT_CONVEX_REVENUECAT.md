# Prompt dán vào Claude Code: Convex + RevenueCat

> **Thứ tự nên làm:** chạy prompt này **trước**, rồi mới tới `PROMPT_APP_STORE.md`.
> **Cách dùng:** mở Claude Code trong thư mục `D:\LEO\dahand-webapp\dahand`, copy phần trong khung bên dưới và dán vào.

---

```
Đọc kỹ CLAUDE.md, nhất là phần "Backend: Convex + RevenueCat". Mục tiêu: biến DaHand từ bản thử nghiệm thành bản bán được:
- có tài khoản đăng nhập;
- dữ liệu lưu trên Convex;
- credit và gói tháng bán qua RevenueCat (web dùng Paddle; sau này iOS/Android dùng In-App Purchase).
Giữ nguyên app web vanilla JS hiện có, không viết lại bằng React. Tôi dùng Windows, không rành kỹ thuật: trả lời bằng tiếng Việt ngắn gọn.

Làm từng giai đoạn. Cuối mỗi giai đoạn: chạy test, tóm tắt 3–5 dòng, liệt kê việc tôi phải tự làm (nếu có), rồi DỪNG chờ tôi nói "tiếp".
Trước khi dùng thư viện nào, đọc tài liệu chính thức bản mới nhất của Convex và RevenueCat. Không đoán API.

GIAI ĐOẠN 0 — Kế hoạch và giá (chưa viết code)
- Đề xuất bảng giá để tôi duyệt:
  - gói "DaHand Plus" tháng và năm (kèm số credit mỗi tháng);
  - 2–3 gói credit lẻ;
  - credit miễn phí khi đăng ký.
  Tính sao cho tiền bán credit luôn cao hơn chi phí AI (ghi rõ chi phí AI ước tính cho mỗi thao tác).
- Vẽ sơ đồ luồng dữ liệu bằng chữ: app → Convex → AI; RevenueCat → webhook → Convex.
- Liệt kê tài khoản tôi cần tạo: Convex, RevenueCat, Paddle, Google Cloud (đăng nhập Google), Apple Developer (Sign in with Apple), nhà cung cấp AI. Kèm thứ tự và chi phí. Giá phải kiểm tra trên trang chính thức.

GIAI ĐOẠN 1 — Dựng Convex
- Tạo package.json (nếu chưa có), cài convex, esbuild. Khởi tạo thư mục convex/.
- Schema:
  - users (tên, ngôn ngữ, modes, đồng ý đồng bộ đám mây, ngày tạo);
  - states (userId, json, updatedAt);
  - creditLedger (userId, delta, reason, ref là duy nhất, createdAt);
  - entitlements (userId, plus đến ngày nào);
  - rcEvents;
  - aiUsage;
  - analyticsEvents;
  - timings.
  Có index phù hợp.
- Mọi query/mutation đều kiểm tra đăng nhập và chỉ cho đọc/ghi dữ liệu của chính người đó.
- Viết test cho Convex functions (convex-test + vitest).

GIAI ĐOẠN 2 — Đăng nhập
- Đăng nhập bằng mã gửi qua email, Google, và Sign in with Apple.
  - Ưu tiên Convex Auth. Nếu Convex Auth bắt buộc dùng React thì dùng Clerk (clerk-js, chạy được với vanilla JS) nối với Convex. Giải thích cho tôi vì sao chọn.
- Tạo src/cloud/*.ts, build bằng esbuild ra js/cloud.js. Các file JS khác giữ nguyên.
- Người dùng vẫn dùng app không cần tài khoản (chỉ lưu trên máy). Thêm nút "Đăng nhập để lưu và đồng bộ" ở tab Thêm.
- Lần đầu đăng nhập:
  - trên Convex chưa có dữ liệu → tải dữ liệu trên máy lên;
  - đã có → hỏi người dùng giữ bản nào.
- Đồng bộ dữ liệu S lên Convex: giữ kiểu local-first, bản nào mới hơn (theo updatedAt) thì thắng, giống cách Google Sheet đang làm. Chuyển các sự kiện thống kê và Timing sang Convex.
- Google Sheet (SHEET_ENDPOINT) chỉ giữ cho bản beta miễn phí, tắt khi đã có Convex.
- Thêm "Xóa tài khoản" trong app: xóa toàn bộ dữ liệu trên Convex, xóa customer trên RevenueCat qua REST API, và nhắc người dùng hủy gói trong App Store/Google Play.

GIAI ĐOẠN 3 — Credit trên máy chủ và AI thật
- Bỏ việc cộng/trừ credit trong localStorage. Số dư = tổng creditLedger trên Convex. App chỉ hiển thị.
- Điểm danh hằng ngày, thưởng chuỗi ngày, mở khóa tổng kết tháng: đều làm bằng mutation trên server, chống bấm hai lần.
- Các nút "Hỏi trợ lý" gọi Convex action:
  - kiểm tra đăng nhập + số dư;
  - gọi AI (khóa API để trong biến môi trường Convex);
  - trừ credit;
  - AI lỗi thì hoàn credit.
- Giới hạn số lần gọi mỗi phút để chống lạm dụng.
- Giữ trợ lý giả lập hiện tại làm phương án dự phòng khi không có mạng.

GIAI ĐOẠN 4 — RevenueCat (web qua Paddle)
- Hướng dẫn tôi từng bước tạo trong RevenueCat:
  - project, entitlement "plus";
  - offering "default" với gói tháng, gói năm và các gói credit;
  - nối Paddle làm cổng thanh toán web.
  Ghi tên nút bấm cụ thể.
- Web: dùng RevenueCat Web SDK, appUserId = id người dùng trên Convex. Màn hình "Nâng cấp" trong tab Thêm có:
  - bảng giá;
  - nút mua;
  - khôi phục giao dịch;
  - quản lý / hủy gói.
- Webhook RevenueCat → Convex HTTP action:
  - kiểm tra header Authorization;
  - lưu sự kiện vào rcEvents;
  - chạy idempotent theo event id.
  Xử lý:
  - INITIAL_PURCHASE và RENEWAL → bật Plus + cộng credit tháng;
  - NON_RENEWING_PURCHASE → cộng credit gói lẻ;
  - CANCELLATION / EXPIRATION → tắt Plus đúng hạn;
  - REFUND → trừ lại credit nếu còn.
- Test webhook bằng dữ liệu mẫu (không gọi RevenueCat thật trong test). Chạy thử bằng chế độ sandbox / test của Paddle.
- Ghi chú cho giai đoạn app điện thoại: dùng @revenuecat/purchases-capacitor, cùng entitlement và cùng offering, không có link mua trên web trong app iOS/Android.

GIAI ĐOẠN 5 — Pháp lý và phát hành web
- privacy.html, terms.html, refund.html (EN/VI):
  - nêu rõ Convex, RevenueCat, Paddle, nhà cung cấp AI là bên xử lý dữ liệu;
  - dữ liệu sức khỏe chỉ đồng bộ khi người dùng đồng ý.
  Thêm link ở tab Thêm và ở trang thanh toán.
- GitHub Action:
  - build js/cloud.js và deploy GitHub Pages;
  - deploy Convex bằng CONVEX_DEPLOY_KEY (để trong GitHub Secrets).
  Hướng dẫn tôi thêm Secret.
- Cập nhật config.js: chỉ chứa CONVEX_URL và khóa public của RevenueCat. Kiểm tra lại không có khóa bí mật nào trong repo.
- Cập nhật CLAUDE.md và README.md (phần tiếng Việt) cho đúng hệ thống mới. Bump sw.js VERSION.
- Danh sách kiểm tra cuối:
  - tạo tài khoản mới;
  - mua thử gói tháng và gói credit bằng thẻ test;
  - thấy credit tăng;
  - dùng AI thấy credit giảm;
  - hủy gói;
  - xóa tài khoản;
  - dữ liệu đồng bộ giữa 2 trình duyệt.

Quy tắc chung:
- Mọi chữ mới phải có en + vi.
- UI dạng danh sách như hiện tại.
- Không phá tính năng đang có.
- Không commit bí mật.
- Chỗ nào cần tôi đăng ký, trả tiền hoặc bấm trên trang web của dịch vụ: liệt kê rõ từng bước và chờ tôi gửi lại thông tin (URL, public key…), rồi bạn tự dán vào.
```
