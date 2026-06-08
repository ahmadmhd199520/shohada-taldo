// 71-content-review-request.js
// زر "طلب مراجعة المحتوى" + مودال الطلب + تبويب "طلبات الخصوصية" في لوحة التحكم.
// ملف مستقل: لتعطيله علّق استدعاء هذا الملف وملف CSS الموافق في index.html.
(function () {
  'use strict';

  const FEATURE_ENABLED = true;
  if (!FEATURE_ENABLED) return;

  const ACTION_SUBMIT = 'submitContentReviewRequest';
  const ACTION_UPDATE_STATUS = 'updateContentReviewRequestStatus';
  const MODAL_ID = 'taldoContentReviewModal';
  const INFO_MODAL_ID = 'taldoContentReviewReasonInfoModal';
  const ACTION_MODAL_ID = 'taldoContentReviewActionModal';
  const TAB_BTN_ID = 'dashContentReviewTabBtn';
  const TAB_PANE_ID = 'dashboardContentReviewTab';

  const state = { currentMartyr: null, page: 1, submitting: false, actionRequestId: '', actionBusy: false };
  window.__contentReviewRequests = window.__contentReviewRequests || [];

  function clean(v) { return String(v || '').trim(); }
  function html(v) {
    if (typeof escapeHtml === 'function') return escapeHtml(v || '');
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function attr(v) { return (typeof escapeAttr === 'function') ? escapeAttr(v || '') : html(v || '').replace(/`/g, '&#096;'); }
  function normalize(v) {
    if (typeof normalizeText === 'function') return normalizeText(v || '');
    return String(v || '').toLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function toast(message) { if (typeof showToast === 'function') showToast(message); else alert(message); }
  function bsModal(modal) { return (modal && window.bootstrap && window.bootstrap.Modal) ? window.bootstrap.Modal.getOrCreateInstance(modal) : null; }
  function showModal(modal) { const bs = bsModal(modal); if (bs) bs.show(); else { modal.classList.add('show'); modal.style.display = 'block'; modal.removeAttribute('aria-hidden'); document.body.classList.add('modal-open'); } }
  function hideModal(modal) { const bs = bsModal(modal); if (bs) bs.hide(); else { modal.classList.remove('show'); modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('modal-open'); } }

  function knownLists() {
    const lists = [];
    try { if (Array.isArray(allMartyrs)) lists.push(allMartyrs); } catch (e) {}
    try { if (Array.isArray(dashboardData)) lists.push(dashboardData); } catch (e) {}
    try { if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem) lists.push([currentDetailsItem]); } catch (e) {}
    try { if (window.currentDetailsItem) lists.push([window.currentDetailsItem]); } catch (e) {}
    return lists;
  }
  function findMartyr(martyrId) {
    martyrId = clean(martyrId);
    for (const list of knownLists()) {
      const found = list.find(item => clean(item && item.martyr_id) === martyrId);
      if (found) return found;
    }
    return martyrId ? { martyr_id: martyrId } : null;
  }
  function currentMartyrId() {
    try { if (typeof currentDetailsItem !== 'undefined' && currentDetailsItem?.martyr_id) return clean(currentDetailsItem.martyr_id); } catch (e) {}
    try { return clean(new URLSearchParams(window.location.search).get('m') || ''); } catch (e) { return ''; }
  }

  function responseRequests(res) {
    if (!res || typeof res !== 'object') return [];
    return res.contentReviewRequests || res.privacyRequests || res.contentReviews || res.reviewRequests || [];
  }
  function setRequests(list) {
    if (!Array.isArray(list)) return;
    window.__contentReviewRequests = list.map(item => {
      if (!item) return item;
      item.__contentReviewSearch = normalize([
        item.created_at, item.martyr_name, item.full_name, item.family_name, item.requester_name,
        item.relationship, item.relationship_other, item.phone_text, item.reason, item.reason_other, item.status, item.admin_notes
      ].join(' '));
      return item;
    });
    updateCountBadge();
  }
  function pendingStatus(status) {
    const text = clean(status);
    return !text || text === 'بانتظار المراجعة' || text === 'قيد المراجعة' || text.includes('انتظار') || text.includes('مراجعة');
  }
  function badge(status) { return (typeof statusBadge === 'function') ? statusBadge(status || 'بانتظار المراجعة') : `<span class="badge text-bg-light">${html(status || 'بانتظار المراجعة')}</span>`; }
  function pageSize() { return window.innerWidth <= 1024 ? 10 : 24; }

  function reasonOption(value, note) {
    const id = 'contentReviewReason_' + value.replace(/\s+/g, '_');
    return `<label class="taldo-review-reason-card" for="${attr(id)}">
      <input class="form-check-input" type="radio" name="contentReviewReason" id="${attr(id)}" value="${attr(value)}">
      <span><span class="taldo-review-reason-card-title d-block">${html(value)}</span><span class="taldo-review-reason-card-note d-block">${html(note)}</span></span>
    </label>`;
  }

  function ensureRequestModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = MODAL_ID;
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content"><div class="modal-body">
          <div id="taldoContentReviewStepOne" class="taldo-content-review-step active">
            <div class="text-center">
              <div class="taldo-content-review-icon"><i class="fa-solid fa-shield-halved"></i></div>
              <h4 class="fw-bold mb-2">طلب مراجعة المحتوى</h4>
              <div class="text-muted mb-3" id="taldoContentReviewMartyrName"></div>
            </div>
            <div class="taldo-content-review-warning mb-3"><strong>تنبيه مهم:</strong> هذا القسم مخصص لأقارب الشهيد فقط. في حال عدم توضيح الجهة المرسلة وبيانات التواصل وصلة القرابة بشكل واضح، أو إرسال بيانات غير دقيقة، سيتم تحديد الطلب كطلب عبثي ولن تتم مراجعته.</div>
            <span class="taldo-content-review-step-badge mb-3"><i class="fa-solid fa-user-check"></i> بيانات مقدم الطلب</span>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label fw-bold taldo-content-review-required" for="contentReviewRequesterName">الاسم</label><input type="text" class="form-control" id="contentReviewRequesterName" autocomplete="name"></div>
              <div class="col-md-6"><label class="form-label fw-bold taldo-content-review-required" for="contentReviewPhone">رقم للتواصل</label><input type="text" class="form-control" id="contentReviewPhone" inputmode="text" autocomplete="tel" placeholder="سيُعامل كنص وليس كرقم"></div>
              <div class="col-md-6"><label class="form-label fw-bold taldo-content-review-required" for="contentReviewRelationship">صلة القرابة بالشهيد</label><select class="form-select" id="contentReviewRelationship"><option value="">اختر صلة القرابة</option><option value="أب أو أم">أب أو أم</option><option value="أخ أو أخت">أخ أو أخت</option><option value="عم أو خال أو عمة أو خالة">عم أو خال أو عمة أو خالة</option><option value="جد أو جدة">جد أو جدة</option><option value="قريب من الدرجة الثانية">قريب من الدرجة الثانية: ابن عم أو بنت عم أو ابن خال أو بنت خال</option><option value="آخر">آخر</option></select></div>
              <div class="col-md-6 d-none" id="contentReviewRelationshipOtherWrap"><label class="form-label fw-bold taldo-content-review-required" for="contentReviewRelationshipOther">اكتب صلة القرابة</label><input type="text" class="form-control" id="contentReviewRelationshipOther"></div>
            </div>
            <div class="alert alert-danger taldo-content-review-error d-none" id="contentReviewStepOneError"></div>
            <div class="d-flex justify-content-between gap-2 flex-wrap mt-4"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button><button type="button" class="btn btn-primary" id="contentReviewNextBtn">التالي <i class="fa-solid fa-arrow-left me-1"></i></button></div>
          </div>
          <div id="taldoContentReviewStepTwo" class="taldo-content-review-step">
            <div class="text-center mb-3"><div class="taldo-content-review-icon"><i class="fa-solid fa-clipboard-check"></i></div><h4 class="fw-bold mb-2">سبب طلب المراجعة</h4><div class="text-muted">اختر سببًا واحدًا فقط ثم أرسل الطلب.</div></div>
            <span class="taldo-content-review-step-badge mb-3"><i class="fa-solid fa-list-check"></i> نوع الطلب</span>
            <div class="taldo-review-reasons-grid" id="contentReviewReasonsGrid">
              ${reasonOption('طلب إخفاء الصورة', 'طلب عدم إظهار الصورة الحالية في صفحة الشهيد.')}
              ${reasonOption('طلب حجب رفع الصور للشهيد', 'طلب منع الزوار من رفع صور جديدة لهذا الشهيد.')}
              ${reasonOption('طلب تصحيح بيانات', 'للتعديلات العادية يُفضّل استخدام زر استكمال بيانات في صفحة الشهيد.')}
              ${reasonOption('طلب مسح صفحة الشهيد مع كافة المحتويات', 'طلب حساس يحتاج تدقيقًا واضحًا من المشرفين.')}
              ${reasonOption('سبب آخر', 'اكتب السبب بالتفصيل في الحقل الذي سيظهر.')}
            </div>
            <div class="mt-3 d-none" id="contentReviewReasonOtherWrap"><label class="form-label fw-bold taldo-content-review-required" for="contentReviewReasonOther">اكتب السبب</label><textarea class="form-control" id="contentReviewReasonOther" rows="4"></textarea></div>
            <div class="alert alert-danger taldo-content-review-error d-none" id="contentReviewStepTwoError"></div>
            <div class="d-flex justify-content-between gap-2 flex-wrap mt-4"><button type="button" class="btn btn-outline-secondary" id="contentReviewBackBtn"><i class="fa-solid fa-arrow-right ms-1"></i> رجوع</button><button type="button" class="btn btn-success" id="contentReviewSubmitBtn"><i class="fa-solid fa-paper-plane ms-1"></i> إرسال الطلب</button></div>
          </div>
          <div id="taldoContentReviewSuccess" class="taldo-content-review-step">
            <div class="taldo-content-review-success-box"><i class="fa-solid fa-circle-check"></i><h4 class="fw-bold mb-2">تم استلام طلبكم</h4><p class="mb-0">سيتم تدقيق الطلب ومراجعته في مدة أقصاها 24 ساعة، وسيتم تحديد طلبكم كعبثي في حال إرسال بيانات غير دقيقة.</p></div>
            <div class="text-center mt-4"><button type="button" class="btn btn-primary px-4" data-bs-dismiss="modal">إغلاق</button></div>
          </div>
        </div></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#contentReviewRelationship')?.addEventListener('change', function () {
      const wrap = document.getElementById('contentReviewRelationshipOtherWrap');
      wrap?.classList.toggle('d-none', this.value !== 'آخر');
      if (this.value !== 'آخر') document.getElementById('contentReviewRelationshipOther').value = '';
    });
    modal.querySelectorAll('input[name="contentReviewReason"]').forEach(input => input.addEventListener('change', onReasonChanged));
    modal.querySelector('#contentReviewNextBtn')?.addEventListener('click', goStepTwo);
    modal.querySelector('#contentReviewBackBtn')?.addEventListener('click', () => setStep(1));
    modal.querySelector('#contentReviewSubmitBtn')?.addEventListener('click', submitRequest);
    modal.addEventListener('hidden.bs.modal', resetRequestModal);
    return modal;
  }

  function ensureInfoModal() {
    let modal = document.getElementById(INFO_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = INFO_MODAL_ID;
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-body text-center"><div class="taldo-content-review-icon"><i class="fa-solid fa-circle-info"></i></div><h4 class="fw-bold mb-3">تنبيه بخصوص تصحيح البيانات</h4><p class="lh-lg mb-0">يمكن طلب التعديلات العادية على بيانات الشهيد من زر <strong>استكمال بيانات</strong> الموجود في صفحة الشهيد. استخدم طلب مراجعة المحتوى فقط إذا كان التصحيح مرتبطًا بخصوصية العائلة أو اعتراض مباشر من الأقارب.</p><button type="button" class="btn btn-primary mt-4 px-4" data-bs-dismiss="modal">فهمت</button></div></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function ensureActionModal() {
    let modal = document.getElementById(ACTION_MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = ACTION_MODAL_ID;
    modal.tabIndex = -1;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-body"><div class="text-center mb-3"><div class="taldo-content-review-icon"><i class="fa-solid fa-gavel"></i></div><h4 class="fw-bold mb-2">إجراء على طلب الخصوصية</h4><div class="text-muted" id="contentReviewActionSummary"></div></div><div class="mb-3"><label class="form-label fw-bold" for="contentReviewActionStatus">الحالة</label><select class="form-select" id="contentReviewActionStatus"><option value="مقبول">قبول الطلب</option><option value="مرفوض">رفض الطلب</option><option value="عبثي">تحديده كعبثي</option></select></div><div class="mb-3"><label class="form-label fw-bold" for="contentReviewActionNotes">ملاحظة إدارية اختيارية</label><textarea class="form-control" id="contentReviewActionNotes" rows="3"></textarea></div><div class="alert alert-danger d-none" id="contentReviewActionError"></div><div class="d-flex justify-content-between gap-2 flex-wrap"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">إلغاء</button><button type="button" class="btn btn-primary taldo-review-action-btn" id="contentReviewActionSaveBtn">حفظ الإجراء</button></div></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#contentReviewActionSaveBtn')?.addEventListener('click', saveAction);
    return modal;
  }

  function onReasonChanged() {
    const selected = clean(document.querySelector('input[name="contentReviewReason"]:checked')?.value);
    document.getElementById('contentReviewReasonOtherWrap')?.classList.toggle('d-none', selected !== 'سبب آخر');
    if (selected !== 'سبب آخر') document.getElementById('contentReviewReasonOther').value = '';
    if (selected === 'طلب تصحيح بيانات') showModal(ensureInfoModal());
  }
  function setStep(step) {
    ['taldoContentReviewStepOne', 'taldoContentReviewStepTwo', 'taldoContentReviewSuccess'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.getElementById(step === 2 ? 'taldoContentReviewStepTwo' : step === 'success' ? 'taldoContentReviewSuccess' : 'taldoContentReviewStepOne')?.classList.add('active');
  }
  function showError(id, message) { const box = document.getElementById(id); if (box) { box.textContent = message; box.classList.remove('d-none'); } }
  function hideError(id) { const box = document.getElementById(id); if (box) { box.textContent = ''; box.classList.add('d-none'); } }
  function resetRequestModal() {
    if (state.submitting) return;
    const modal = document.getElementById(MODAL_ID); if (!modal) return;
    modal.querySelectorAll('input[type="text"], textarea').forEach(el => { el.value = ''; });
    modal.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
    modal.querySelectorAll('input[type="radio"]').forEach(el => { el.checked = false; });
    document.getElementById('contentReviewRelationshipOtherWrap')?.classList.add('d-none');
    document.getElementById('contentReviewReasonOtherWrap')?.classList.add('d-none');
    hideError('contentReviewStepOneError'); hideError('contentReviewStepTwoError'); setSubmitButton(false); setStep(1);
  }
  function validateOne() {
    const name = clean(document.getElementById('contentReviewRequesterName')?.value);
    const phone = clean(document.getElementById('contentReviewPhone')?.value);
    const relation = clean(document.getElementById('contentReviewRelationship')?.value);
    const other = clean(document.getElementById('contentReviewRelationshipOther')?.value);
    if (!name) return 'يرجى كتابة الاسم.';
    if (!relation) return 'يرجى اختيار صلة القرابة بالشهيد.';
    if (relation === 'آخر' && !other) return 'يرجى كتابة صلة القرابة عند اختيار آخر.';
    if (!phone) return 'يرجى كتابة رقم للتواصل.';
    return '';
  }
  function validateTwo() {
    const reason = clean(document.querySelector('input[name="contentReviewReason"]:checked')?.value);
    const other = clean(document.getElementById('contentReviewReasonOther')?.value);
    if (!reason) return 'يرجى اختيار سبب الطلب.';
    if (reason === 'سبب آخر' && !other) return 'يرجى كتابة السبب عند اختيار سبب آخر.';
    return '';
  }
  function goStepTwo() { hideError('contentReviewStepOneError'); const error = validateOne(); if (error) return showError('contentReviewStepOneError', error); setStep(2); }
  function setSubmitButton(busy) { const btn = document.getElementById('contentReviewSubmitBtn'); if (!btn) return; btn.disabled = !!busy; btn.innerHTML = busy ? '<span class="spinner-border spinner-border-sm ms-1"></span> جاري الإرسال...' : '<i class="fa-solid fa-paper-plane ms-1"></i> إرسال الطلب'; }
  function formData() {
    const martyr = state.currentMartyr || {};
    const relation = clean(document.getElementById('contentReviewRelationship')?.value);
    const reason = clean(document.querySelector('input[name="contentReviewReason"]:checked')?.value);
    return {
      martyr_id: clean(martyr.martyr_id), martyrId: clean(martyr.martyr_id),
      martyr_name: clean(martyr.full_name || martyr.martyr_name), martyrName: clean(martyr.full_name || martyr.martyr_name),
      family_name: clean(martyr.family_name),
      requester_name: clean(document.getElementById('contentReviewRequesterName')?.value), requesterName: clean(document.getElementById('contentReviewRequesterName')?.value),
      relationship: relation, relationship_other: relation === 'آخر' ? clean(document.getElementById('contentReviewRelationshipOther')?.value) : '',
      phone_text: clean(document.getElementById('contentReviewPhone')?.value), phone: clean(document.getElementById('contentReviewPhone')?.value),
      reason: reason, reason_other: reason === 'سبب آخر' ? clean(document.getElementById('contentReviewReasonOther')?.value) : '',
      status: 'بانتظار المراجعة', source: 'martyr_details'
    };
  }
  async function submitRequest() {
    if (state.submitting) return;
    hideError('contentReviewStepTwoError');
    const error = validateTwo(); if (error) return showError('contentReviewStepTwoError', error);
    const payload = formData();
    if (!payload.martyr_id) return showError('contentReviewStepTwoError', 'تعذر تحديد الشهيد المرتبط بالطلب. أعد فتح صفحة الشهيد ثم حاول مرة أخرى.');
    state.submitting = true; setSubmitButton(true);
    try {
      const res = await apiRequest(ACTION_SUBMIT, payload);
      if (!res || res.success === false) return showError('contentReviewStepTwoError', res?.message || 'تعذر إرسال الطلب. تأكد من تجهيز دالة الخادم الخاصة بطلبات الخصوصية.');
      if (res.request) setRequests([res.request].concat(window.__contentReviewRequests || []));
      setStep('success');
    } catch (e) { showError('contentReviewStepTwoError', e.message || 'تعذر إرسال الطلب.'); }
    finally { state.submitting = false; setSubmitButton(false); }
  }

  function ensureDetailsButton(martyrId) {
    const actionBar = document.querySelector('#detailsContainer .details-action-bar');
    if (!actionBar) return;
    martyrId = clean(martyrId || currentMartyrId()); if (!martyrId) return;
    let btn = actionBar.querySelector('.taldo-content-review-btn');
    if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-outline-danger taldo-content-review-btn'; btn.innerHTML = '<i class="fa-solid fa-shield-halved ms-1"></i> طلب مراجعة المحتوى'; actionBar.appendChild(btn); }
    btn.onclick = function (event) { event.preventDefault(); event.stopPropagation(); window.openContentReviewRequestModal(martyrId); };
  }
  window.openContentReviewRequestModal = function (martyrId) {
    const martyr = findMartyr(martyrId || currentMartyrId());
    if (!martyr || !clean(martyr.martyr_id)) return toast('تعذر تحديد الشهيد المرتبط بالطلب.');
    state.currentMartyr = martyr;
    const modal = ensureRequestModal(); resetRequestModal();
    const nameBox = document.getElementById('taldoContentReviewMartyrName');
    if (nameBox) { const name = clean(martyr.full_name || martyr.martyr_name); const family = clean(martyr.family_name); nameBox.textContent = name ? `خاص بصفحة: ${name}${family ? ' - عائلة ' + family : ''}` : 'خاص بصفحة الشهيد الحالية'; }
    showModal(modal);
  };

  function relationLabel(item) { const base = clean(item.relationship || item.relation || item.kinship); const other = clean(item.relationship_other || item.relation_other || item.kinship_other); return (base === 'آخر' && other) ? other : (base || other || '-'); }
  function reasonLabel(item) { const base = clean(item.reason || item.request_reason); const other = clean(item.reason_other || item.other_reason); return (base === 'سبب آخر' && other) ? other : (base || other || '-'); }

  function updateCountBadge() {
    const count = document.getElementById('contentReviewRequestsCount');
    const tabCount = document.getElementById('dashContentReviewCount');
    const list = Array.isArray(window.__contentReviewRequests) ? window.__contentReviewRequests : [];
    if (tabCount) tabCount.textContent = list.filter(item => pendingStatus(item.status)).length;
    if (count) count.textContent = getFilteredRequests().length;
  }
  function getFilteredRequests() {
    const search = normalize(document.getElementById('contentReviewRequestsSearchInput')?.value || '');
    const statusFilter = document.getElementById('contentReviewRequestsStatusFilter')?.value ?? 'بانتظار المراجعة';
    const reasonFilter = document.getElementById('contentReviewRequestsReasonFilter')?.value || '';
    const sortBy = document.getElementById('contentReviewRequestsSortSelect')?.value || 'newest';
    let list = Array.isArray(window.__contentReviewRequests) ? window.__contentReviewRequests.slice() : [];
    if (statusFilter) list = list.filter(item => statusFilter === 'بانتظار المراجعة' ? pendingStatus(item.status) : clean(item.status) === statusFilter);
    if (reasonFilter) list = list.filter(item => clean(item.reason || item.request_reason) === reasonFilter);
    if (search) list = list.filter(item => normalize(item.__contentReviewSearch || [item.created_at, item.martyr_name, item.full_name, item.family_name, item.requester_name, item.relationship, item.relationship_other, item.phone_text, item.reason, item.reason_other, item.status, item.admin_notes].join(' ')).includes(search));
    if (sortBy === 'oldest') list.sort((a, b) => clean(a.created_at).localeCompare(clean(b.created_at)));
    else if (sortBy === 'martyr') list.sort((a, b) => clean(a.martyr_name || a.full_name).localeCompare(clean(b.martyr_name || b.full_name), 'ar'));
    else if (sortBy === 'requester') list.sort((a, b) => clean(a.requester_name).localeCompare(clean(b.requester_name), 'ar'));
    else list.sort((a, b) => clean(b.created_at).localeCompare(clean(a.created_at)));
    return list;
  }
  function pagination(current, totalPages, totalItems) {
    if (!totalItems) return '';
    const size = pageSize(), from = Math.min(totalItems, (current - 1) * size + 1), to = Math.min(totalItems, current * size);
    if (totalPages <= 1) return `<div class="text-muted small text-center py-2">عرض ${totalItems} طلب</div>`;
    const pages = [], radius = window.innerWidth <= 768 ? 1 : 2, start = Math.max(1, current - radius), end = Math.min(totalPages, current + radius);
    if (start > 1) pages.push(1); if (start > 2) pages.push('...'); for (let i = start; i <= end; i++) pages.push(i); if (end < totalPages - 1) pages.push('...'); if (end < totalPages) pages.push(totalPages);
    return `<div class="dashboard-pagination"><button class="btn btn-outline-primary btn-sm" onclick="goToContentReviewRequestsPage(${current - 1})" ${current <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>${pages.map(p => p === '...' ? '<span class="text-muted px-1">...</span>' : `<button class="btn btn-sm ${p === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="goToContentReviewRequestsPage(${p})">${p}</button>`).join('')}<button class="btn btn-outline-primary btn-sm" onclick="goToContentReviewRequestsPage(${current + 1})" ${current >= totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button><div class="w-100 text-center text-muted small">عرض ${from} - ${to} من ${totalItems}</div></div>`;
  }

  function ensureDashboardTab() {
    const tabs = document.querySelector('.dashboard-tabs') || document.querySelector('#dashboardPage .nav-pills');
    if (tabs && !document.getElementById(TAB_BTN_ID)) tabs.insertAdjacentHTML('beforeend', `<li class="nav-item" role="presentation"><button class="nav-link" id="${TAB_BTN_ID}" type="button" onclick="showDashboardTab('contentReview')"><i class="fa-solid fa-shield-halved ms-1"></i> طلبات الخصوصية <span class="badge text-bg-danger ms-1" id="dashContentReviewCount">0</span></button></li>`);
    const dashboard = document.getElementById('dashboardPage');
    if (dashboard && !document.getElementById(TAB_PANE_ID)) dashboard.insertAdjacentHTML('beforeend', `
      <div id="${TAB_PANE_ID}" class="dashboard-section-card dashboard-tab-pane d-none">
        <div class="dashboard-section-header"><h5 class="fw-bold mb-0"><i class="fa-solid fa-shield-halved text-danger ms-1"></i> طلبات مراجعة المحتوى والخصوصية</h5><span class="badge text-bg-light" id="contentReviewRequestsCount">0</span></div>
        <div class="dashboard-controls-row mb-2" id="contentReviewRequestsControls"><div class="row g-2 align-items-end"><div class="col-md-3"><label class="form-label fw-bold">بحث</label><input class="form-control" id="contentReviewRequestsSearchInput" type="search" placeholder="بحث باسم الشهيد أو مقدم الطلب..." oninput="resetContentReviewRequestsPageAndRender()"></div><div class="col-md-3"><label class="form-label fw-bold">الحالة</label><select class="form-select" id="contentReviewRequestsStatusFilter" onchange="resetContentReviewRequestsPageAndRender()"><option value="بانتظار المراجعة" selected>بانتظار المراجعة</option><option value="مقبول">مقبول</option><option value="مرفوض">مرفوض</option><option value="عبثي">عبثي</option><option value="">الكل</option></select></div><div class="col-md-3"><label class="form-label fw-bold">نوع الطلب</label><select class="form-select" id="contentReviewRequestsReasonFilter" onchange="resetContentReviewRequestsPageAndRender()"><option value="">الكل</option><option value="طلب إخفاء الصورة">طلب إخفاء الصورة</option><option value="طلب حجب رفع الصور للشهيد">طلب حجب رفع الصور</option><option value="طلب تصحيح بيانات">طلب تصحيح بيانات</option><option value="طلب مسح صفحة الشهيد مع كافة المحتويات">طلب مسح الصفحة</option><option value="سبب آخر">سبب آخر</option></select></div><div class="col-md-3"><label class="form-label fw-bold">فرز</label><select class="form-select" id="contentReviewRequestsSortSelect" onchange="resetContentReviewRequestsPageAndRender()"><option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option><option value="martyr">حسب اسم الشهيد</option><option value="requester">حسب اسم المرسل</option></select></div></div></div>
        <div class="table-responsive"><table class="table table-hover align-middle"><thead><tr><th>التاريخ</th><th>الشهيد</th><th>مقدم الطلب</th><th>صلة القرابة</th><th>التواصل</th><th>السبب</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody id="contentReviewRequestsTableBody"><tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات بعد.</td></tr></tbody></table></div>
      </div>`);
    updateCountBadge();
  }

  window.renderContentReviewRequestsTable = function () {
    ensureDashboardTab();
    const tbody = document.getElementById('contentReviewRequestsTableBody'); if (!tbody) return;
    const list = getFilteredRequests(); const count = document.getElementById('contentReviewRequestsCount'); if (count) count.textContent = list.length;
    if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">لا توجد طلبات مطابقة.</td></tr>`; updateCountBadge(); return; }
    const size = pageSize(), totalPages = Math.max(1, Math.ceil(list.length / size));
    if (state.page > totalPages) state.page = totalPages; if (state.page < 1) state.page = 1;
    const pageList = list.slice((state.page - 1) * size, (state.page - 1) * size + size);
    tbody.innerHTML = pageList.map(item => {
      const requestId = clean(item.request_id || item.review_id || item.privacy_request_id || item.id);
      const martyrId = clean(item.martyr_id || item.martyrId);
      const reason = clean(item.reason || item.request_reason);
      const reasonClass = reason === 'طلب مسح صفحة الشهيد مع كافة المحتويات' ? ' is-danger' : '';
      const martyrName = clean(item.martyr_name || item.martyrName || item.full_name) || '-';
      return `<tr data-content-review-id="${attr(requestId)}"><td class="small text-muted">${html(item.created_at || '')}</td><td class="fw-bold" ${martyrId ? `style="cursor:pointer" onclick="openMartyrDetails('${attr(martyrId)}', 'dashboardPage')"` : ''}>${html(martyrName)}</td><td>${html(item.requester_name || item.requesterName || '')}</td><td><span class="taldo-review-relation-badge">${html(relationLabel(item))}</span></td><td>${html(item.phone_text || item.phone || '')}</td><td class="taldo-review-request-cell"><span class="taldo-review-reason-badge${reasonClass}">${html(reasonLabel(item))}</span>${item.reason_other ? `<div class="small text-muted mt-2">${html(item.reason_other)}</div>` : ''}</td><td>${badge(item.status || 'بانتظار المراجعة')}</td><td class="dashboard-action-cell">${pendingStatus(item.status) ? `<button class="btn btn-sm btn-primary taldo-review-action-btn" onclick="openContentReviewActionModal('${attr(requestId)}')">إجراء</button>` : '-'}</td></tr>`;
    }).join('') + `<tr class="dash-pagination-row"><td colspan="8">${pagination(state.page, totalPages, list.length)}</td></tr>`;
    updateCountBadge();
  };
  window.goToContentReviewRequestsPage = function (page) { state.page = Math.max(1, Number(page) || 1); window.renderContentReviewRequestsTable(); };
  window.resetContentReviewRequestsPageAndRender = function () { state.page = 1; window.renderContentReviewRequestsTable(); };

  window.openContentReviewActionModal = function (requestId) {
    requestId = clean(requestId); if (!requestId) return toast('معرّف الطلب غير موجود.');
    const item = (window.__contentReviewRequests || []).find(row => clean(row.request_id || row.review_id || row.privacy_request_id || row.id) === requestId);
    state.actionRequestId = requestId; const modal = ensureActionModal();
    const summary = document.getElementById('contentReviewActionSummary'); if (summary) summary.textContent = item ? `${clean(item.martyr_name || item.full_name)} - ${clean(item.requester_name)}` : '';
    const notes = document.getElementById('contentReviewActionNotes'); if (notes) notes.value = '';
    const status = document.getElementById('contentReviewActionStatus'); if (status) status.value = 'مقبول';
    hideError('contentReviewActionError'); setActionButton(false); showModal(modal);
  };
  function setActionButton(busy) { const btn = document.getElementById('contentReviewActionSaveBtn'); if (!btn) return; btn.disabled = !!busy; btn.innerHTML = busy ? '<span class="spinner-border spinner-border-sm ms-1"></span> جاري الحفظ...' : 'حفظ الإجراء'; }
  async function saveAction() {
    if (state.actionBusy) return;
    const requestId = clean(state.actionRequestId), status = clean(document.getElementById('contentReviewActionStatus')?.value), notes = clean(document.getElementById('contentReviewActionNotes')?.value);
    if (!requestId || !status) return showError('contentReviewActionError', 'يرجى اختيار الإجراء المطلوب.');
    state.actionBusy = true; setActionButton(true); hideError('contentReviewActionError');
    try {
      const res = await apiRequest(ACTION_UPDATE_STATUS, { request_id: requestId, requestId, status, admin_notes: notes, adminNotes: notes });
      if (!res || res.success === false) return showError('contentReviewActionError', res?.message || 'تعذر حفظ الإجراء.');
      window.__contentReviewRequests = (window.__contentReviewRequests || []).map(item => clean(item.request_id || item.review_id || item.privacy_request_id || item.id) === requestId ? Object.assign({}, item, { status, admin_notes: notes || item.admin_notes || '', reviewed_at: res.reviewed_at || item.reviewed_at || new Date().toISOString() }) : item);
      hideModal(document.getElementById(ACTION_MODAL_ID)); toast(res.message || 'تم حفظ الإجراء.'); window.renderContentReviewRequestsTable();
    } catch (e) { showError('contentReviewActionError', e.message || 'تعذر حفظ الإجراء.'); }
    finally { state.actionBusy = false; setActionButton(false); }
  }

  function installDetailsPatch() {
    const oldOpenDetails = window.openMartyrDetails || (typeof openMartyrDetails === 'function' ? openMartyrDetails : null);
    if (typeof oldOpenDetails !== 'function' || oldOpenDetails.__contentReviewWrapped) return;
    window.openMartyrDetails = function (martyrId) { const result = oldOpenDetails.apply(this, arguments); setTimeout(() => ensureDetailsButton(martyrId), 40); requestAnimationFrame(() => ensureDetailsButton(martyrId)); setTimeout(() => ensureDetailsButton(martyrId), 220); return result; };
    window.openMartyrDetails.__contentReviewWrapped = true; try { openMartyrDetails = window.openMartyrDetails; } catch (e) {}
  }
  function installApiPatch() {
    const oldApi = window.apiRequest || (typeof apiRequest === 'function' ? apiRequest : null);
    if (typeof oldApi !== 'function' || oldApi.__contentReviewWrapped) return;
    window.apiRequest = function (actionOrPayload) {
      return oldApi.apply(this, arguments).then(res => {
        const action = typeof actionOrPayload === 'string' ? actionOrPayload : (actionOrPayload && typeof actionOrPayload === 'object' ? actionOrPayload.action || '' : '');
        if (action === 'getAdminDashboardData' && res && res.success !== false) { const list = responseRequests(res); if (Array.isArray(list)) { setRequests(list); setTimeout(() => { ensureDashboardTab(); window.renderContentReviewRequestsTable(); }, 60); } }
        return res;
      });
    };
    window.apiRequest.__contentReviewWrapped = true; try { apiRequest = window.apiRequest; } catch (e) {}
  }
  function installRefreshPatch() {
    const oldRefresh = window.refreshDashboardData || (typeof refreshDashboardData === 'function' ? refreshDashboardData : null);
    if (typeof oldRefresh !== 'function' || oldRefresh.__contentReviewWrapped) return;
    window.refreshDashboardData = function () { const result = oldRefresh.apply(this, arguments); setTimeout(() => { ensureDashboardTab(); window.renderContentReviewRequestsTable(); }, 300); return result; };
    window.refreshDashboardData.__contentReviewWrapped = true; try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
  }
  function installShowTabPatch() {
    const oldShowTab = window.showDashboardTab || (typeof showDashboardTab === 'function' ? showDashboardTab : null);
    if (typeof oldShowTab !== 'function' || oldShowTab.__contentReviewWrapped) return;
    window.showDashboardTab = function (tabName) {
      if (tabName === 'contentReview') {
        ensureDashboardTab();
        document.querySelectorAll('.dashboard-tab-pane').forEach(p => { p.classList.add('d-none'); p.classList.remove('active'); });
        document.querySelectorAll('#dashboardPage .nav-link, .dashboard-tabs .nav-link').forEach(b => b.classList.remove('active'));
        document.getElementById(TAB_PANE_ID)?.classList.remove('d-none'); document.getElementById(TAB_PANE_ID)?.classList.add('active'); document.getElementById(TAB_BTN_ID)?.classList.add('active');
        try { const url = new URL(window.location.href); url.searchParams.set('page', 'dashboard'); url.searchParams.set('tab', 'contentReview'); history.replaceState({ page: 'dashboard', tab: 'contentReview' }, '', url.toString()); localStorage.setItem('taldo_last_dashboard_tab', 'contentReview'); } catch (e) {}
        window.renderContentReviewRequestsTable(); return;
      }
      document.getElementById(TAB_PANE_ID)?.classList.add('d-none'); document.getElementById(TAB_PANE_ID)?.classList.remove('active'); document.getElementById(TAB_BTN_ID)?.classList.remove('active');
      const result = oldShowTab.apply(this, arguments); setTimeout(() => { document.getElementById(TAB_PANE_ID)?.classList.add('d-none'); document.getElementById(TAB_PANE_ID)?.classList.remove('active'); document.getElementById(TAB_BTN_ID)?.classList.remove('active'); ensureDashboardTab(); }, 80); return result;
    };
    window.showDashboardTab.__contentReviewWrapped = true; try { showDashboardTab = window.showDashboardTab; } catch (e) {}
  }
  function installOpenDashboardPatch() {
    const oldOpenDashboard = window.openDashboardPage || (typeof openDashboardPage === 'function' ? openDashboardPage : null);
    if (typeof oldOpenDashboard !== 'function' || oldOpenDashboard.__contentReviewWrapped) return;
    window.openDashboardPage = function () { const result = oldOpenDashboard.apply(this, arguments); setTimeout(() => { ensureDashboardTab(); let wanted = ''; try { wanted = new URLSearchParams(window.location.search).get('tab') || localStorage.getItem('taldo_last_dashboard_tab') || ''; } catch (e) {} if (wanted === 'contentReview') window.showDashboardTab('contentReview'); }, 120); return result; };
    window.openDashboardPage.__contentReviewWrapped = true; try { openDashboardPage = window.openDashboardPage; } catch (e) {}
  }

  function boot() {
    ensureRequestModal(); ensureInfoModal(); ensureActionModal(); ensureDashboardTab(); installApiPatch(); installDetailsPatch(); installRefreshPatch(); installShowTabPatch(); installOpenDashboardPatch();
    setTimeout(() => { ensureDetailsButton(currentMartyrId()); ensureDashboardTab(); window.renderContentReviewRequestsTable(); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1200);
  const observer = new MutationObserver(() => { ensureDetailsButton(currentMartyrId()); ensureDashboardTab(); });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
})();
