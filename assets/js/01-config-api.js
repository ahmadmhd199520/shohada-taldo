  const IS_ADMIN_FROM_URL = false;

  const API_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';
  const SHARE_PREVIEW_URL = 'https://shohada-taldo.al-shwikh-1995-sultan.workers.dev/';

  async function apiRequest(action, data = {}) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        data
      })
    });

    const result = await response.json();

    if (!result) {
      throw new Error('لم يرجع الخادم استجابة واضحة.');
    }

    return result;
  }
