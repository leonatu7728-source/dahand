# DaHand – bản web thử nghiệm

DaHand là trợ lý cá nhân cho công việc và cuộc sống. Đây là bản web dùng thử để gửi link cho người dùng thật và thu góp ý.

- **Có gì:** Hôm nay (tóm tắt, check-in năng lượng, lịch, việc, hỏi trợ lý), Kế hoạch (lịch 7 ngày + danh sách việc), Routine (giấc ngủ, năng lượng, nước, calo), 4 Mode (Văn phòng, Nội trợ & WFH, Freelancer, Nghệ sĩ), credit, khảo sát + đăng ký chờ, Anh/Việt.
- **Dữ liệu:** lưu trong trình duyệt của từng người (localStorage), không có máy chủ, không tốn tiền.
- **Trợ lý AI:** đang là bản giả lập chạy trên máy, trả lời từ chính dữ liệu của người dùng. Có sẵn chỗ để gắn AI thật sau (xem cuối file).
- **Bản v2 (sau audit):** màn hình chào còn 2 bước, app bắt đầu trống kèm danh sách "Bắt đầu", thẻ Năng lượng mới (Sáng/Chiều/Tối, bảng 7 ngày, nhận xét giờ tỉnh táo nhất), sửa mọi mục + hoàn tác khi xóa, chọn món có sẵn khi ghi bữa ăn, lịch sử giấc ngủ 7 đêm, Hôm nay thay đổi theo Mode, tách việc từ tin nhắn chính xác hơn, tiền tệ USD/GBP/EUR/VND, đo hành vi ẩn danh (tùy chọn).
- **Cài lên điện thoại:** là PWA – mở link bằng điện thoại → menu trình duyệt → "Thêm vào màn hình chính".

---

## 1. Xem thử trên máy (không cần cài gì)

Giải nén, bấm đúp `index.html`. App chạy ngay trong trình duyệt.

## Dữ liệu mẫu

Có 4 người dùng mẫu, mỗi người có lịch và việc trong 3 tuần, cùng 14 ngày dữ liệu giấc ngủ, năng lượng, bữa ăn và nước. Ngày tháng tự tính theo hôm nay nên lúc nào xem cũng "mới".

| Mẫu | Mode | Có gì |
|---|---|---|
| Emma Carter | Văn phòng | Họp, deadline, gym, 8 việc |
| Linh Nguyen | Văn phòng + Nội trợ & WFH | Đưa đón con, học thêm, kế toán online, thực đơn tuần |
| Marco Rossi | Văn phòng + Freelancer | Lịch chụp ảnh, 8 báo giá ở đủ các bước |
| Maya Lopez | Văn phòng + Nghệ sĩ + Freelancer | 6 show (đã cọc/chưa cọc/đã thu), 3 hợp đồng nhãn hàng |

Cách dùng:

- Màn hình chào → **"Chỉ muốn xem thử? Dùng dữ liệu mẫu"** → chọn một người.
- Hoặc tab **Thêm → Dữ liệu mẫu** để đổi sang người khác bất cứ lúc nào.
- Thư mục `samples/` có sẵn file JSON của từng mẫu (Anh `-en`, Việt `-vi`). Nạp bằng **Thêm → Nhập dữ liệu (.json)**. Các file này mang ngày của lúc tạo; nạp từ nút trong app thì ngày luôn tính theo hôm nay.
- Muốn sửa nội dung mẫu: mở `js/samples.js`, mỗi người là một khối dữ liệu dễ đọc (tên sự kiện có cả tiếng Anh và tiếng Việt).

## 2. Đưa lên GitHub Pages (miễn phí, khoảng 10 phút)

1. Tạo tài khoản tại https://github.com (miễn phí).
2. Bấm **+** (góc trên phải) → **New repository**.
   - Repository name: `dahand`
   - Chọn **Public** (GitHub Pages miễn phí cần repo public)
   - Bấm **Create repository**.
3. Trong trang repo mới, bấm link **uploading an existing file**.
4. Mở thư mục `dahand` đã giải nén, chọn **tất cả** file và thư mục bên trong (`index.html`, `css`, `js`, `icons`, `manifest.webmanifest`, `sw.js`, `README.md`) rồi kéo thả vào trang. Nên dùng Chrome hoặc Edge để kéo được cả thư mục.
5. Kéo xuống, bấm **Commit changes**.
6. Vào **Settings** → **Pages** (menu trái).
   - Source: **Deploy from a branch**
   - Branch: **main**, thư mục **/ (root)** → **Save**.
7. Chờ 1–2 phút, tải lại trang Settings → Pages. Link của bạn hiện ở trên cùng, dạng:
   `https://TEN-TAI-KHOAN.github.io/dahand/`

Gửi link này cho người thử là xong.

## 3. Gắn khảo sát và đăng ký chờ (Google Form)

1. Vào https://forms.google.com → tạo form mới (gợi ý câu hỏi ở dưới).
2. Bấm **Gửi (Send)** → biểu tượng **link** → **Sao chép**.
3. Trên GitHub, mở file `js/config.js` → bấm biểu tượng **bút chì (Edit)**.
4. Dán link vào giữa hai dấu ngoặc kép:
   ```js
   SURVEY_FORM_URL: "https://docs.google.com/forms/d/e/....../viewform",
   WAITLIST_FORM_URL: "https://docs.google.com/forms/d/e/....../viewform",
   ```
   Có thể dùng chung một form cho cả hai (thêm câu hỏi email ở cuối).
5. Bấm **Commit changes**. Sau 1–2 phút app tự cập nhật; form hiện trong tab **Thêm / More**.
6. Xem câu trả lời: trong Google Form → tab **Câu trả lời** → **Liên kết với Trang tính** để có bảng Google Sheets.

### Gợi ý câu hỏi khảo sát (EN / VI)

1. Which mode fits you best? / Mode nào hợp với bạn nhất? (Office / Home & WFH / Freelancer / Artist)
2. What did you try first? / Bạn thử tính năng nào đầu tiên?
3. Which feature would you use every day? / Tính năng nào bạn sẽ dùng mỗi ngày?
4. What was confusing or missing? / Chỗ nào khó hiểu hoặc còn thiếu?
5. How disappointed would you be if you could no longer use DaHand? (Very / Somewhat / Not) / Bạn sẽ thất vọng thế nào nếu không dùng được DaHand nữa? (Rất / Hơi / Không)
6. Would you pay $12/month for the full version with real AI? (Yes / Maybe / No) / Bạn có trả $12/tháng cho bản đầy đủ có AI thật không?
7. Would you rather buy credits instead of a subscription? / Bạn thích mua credit theo lượt hơn trả theo tháng không?
8. What app(s) do you use for this today? / Hiện bạn đang dùng app nào cho việc này?
9. Email to get early access (optional) / Email để nhận bản sớm (không bắt buộc)

Câu 5 là thước đo quan trọng: nếu khoảng 40% trở lên trả lời "Rất thất vọng", sản phẩm đang đi đúng hướng.

## 3b. Đo hành vi người thử (tùy chọn, miễn phí)

App tự ghi các sự kiện ẩn danh (không có tên, email hay nội dung): `onboarding_start`, `onboarding_done`, `sample_<tên>`, `tab_<tên tab>`, `mode_<mode>`, `task_add`, `event_add`, `energy_set`, `sleep_log`, `meal_add`, `profile_set`, `ai_<loại>`, `inbox_scan`, `inbox_add`, `daily_bonus`, `first_open`, `return_visit`.

Chọn một trong hai:

- **GoatCounter:** đăng ký tại https://www.goatcounter.com (miễn phí cho dự án phi thương mại), đặt mã trang, ví dụ `dahand` → điền `GOATCOUNTER_CODE: "dahand"` trong `js/config.js`.
- **Umami Cloud:** đăng ký tại https://umami.is, thêm website, copy **Website ID** → điền `UMAMI_WEBSITE_ID`.

Chỉ số nên xem: tỉ lệ `onboarding_done / onboarding_start`, số người `return_visit` (quay lại ngày hôm sau), tab nào được mở nhiều nhất, và bao nhiêu người dùng trợ lý (`ai_*`).

## 4. Sửa và cập nhật

- Sửa file trực tiếp trên GitHub (bút chì → Commit). Trang tự cập nhật sau 1–2 phút.
- Sau mỗi lần sửa, mở `sw.js`, tăng số phiên bản, ví dụ `dahand-v3` thành `dahand-v4` để điện thoại đã cài app nhận bản mới.
- Đổi số credit tặng ban đầu / điểm danh: `js/config.js`.
- Đổi chữ trên giao diện: `js/i18n.js` (phần `en` và `vi`).
- Đổi món ăn, Mode, giá credit: `js/data.js`. Calo món ăn là số ước tính.

## 5. Gắn tên miền dahand.app (khi đã mua)

GitHub → Settings → Pages → **Custom domain** → nhập `dahand.app` → Save, rồi làm theo hướng dẫn trỏ DNS của GitHub tại nơi bạn mua tên miền. Bật **Enforce HTTPS**.

## 6. Nâng cấp lên AI thật (sau này)

Không đặt khóa API AI trong các file này – repo public nên ai cũng đọc được. Cách đúng: dựng một máy chủ nhỏ (ví dụ Cloudflare Workers, có gói miễn phí) giữ khóa API, nhận `POST {task, mode, lang, context}` và trả `{ "text": "..." }`. Sau đó điền địa chỉ đó vào `AI_ENDPOINT` trong `js/config.js`. App sẽ tự dùng AI thật, nếu lỗi thì quay về bản giả lập.

## Giới hạn của bản thử nghiệm

- Dữ liệu chỉ nằm trên trình duyệt đang dùng; đổi máy hoặc xóa dữ liệu trình duyệt là mất. Người dùng có thể tải bản sao trong **Thêm → Tải dữ liệu của tôi**.
- Credit chỉ để thử cảm giác trả theo lượt, chưa có thanh toán thật.
- Calo là ước tính (công thức Mifflin–St Jeor × mức vận động), không phải tư vấn y tế. App tắt mục tiêu calo cho người dưới 18 tuổi và khi mang thai/cho con bú, và không bao giờ đặt mục tiêu dưới 1.200 kcal (nữ) / 1.500 kcal (nam).
