# أرشيف شهداء تلدو - نسخة مقسّمة

## بنية الملفات

- `index.html` ملف الدخول الرئيسي.
- `partials/header.html` ترويسة الموقع.
- `partials/home.html` الصفحة الرئيسية.
- `partials/public-pages.html` صفحات العائلات وصفحة الشهيد.
- `partials/dashboard.html` لوحة التحكم.
- `partials/footer.html` تذييل الموقع.
- `partials/modals.html` جميع النوافذ المنبثقة.
- `assets/css/styles.css` كل التنسيقات + إصلاح sticky + النمط الليلي/النهاري.
- `assets/js/app.js` كل جافاسكربت الواجهة.
- `gas/Code.gs` كود Google Apps Script بعد تحديث رقم الكاش.
- `worker/cloudflare-worker.js` كود Cloudflare Worker بعد تخفيف كاش `getInitialData`.

## ملاحظات الرفع

ارفع الملفات والمجلدات كما هي إلى GitHub Pages بحيث تكون `partials` و `assets` بجانب `index.html`.

بعد رفع `worker/cloudflare-worker.js` إلى Cloudflare، أعد نشر Worker.

بعد نسخ `gas/Code.gs` إلى Apps Script، اعمل Deploy جديد.
