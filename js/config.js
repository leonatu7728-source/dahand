// ===== DaHand – cấu hình / configuration =====
// Sửa các dòng dưới đây rồi đẩy lại lên GitHub. / Edit these lines, then push to GitHub.

window.DAHAND_CONFIG = {
  // Link Google Form khảo sát (bản "viewform"). Để trống "" thì phần góp ý được ẩn đi.
  // Google Form survey link (the "viewform" URL). Empty = the feedback section is hidden.
  SURVEY_FORM_URL: "",

  // Link Google Form đăng ký chờ (waitlist). Có thể dùng chung form khảo sát.
  WAITLIST_FORM_URL: "",

  // Credit tặng khi bắt đầu, và credit nhận mỗi ngày.
  START_CREDITS: 50,
  DAILY_BONUS: 2,

  // Tiền tệ mặc định: "USD", "GBP", "EUR" hoặc "VND". Người dùng đổi được trong Cài đặt.
  DEFAULT_CURRENCY: "USD",

  // Mục tiêu số ly nước mỗi ngày (chỉ để hiển thị tiến độ).
  WATER_GOAL: 8,

  // ---- Đo hành vi người thử (ẩn danh, không bắt buộc) ----
  // Cách 1 – GoatCounter (miễn phí cho dự án phi thương mại): tạo tài khoản ở goatcounter.com,
  //          điền mã trang, ví dụ "dahand" nếu địa chỉ của bạn là dahand.goatcounter.com.
  GOATCOUNTER_CODE: "",
  // Cách 2 – Umami Cloud (có gói miễn phí): điền Website ID.
  UMAMI_WEBSITE_ID: "",

  // Để sau: địa chỉ máy chủ AI thật (POST {task, mode, lang, context} -> {text}).
  // Để trống thì app dùng trợ lý giả lập chạy ngay trên máy. KHÔNG đặt khóa API ở đây.
  AI_ENDPOINT: ""
};
