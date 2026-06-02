(function() {
  'use strict';

  function findMartyrInList(list, martyrId) {
    if (!Array.isArray(list)) return null;

    return list.find(function(item) {
      return String(item?.martyr_id || '') === String(martyrId || '');
    }) || null;
  }

  function cloneMartyrForDashboard(item) {
    if (!item) return null;

    /*
      ننسخ الكائن حتى لا يحصل ربط غريب بين بيانات الرئيسية ولوحة التحكم.
    */
    return Object.assign({}, item);
  }

  function ensureMartyrExistsInDashboardData(martyrId) {
    if (!martyrId) return;

    let isAdmin = false;

    try {
      isAdmin = !!isAdminLoggedIn;
    } catch (e) {}

    if (!isAdmin) return;

    let existsInDashboard = null;
    let existsInHome = null;

    try {
      existsInDashboard = findMartyrInList(dashboardData, martyrId);
    } catch (e) {}

    if (existsInDashboard) return;

    try {
      existsInHome = findMartyrInList(allMartyrs, martyrId);
    } catch (e) {}

    if (!existsInHome) return;

    /*
      هنا أصل المشكلة:
      الشهيد موجود في الرئيسية allMartyrs
      لكنه غير موجود بعد في dashboardData.
      لذلك نضيفه مؤقتًا إلى dashboardData كي تنجح openMartyrDetails.
    */
    try {
      if (!Array.isArray(dashboardData)) {
        dashboardData = [];
      }

      dashboardData.unshift(cloneMartyrForDashboard(existsInHome));
    } catch (e) {}
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__openNewVerifiedCardFix) {
    window.openMartyrDetails = function(martyrId, fromPage, noRoute) {
      ensureMartyrExistsInDashboardData(martyrId);

      return oldOpenMartyrDetails.apply(this, arguments);
    };

    window.openMartyrDetails.__openNewVerifiedCardFix = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  /*
    عند نجاح نشر شهيد جديد، نحاول تحديث dashboardData بهدوء أيضًا.
    هذا لا يرسل أي طلب إضافي، فقط يضمن أن البيانات المحلية متوافقة.
  */
  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__openNewVerifiedCardFix) {
    window.renderMartyrs = function(customList) {
      const result = oldRenderMartyrs.apply(this, arguments);

      try {
        if (isAdminLoggedIn && Array.isArray(allMartyrs) && Array.isArray(dashboardData) && dashboardData.length) {
          allMartyrs.forEach(function(item) {
            if (!item || !item.martyr_id) return;

            const exists = findMartyrInList(dashboardData, item.martyr_id);

            if (!exists) {
              dashboardData.unshift(cloneMartyrForDashboard(item));
            }
          });
        }
      } catch (e) {}

      return result;
    };

    window.renderMartyrs.__openNewVerifiedCardFix = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }
})();
