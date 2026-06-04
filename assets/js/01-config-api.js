  const IS_ADMIN_FROM_URL = false;

  const API_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';
  const SHARE_PREVIEW_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';

  async function apiRequest(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("API HTTP Error:", res.status, text);
    return {
      success: false,
      message: "تعذر الاتصال بالخادم. كود الخطأ: " + res.status
    };
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("API did not return JSON:", text);
    return {
      success: false,
      message: "الخادم لم يرجع بيانات JSON صالحة."
    };
  }
}
