// ===== DaHand – cấu hình / configuration =====
// Sửa các dòng dưới đây rồi đẩy lại lên GitHub. / Edit these lines, then push to GitHub.

window.DAHAND_CONFIG = {
  // Link Google Form khảo sát (bản "viewform"). Để trống "" nếu chưa có.
  // Google Form survey link (the "viewform" URL). Leave "" if you don't have one yet.
  SURVEY_FORM_URL: "",

  // Link Google Form đăng ký chờ (waitlist). Có thể dùng chung form khảo sát.
  // Waitlist Google Form link. Can be the same form as the survey.
  WAITLIST_FORM_URL: "",

  // Số credit tặng khi bắt đầu, và credit điểm danh mỗi ngày.
  // Starting credits and daily check-in bonus.
  START_CREDITS: 50,
  DAILY_BONUS: 2,

  // Để sau: địa chỉ máy chủ AI thật (POST {task, mode, lang, context} -> {text}).
  // Để trống thì app dùng trợ lý giả lập chạy ngay trên máy.
  // Later: your real AI endpoint. Empty = built-in offline assistant.
  AI_ENDPOINT: ""
};
