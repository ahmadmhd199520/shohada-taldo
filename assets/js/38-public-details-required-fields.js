(function() {
  'use strict';

  const PUBLIC_MISSING_TEXT = 'بيانات تحتاج لاستكمال';

  function getCurrentDetailsItemSafe() {
    try {
      if (currentDetailsItem) return currentDetailsItem;
    } catch (e) {}

    return null;
  }

  function isEmptyValue(value) {
    return String(value || '').trim() === '' || String(value || '').trim() === '-' || String(value || '').trim() === '—';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function normalizeLabel(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function missingValueHtml() {
    return `<span class="public-missing-field">${PUBLIC_MISSING_TEXT}</span>`;
  }

  function noneValueHtml() {
  return `<span class="public-none-field">لا يوجد</span>`;
}

  function findDetailsRow() {
    return document.querySelector('#detailsContainer .detail-box .row.g-3');
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

  function getFieldValue(item, field) {
    return item ? item[field] : '';
  }

function makeOrderedDetailItem(label, value, field) {
  const missing = isEmptyValue(value);
  const fieldName = String(field || '').trim();

  let valueHtml = '';

  if (missing && fieldName === 'nickname') {
    valueHtml = noneValueHtml();
  } else if (missing) {
    valueHtml = missingValueHtml();
  } else {
    valueHtml = escapeHtml(value);
  }

  return `
    <div class="col-md-6 public-ordered-detail-item" data-public-label="${escapeAttr(label)}" data-public-field="${escapeAttr(field || '')}">
      <div class="p-3 rounded-4 bg-light h-100">
        <div class="text-muted small mb-1">${escapeHtml(label)}</div>
        <div class="fw-bold">
          ${valueHtml}
        </div>
      </div>
    </div>
  `;
}
  function getOrderedDetailDefinitions(item) {
    const type = String(item?.martyrdom_type || '').trim();

    const fields = [
      { label: 'اسم الأب', field: 'father_name' },
      { label: 'المواليد', field: 'birth_year' },
      { label: 'اللقب', field: 'nickname' },
      { label: 'استشهد بـ', field: 'martyrdom_type' }
    ];

    if (type === 'المعارك') {
      fields.push({ label: 'اسم المعركة', field: 'battle_name' });
    }

    if (type === 'آخر') {
      fields.push({ label: 'السبب', field: 'other_cause' });
    }

    if (type === 'تحت التعذيب' || type === 'معتقل') {
      fields.push({ label: 'بيانات الفرع الأمني', field: 'security_branch' });
    }

    if (type === 'مفقود') {
      fields.push({ label: 'آخر مكان شوهد فيه', field: 'last_seen_place' });
    }

    fields.push(
      { label: 'تاريخ الاستشهاد', field: 'martyrdom_date' },
      { label: 'مكان الاستشهاد', field: 'martyrdom_place' }
    );

    return fields;
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

  function rebuildDetailsFieldsInCorrectOrder(item) {
    const row = findDetailsRow();
    if (!row || !item) return;

    const definitions = getOrderedDetailDefinitions(item);

    /*
      نحذف فقط العناصر التي أضافها هذا الملف سابقًا،
      ثم نعيد بناء الحقول بالترتيب الصحيح.
      هذا يمنع خربطة الترتيب عند الزائر.
    */
    row.querySelectorAll('.public-ordered-detail-item, .public-required-detail-item, .public-none-detail-item').forEach(function(el) {
      el.remove();
    });

    /*
      نحذف الحقول الأصلية التي تحمل نفس العناوين المطلوبة،
      سواء كانت ظاهرة للأدمن أو للزائر، ثم نعيد بناءها نحن بالترتيب الصحيح.
    */
    definitions.forEach(function(def) {
      const existing = findDetailItemByLabel(row, def.label);
      if (existing) existing.remove();
    });

    const html = definitions.map(function(def) {
      return makeOrderedDetailItem(def.label, getFieldValue(item, def.field), def.field);
    }).join('');

    row.insertAdjacentHTML('afterbegin', html);
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

  function patchDetailsFields() {
    const item = getCurrentDetailsItemSafe();

    if (!item) return;
    if (!document.getElementById('detailsPage')?.classList.contains('active')) return;

    patchHeaderFields(item);
    rebuildDetailsFieldsInCorrectOrder(item);
    patchExtraInfoField(item);
  }

  const oldOpenMartyrDetails =
    window.openMartyrDetails ||
    (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);

  if (typeof oldOpenMartyrDetails === 'function' && !oldOpenMartyrDetails.__publicRequiredFieldsWrapped) {
    window.openMartyrDetails = function() {
      const result = oldOpenMartyrDetails.apply(this, arguments);

      setTimeout(patchDetailsFields, 0);
      requestAnimationFrame(patchDetailsFields);
      setTimeout(patchDetailsFields, 120);
      setTimeout(patchDetailsFields, 350);

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
        setTimeout(patchDetailsFields, 120);
        setTimeout(patchDetailsFields, 350);
      });

      return result;
    };

    window.refreshCurrentDetailsPage.__publicRequiredFieldsWrapped = true;

    try {
      refreshCurrentDetailsPage = window.refreshCurrentDetailsPage;
    } catch (e) {}
  }
})();
