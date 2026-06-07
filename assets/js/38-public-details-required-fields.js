(function() {
  'use strict';

  const PUBLIC_MISSING_TEXT = 'بيانات تحتاج لاستكمال';

  const REQUIRED_PUBLIC_FIELDS = [
    {
      label: 'اسم الأب',
      field: 'father_name'
    },
      {
    label: 'المواليد',
    field: 'birth_year'
    },
    {
      label: 'استشهد بـ',
      field: 'martyrdom_type'
    },
    {
      label: 'تاريخ الاستشهاد',
      field: 'martyrdom_date'
    },
    {
      label: 'مكان الاستشهاد',
      field: 'martyrdom_place'
    }
  ];

  const PUBLIC_EMPTY_AS_NONE_FIELDS = [
    {
      label: 'اللقب',
      field: 'nickname'
    }
  ];

  function isAdminMode() {
    try {
      return !!isAdminLoggedIn;
    } catch (e) {
      return false;
    }
  }

  function getCurrentDetailsItemSafe() {
    try {
      if (currentDetailsItem) return currentDetailsItem;
    } catch (e) {}

    return null;
  }

  function isEmptyValue(value) {
    return String(value || '').trim() === '';
  }

  function missingValueHtml() {
    return `<span class="public-missing-field">${PUBLIC_MISSING_TEXT}</span>`;
  }

  function noValueHtml() {
    return '<span class="public-no-extra-info">لا يوجد</span>';
  }

  function makePublicNoneDetailItem(label) {
    return `
      <div class="col-md-6 public-none-detail-item" data-public-label="${escapeAttr(label)}">
        <div class="p-3 rounded-4 bg-light h-100">
          <div class="text-muted small mb-1">${escapeHtml(label)}</div>
          <div class="fw-bold">
            ${noValueHtml()}
          </div>
        </div>
      </div>
    `;
  }

  function makePublicDetailItem(label, value, isMissing) {
    return `
      <div class="col-md-6 public-required-detail-item" data-public-label="${escapeAttr(label)}">
        <div class="p-3 rounded-4 bg-light h-100">
          <div class="text-muted small mb-1">${escapeHtml(label)}</div>
          <div class="fw-bold">
            ${isMissing ? missingValueHtml() : escapeHtml(value)}
          </div>
        </div>
      </div>
    `;
  }

  function normalizeLabel(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findDetailsRow() {
    return document.querySelector('#detailsContainer .detail-box .row.g-3');
  }

  function removeOldPublicInjectedItems(row) {
    if (!row) return;

    row.querySelectorAll('.public-required-detail-item, .public-none-detail-item').forEach(function(el) {
      el.remove();
    });
  }

  function rowHasLabel(row, label) {
    if (!row) return false;

    const wanted = normalizeLabel(label);

    return Array.from(row.querySelectorAll('.text-muted.small')).some(function(el) {
      return normalizeLabel(el.textContent) === wanted;
    });
  }

  function findDetailItemByLabel(row, label) {
  if (!row) return null;

  const wanted = normalizeLabel(label);
  const labels = Array.from(row.querySelectorAll('.text-muted.small'));

  for (const labelEl of labels) {
    const current = normalizeLabel(labelEl.textContent || '');

    if (current === wanted || current.startsWith(wanted)) {
      return labelEl.closest('.col-md-6, .col-12') || labelEl.parentElement;
    }
  }

  return null;
}

function setMissingValueInExistingDetailItem(itemEl) {
  if (!itemEl) return;

  const valueEl = itemEl.querySelector('.fw-bold');
  if (!valueEl) return;

  if (valueEl.querySelector('.public-missing-field')) return;

  valueEl.innerHTML = missingValueHtml();
}

  function patchHeaderFields(item) {
    if (!item) return;

    const title = document.querySelector('#detailsContainer .detail-box h2');
    const familyLine = document.querySelector('#detailsContainer .detail-box h2 + .text-muted');

    if (title && isEmptyValue(item.full_name)) {
      title.innerHTML = `
        <span class="small text-muted d-block mb-1">الاسم والكنية</span>
        ${missingValueHtml()}
      `;
    }

    if (familyLine && isEmptyValue(item.family_name)) {
      familyLine.innerHTML = `
        <span class="small text-muted d-block mb-1">العائلة</span>
        ${missingValueHtml()}
      `;
    }
  }

  function patchRequiredFieldsRow(item) {
    const row = findDetailsRow();

    if (!row || !item) return;

    removeOldPublicInjectedItems(row);

REQUIRED_PUBLIC_FIELDS.forEach(function(def) {
  const value = item[def.field];
  const missing = isEmptyValue(value);
  const existingItem = findDetailItemByLabel(row, def.label);

  /*
    إذا كان الحقل موجودًا بالفعل، كما يحدث عند الأدمن،
    ونفس الحقل فارغ، نستبدل الشرطة أو الفراغ بعبارة بيانات تحتاج لاستكمال.
  */
  if (existingItem) {
    if (missing) {
      setMissingValueInExistingDetailItem(existingItem);
    }
    return;
  }

  /*
    إذا كان الحقل غير موجود أصلًا، كما يحدث عند الزائر،
    نضيفه بالعبارة الصفراء.
  */
  if (missing) {
    row.insertAdjacentHTML(
      'beforeend',
      makePublicDetailItem(def.label, '', true)
    );
  }
});
  }

  function patchEmptyAsNoneFields(item) {
    const row = findDetailsRow();

    if (!row || !item) return;

    PUBLIC_EMPTY_AS_NONE_FIELDS.forEach(function(def) {
      if (rowHasLabel(row, def.label)) return;
      if (!isEmptyValue(item[def.field])) return;

      row.insertAdjacentHTML(
        'beforeend',
        makePublicNoneDetailItem(def.label)
      );
    });
  }

  function patchExtraInfoField(item) {
    if (!item) return;

    const detailBox = document.querySelector('#detailsContainer .detail-box');

    if (!detailBox) return;

    const existingExtraTitle = Array.from(detailBox.querySelectorAll('h6.fw-bold')).find(function(el) {
      return normalizeLabel(el.textContent).includes('معلومات إضافية');
    });

    if (existingExtraTitle) return;

    if (!isEmptyValue(item.extra_info)) return;

    /*
      إذا معلومات إضافية فارغة، نعرضها للزائر كحقل يحتاج استكمال.
    */
    const actionsBar = detailBox.querySelector('.details-action-bar');

    const extraHtml = `
  <hr class="public-extra-info-separator">
  <div class="public-extra-info-missing">
    <h6 class="fw-bold">معلومات إضافية</h6>
    <p class="lh-lg mb-0">
      <span class="public-no-extra-info">لا يوجد</span>
    </p>
  </div>
`;

    if (actionsBar) {
      actionsBar.insertAdjacentHTML('beforebegin', extraHtml);
    } else {
      detailBox.insertAdjacentHTML('beforeend', extraHtml);
    }
  }

  function patchPublicDetailsFields() {
    // if (isAdminMode()) return;

    const item = getCurrentDetailsItemSafe();

    if (!item) return;

    if (!document.getElementById('detailsPage')?.classList.contains('active')) return;

    patchHeaderFields(item);
    patchRequiredFieldsRow(item);
    patchEmptyAsNoneFields(item);
    patchExtraInfoField(item);
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__publicRequiredFieldsWrapped) {
    window.openMartyrDetails = function() {
      const result = oldOpenMartyrDetails.apply(this, arguments);

      setTimeout(patchPublicDetailsFields, 0);
      requestAnimationFrame(patchPublicDetailsFields);
      setTimeout(patchPublicDetailsFields, 120);

      return result;
    };

    window.openMartyrDetails.__publicRequiredFieldsWrapped = true;

    try {
      openMartyrDetails = window.openMartyrDetails;
    } catch (e) {}
  }

  const oldRefreshCurrentDetailsPage =
    window.refreshCurrentDetailsPage ||
    (typeof refreshCurrentDetailsPage === 'function' ? refreshCurrentDetailsPage : null);

  if (typeof oldRefreshCurrentDetailsPage === 'function' && !oldRefreshCurrentDetailsPage.__publicRequiredFieldsWrapped) {
    window.refreshCurrentDetailsPage = function() {
      const result = oldRefreshCurrentDetailsPage.apply(this, arguments);

      Promise.resolve(result).finally(function() {
        setTimeout(patchPublicDetailsFields, 120);
      });

      return result;
    };

    window.refreshCurrentDetailsPage.__publicRequiredFieldsWrapped = true;

    try {
      refreshCurrentDetailsPage = window.refreshCurrentDetailsPage;
    } catch (e) {}
  }
})();
