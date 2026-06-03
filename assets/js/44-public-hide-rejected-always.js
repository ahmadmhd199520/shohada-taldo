(function() {
  'use strict';

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function isRejectedItem(item) {
    const status = String(
      item?.verification_status ||
      item?.status ||
      item?.verificationStatus ||
      ''
    ).trim();

    return status === 'مرفوض' || status === 'rejected';
  }

  function filterRejectedForPublic(list) {
    if (!Array.isArray(list)) return list;

    if (isAdminMode()) return list;

    return list.filter(function(item) {
      return !isRejectedItem(item);
    });
  }

  const oldRenderMartyrs =
    window.renderMartyrs ||
    (typeof renderMartyrs === 'function' ? renderMartyrs : null);

  if (typeof oldRenderMartyrs === 'function' && !oldRenderMartyrs.__publicHideRejectedAlways) {
    window.renderMartyrs = function(customList) {
      /*
        إذا دالة العرض استلمت قائمة مخصصة، ننظفها من المرفوض للزائر.
      */
      if (Array.isArray(customList)) {
        return oldRenderMartyrs.call(this, filterRejectedForPublic(customList));
      }

      /*
        إذا دالة العرض تعتمد على allMartyrs مباشرة،
        نبدّلها مؤقتًا بقائمة بدون المرفوض للزائر فقط.
      */
      if (!isAdminMode()) {
        let originalAllMartyrs = null;

        try {
          originalAllMartyrs = allMartyrs;

          if (Array.isArray(allMartyrs)) {
            allMartyrs = filterRejectedForPublic(allMartyrs);
          }

          return oldRenderMartyrs.apply(this, arguments);
        } finally {
          try {
            if (originalAllMartyrs) {
              allMartyrs = originalAllMartyrs;
            }
          } catch (e) {}
        }
      }

      return oldRenderMartyrs.apply(this, arguments);
    };

    window.renderMartyrs.__publicHideRejectedAlways = true;

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (e) {}
  }

  /*
    احتياط إضافي:
    إذا تم إلغاء الفلتر أو تحديث الصفحة، نعيد الرسم بدون المرفوض للزائر.
  */
  window.addEventListener('taldo:api-cache-updated', function() {
    setTimeout(function() {
      try {
        if (!isAdminMode() && typeof renderMartyrs === 'function') {
          renderMartyrs();
        }
      } catch (e) {}
    }, 150);
  });
})();
