(function () {
  const SETTING_KEY = 'privacy_publish_policy_text';
  const FORMAT = 'privacy_policy_sections_v1';
  const SESSION_ACCEPTED_KEY = 'taldo_privacy_policy_session_hash';
  const PERSISTENT_ACCEPTED_KEY = 'taldo_privacy_policy_accepted_hash';
  const MODAL_ID = 'taldoPrivacyConsentModal';
  const ADMIN_CARD_ID = 'taldoPrivacyPolicySettingsCard';
  const ADMIN_TEXTAREA_ID = 'taldoPrivacyPolicyAdminText';
  const ADMIN_BUILDER_ID = 'taldoPrivacyPolicyBuilder';

  let consentModalInstance = null;
  let introCallbackQueued = null;
  let privacyModalWasShownThisBoot = false;

  const DEFAULT_SECTIONS = [
    {
      title: 'سياسة الخصوصية والنشر',
      body: 'يحرص مشروع "أرشيف شهداء تلدو" على احترام خصوصية الأفراد وصون كرامة الشهداء وذويهم.\n\nيهدف المشروع إلى توثيق أسماء شهداء مدينة تلدو وحفظ ذاكرتهم للأجيال القادمة ضمن إطار تاريخي ومجتمعي غير ربحي.'
    },
    {
      title: 'مصادر المعلومات والصور',
      body: 'تعتمد المعلومات المنشورة على المصادر المتاحة، ومنها:\n- ما يقدمه ذوو الشهيد أو أقاربه.\n- الوثائق والصور المتداولة علنًا.\n- الأرشيفات المحلية والمصادر المجتمعية الموثوقة.\n\nلا يقوم المشروع بجمع أو نشر أي معلومات شخصية حساسة لا تخدم الغرض التوثيقي.'
    },
    {
      title: 'حدود المسؤولية وإخلاء الطرف',
      body: 'تبذل إدارة المشروع جهدًا معقولًا للتحقق من المعلومات وتنظيمها، إلا أنها لا تدعي الكمال أو العصمة من الخطأ، وقد تخضع بعض المعلومات التاريخية للمراجعة أو التحديث عند ورود مصادر أكثر دقة.\n\nيتحمل مرسل البيانات أو الصور مسؤولية صحة ما يرسله، ومسؤولية امتلاكه الحق أو الإذن اللازم لإرسالها ونشرها. ولا تتحمل إدارة المشروع مسؤولية أي بيانات أو صور يتم إرسالها خلافًا للحقيقة أو دون صفة أو إذن من أصحاب العلاقة.\n\nكما لا تتحمل إدارة المشروع مسؤولية أي استخدام غير قانوني أو مسيء أو مضلل للمحتوى من قبل أطراف خارجية، ويُحظر استخدام محتوى الموقع للإساءة إلى الشهداء أو ذويهم أو لأي غرض يخالف القانون أو الأخلاق العامة.'
    },
    {
      title: 'طلبات التصحيح أو الإزالة',
      body: 'في حال وجود أي معلومات غير دقيقة، أو صورة منشورة دون رضا أصحاب العلاقة، أو أي ملاحظة تتعلق بالخصوصية أو حقوق الصور، يمكن إرسال طلب مراجعة إلى إدارة المشروع لدراسة الطلب واتخاذ الإجراء المناسب.\n\nتحتفظ إدارة المشروع بحق قبول الطلب أو رفضه أو طلب معلومات إضافية، كما تحتفظ بحق إخفاء أو تعديل أو حذف أي محتوى عند الحاجة.'
    },
    {
      title: 'شروط الاستخدام',
      body: 'باستخدام هذا الموقع، يوافق الزائر على استخدام المحتوى لأغراض الاطلاع والتوثيق والبحث فقط، وعدم إعادة نشر المحتوى بصورة مضللة أو مجتزأة تؤدي إلى تحريف الوقائع، واحترام حقوق الصور والوثائق وأصحابها متى كانت معلومة للمشروع.\n\nيحتفظ المشروع بحق تحديث هذه السياسة كلما دعت الحاجة.'
    }
  ];

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

  function decodeHtmlEntities(value) {
    const text = String(value || '');
    if (!/[&][a-zA-Z#0-9]+;/.test(text)) return text;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function formatMultiline(value) {
    return escapeHtml(value)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\n/g, '<br>');
  }

  function safeCssEscape(value) {
    const text = String(value || '');
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(text);
    return text.replace(/[^a-zA-Z0-9_-]/g, function (char) {
      return '\\' + char;
    });
  }

  function normalizeSection(section) {
    section = section || {};
    return {
      title: String(section.title || section.heading || '').trim(),
      body: String(section.body || section.text || section.content || '').trim()
    };
  }

  function normalizeSections(sections) {
    return (Array.isArray(sections) ? sections : [])
      .map(normalizeSection)
      .filter(section => section.title || section.body)
      .map(section => ({
        title: section.title || 'قسم بدون عنوان',
        body: section.body || ''
      }));
  }

  function tryJsonParse(value) {
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function extractSectionsFromParsed(parsed) {
    if (!parsed) return [];
    if (typeof parsed === 'string') return parsePolicySections(parsed, true);
    if (Array.isArray(parsed)) return normalizeSections(parsed);
    if (parsed.type === FORMAT && Array.isArray(parsed.sections)) return normalizeSections(parsed.sections);
    if (Array.isArray(parsed.sections)) return normalizeSections(parsed.sections);
    if (parsed.title || parsed.body || parsed.text || parsed.content) return normalizeSections([parsed]);
    return [];
  }

  function parseJsonSectionsLoose(rawValue) {
    let raw = decodeHtmlEntities(String(rawValue || '').trim());
    if (!raw) return [];

    for (let i = 0; i < 3; i++) {
      const parsed = tryJsonParse(raw);
      const sections = extractSectionsFromParsed(parsed);
      if (sections.length) return sections;
      if (typeof parsed === 'string' && parsed !== raw) {
        raw = parsed.trim();
        continue;
      }
      break;
    }

    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = raw.slice(firstBracket, lastBracket + 1);
      const sections = extractSectionsFromParsed(tryJsonParse(candidate));
      if (sections.length) return sections;
    }

    return [];
  }

  function parseTextSections(rawValue) {
    const raw = String(rawValue || '').replace(/\r/g, '').trim();
    if (!raw) return [];

    const labelRegex = /(?:^|\n)\s*العنوان\s*:\s*([\s\S]*?)\n\s*النص\s*:\s*([\s\S]*?)(?=\n\s*العنوان\s*:|$)/g;
    const labeled = [];
    let match;
    while ((match = labelRegex.exec(raw)) !== null) {
      labeled.push({
        title: String(match[1] || '').trim(),
        body: String(match[2] || '').trim()
      });
    }
    if (labeled.length) return normalizeSections(labeled);

    const knownTitles = [
      'سياسة الخصوصية',
      'سياسة الخصوصية والنشر',
      'مصادر المعلومات والصور',
      'حدود المسؤولية وإخلاء الطرف',
      'طلبات التصحيح أو الإزالة',
      'شروط الاستخدام',
      'تنبيه مهم'
    ];

    const sections = [];
    let current = null;
    raw.split('\n').forEach(line => {
      const clean = line.trim().replace(/^#+\s*/, '').replace(/[:：]$/, '').trim();
      if (knownTitles.includes(clean)) {
        if (current) sections.push({ title: current.title, body: current.bodyLines.join('\n').trim() });
        current = { title: clean, bodyLines: [] };
      } else if (current) {
        current.bodyLines.push(line);
      }
    });
    if (current) sections.push({ title: current.title, body: current.bodyLines.join('\n').trim() });

    return sections.length > 1 ? normalizeSections(sections) : [];
  }

  function parsePolicySections(rawValue, nested) {
    const raw = String(rawValue || '').trim();
    if (!raw) return nested ? [] : DEFAULT_SECTIONS.slice();

    const jsonSections = parseJsonSectionsLoose(raw);
    if (jsonSections.length) return jsonSections;

    const textSections = parseTextSections(raw);
    if (textSections.length) return textSections;

    return nested ? [] : [{ title: 'سياسة الخصوصية والنشر', body: raw }];
  }

  function stringifyPolicySections(sections) {
    return JSON.stringify({
      type: FORMAT,
      sections: normalizeSections(sections)
    });
  }

  function getSettingsObject() {
    let settings = {};
    try {
      if (typeof publicSettings !== 'undefined' && publicSettings) settings = Object.assign(settings, publicSettings);
    } catch (error) {}
    if (window.publicSettings && typeof window.publicSettings === 'object') {
      settings = Object.assign(settings, window.publicSettings);
    }
    return settings || {};
  }

  function getPolicyRawValue() {
    const settings = getSettingsObject();
    const candidates = [
      settings[SETTING_KEY],
      settings.privacy_policy_text,
      settings.privacy_text,
      window.__taldoPrivacyPolicyRawValue,
      document.getElementById(ADMIN_TEXTAREA_ID)?.value
    ].map(value => String(value || '').trim()).filter(Boolean);

    return candidates[0] || stringifyPolicySections(DEFAULT_SECTIONS);
  }

  function setPolicyValueEverywhere(value) {
    value = String(value || '');
    window.__taldoPrivacyPolicyRawValue = value;
    if (!window.publicSettings) window.publicSettings = {};
    window.publicSettings[SETTING_KEY] = value;
    try {
      if (typeof publicSettings !== 'undefined') {
        publicSettings = publicSettings || {};
        publicSettings[SETTING_KEY] = value;
      }
    } catch (error) {}

    const hidden = document.getElementById(ADMIN_TEXTAREA_ID);
    if (hidden) hidden.value = value;
  }

  function hashString(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function getCurrentPolicyHash() {
    return hashString(getPolicyRawValue());
  }

  function hasAcceptedCurrentPolicy() {
    const currentHash = getCurrentPolicyHash();
    try {
      if (sessionStorage.getItem(SESSION_ACCEPTED_KEY) === currentHash) return true;
    } catch (error) {}
    try {
      if (localStorage.getItem(PERSISTENT_ACCEPTED_KEY) === currentHash) return true;
    } catch (error) {}
    return false;
  }

  function markPolicyAccepted(dontShowAgain) {
    const currentHash = getCurrentPolicyHash();
    try { sessionStorage.setItem(SESSION_ACCEPTED_KEY, currentHash); } catch (error) {}
    if (dontShowAgain) {
      try { localStorage.setItem(PERSISTENT_ACCEPTED_KEY, currentHash); } catch (error) {}
    }
  }

  function renderPolicyAccordionHtml(sections, idPrefix) {
    const safePrefix = idPrefix || ('taldoPrivacyPolicyAccordion_' + Date.now());
    const list = normalizeSections(sections);

    return `
      <div class="accordion taldo-privacy-policy-accordion" id="${escapeAttr(safePrefix)}">
        ${list.map((section, index) => {
          const headingId = safePrefix + '_heading_' + index;
          const collapseId = safePrefix + '_collapse_' + index;
          const isOpen = index === 0;
          return `
            <div class="accordion-item">
              <h2 class="accordion-header" id="${escapeAttr(headingId)}">
                <button class="accordion-button ${isOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${escapeAttr(collapseId)}" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${escapeAttr(collapseId)}">
                  <i class="fa-solid fa-shield-heart ms-1"></i>
                  ${escapeHtml(section.title || 'قسم')}
                </button>
              </h2>
              <div id="${escapeAttr(collapseId)}" class="accordion-collapse collapse ${isOpen ? 'show' : ''}" aria-labelledby="${escapeAttr(headingId)}" data-bs-parent="#${escapeAttr(safePrefix)}">
                <div class="accordion-body">${formatMultiline(section.body || '')}</div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function ensureConsentModal() {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="${MODAL_ID}" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
          <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content">
              <div class="modal-body">
                <div class="taldo-privacy-consent-hero">
                  <span class="taldo-privacy-consent-icon"><i class="fa-solid fa-shield-halved"></i></span>
                  <h4 class="taldo-privacy-consent-title">سياسة الخصوصية والنشر</h4>
                  <p class="taldo-privacy-consent-subtitle">
                    باستخدامك لهذا الموقع فإنك توافق على سياسة الخصوصية والنشر وشروط استخدام المحتوى المنشور في مشروع أرشيف شهداء تلدو.
                  </p>
                </div>
                <div class="taldo-privacy-consent-body">
                  <div class="taldo-privacy-policy-scroll" id="taldoPrivacyConsentPolicyContent"></div>
                  <div class="taldo-privacy-consent-footer">
                    <div class="form-check taldo-privacy-consent-check">
                      <input class="form-check-input" type="checkbox" id="taldoPrivacyDontShowAgain">
                      <label class="form-check-label" for="taldoPrivacyDontShowAgain">عدم إظهار هذه النافذة مجددًا بعد الموافقة، إلا إذا تم تعديل نص السياسة لاحقًا.</label>
                    </div>
                    <button type="button" class="taldo-privacy-consent-agree-btn" id="taldoPrivacyConsentAgreeBtn">
                      <i class="fa-solid fa-check ms-1"></i>
                      موافق
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`);
      modal = document.getElementById(MODAL_ID);

      const agreeBtn = document.getElementById('taldoPrivacyConsentAgreeBtn');
      if (agreeBtn) {
        agreeBtn.addEventListener('click', function () {
          const dontShowAgain = !!document.getElementById('taldoPrivacyDontShowAgain')?.checked;
          markPolicyAccepted(dontShowAgain);
          try { getConsentModalInstance().hide(); } catch (error) {}
          setTimeout(runQueuedIntroCallback, 280);
        });
      }
    }

    const content = document.getElementById('taldoPrivacyConsentPolicyContent');
    if (content) {
      const sections = parsePolicySections(getPolicyRawValue());
      content.innerHTML = renderPolicyAccordionHtml(sections, 'taldoPrivacyConsentPolicyAccordion');
    }

    return modal;
  }

  function getConsentModalInstance() {
    const modal = ensureConsentModal();
    if (!consentModalInstance && window.bootstrap && bootstrap.Modal) {
      consentModalInstance = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: false,
        focus: true
      });
    }
    return consentModalInstance;
  }

  function showConsentModal() {
    if (hasAcceptedCurrentPolicy()) return false;
    const modal = ensureConsentModal();
    if (!modal || !window.bootstrap || !bootstrap.Modal) return false;
    privacyModalWasShownThisBoot = true;
    getConsentModalInstance().show();
    return true;
  }

  function runQueuedIntroCallback() {
    if (typeof introCallbackQueued !== 'function') return;
    const callback = introCallbackQueued;
    introCallbackQueued = null;
    try { callback(); } catch (error) { console.warn('privacy intro callback failed:', error); }
  }

  function wrapIntroModalFlow() {
    const current = window.maybeShowIntroModal;
    if (typeof current !== 'function' || current.__taldoPrivacyConsentWrapped) return;

    const wrapped = function () {
      const originalArgs = arguments;
      const originalThis = this;
      const originalRunner = function () {
        return current.apply(originalThis, originalArgs);
      };

      if (!hasAcceptedCurrentPolicy()) {
        introCallbackQueued = originalRunner;
        const shown = showConsentModal();
        if (shown) return;
      }

      return originalRunner();
    };

    wrapped.__taldoPrivacyConsentWrapped = true;
    wrapped.__previousMaybeShowIntroModal = current;
    window.maybeShowIntroModal = wrapped;
    try { maybeShowIntroModal = window.maybeShowIntroModal; } catch (error) {}
  }

  function maybeShowConsentAsFallback() {
    if (privacyModalWasShownThisBoot) return;
    if (hasAcceptedCurrentPolicy()) return;
    const hasVisibleModal = !!document.querySelector('.modal.show');
    if (hasVisibleModal) return;
    showConsentModal();
  }

  function getAdminPolicySectionsFromRows() {
    return Array.from(document.querySelectorAll('.taldo-privacy-policy-section-admin-item'))
      .map(row => ({
        title: row.querySelector('.taldo-privacy-policy-section-title')?.value || '',
        body: row.querySelector('.taldo-privacy-policy-section-body')?.value || ''
      }))
      .map(normalizeSection)
      .filter(section => section.title || section.body);
  }

  function renumberPolicyRows() {
    const rows = Array.from(document.querySelectorAll('.taldo-privacy-policy-section-admin-item'));
    rows.forEach((row, index) => {
      const number = row.querySelector('.taldo-privacy-policy-section-number');
      if (number) number.textContent = String(index + 1);
      const removeBtn = row.querySelector('.taldo-privacy-policy-remove-section-btn');
      if (removeBtn) removeBtn.disabled = rows.length <= 1;
    });
  }

  function addPolicySectionRow(section, open) {
    const builder = document.getElementById(ADMIN_BUILDER_ID);
    if (!builder) return;

    const key = 'privacy_policy_row_' + Date.now() + '_' + Math.random().toString(16).slice(2);
    const collapseId = 'privacyPolicyAdminCollapse_' + key;
    const row = document.createElement('div');
    row.className = 'taldo-privacy-policy-section-admin-item';
    row.dataset.rowKey = key;
    row.innerHTML = `
      <div class="taldo-privacy-policy-section-admin-head">
        <button type="button" class="taldo-privacy-policy-section-admin-toggle ${open ? '' : 'collapsed'}" data-bs-toggle="collapse" data-bs-target="#${escapeAttr(collapseId)}" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${escapeAttr(collapseId)}">
          <span class="taldo-privacy-policy-section-number">1</span>
          <span class="taldo-privacy-policy-section-title-preview">${escapeHtml(section?.title || 'قسم جديد')}</span>
          <i class="fa-solid fa-chevron-down taldo-privacy-policy-section-chevron"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger taldo-privacy-policy-remove-section-btn" onclick="removePrivacyPolicySectionRow('${escapeAttr(key)}')" title="حذف القسم">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div id="${escapeAttr(collapseId)}" class="collapse taldo-privacy-policy-section-admin-collapse ${open ? 'show' : ''}">
        <div class="row g-3 pt-3">
          <div class="col-12">
            <label class="form-label fw-bold">عنوان القسم</label>
            <input type="text" class="form-control taldo-privacy-policy-section-title" value="${escapeAttr(section?.title || '')}" placeholder="مثال: سياسة الخصوصية والنشر">
          </div>
          <div class="col-12">
            <label class="form-label fw-bold">نص القسم</label>
            <textarea class="form-control taldo-privacy-policy-section-body" rows="5" placeholder="اكتب نص هذا القسم هنا...">${escapeHtml(section?.body || '')}</textarea>
          </div>
        </div>
      </div>`;

    builder.appendChild(row);

    const titleInput = row.querySelector('.taldo-privacy-policy-section-title');
    const preview = row.querySelector('.taldo-privacy-policy-section-title-preview');
    if (titleInput && preview) {
      titleInput.addEventListener('input', function () {
        preview.textContent = titleInput.value.trim() || 'قسم جديد';
      });
    }

    renumberPolicyRows();
  }

  function rebuildPolicyBuilder(raw) {
    const builder = document.getElementById(ADMIN_BUILDER_ID);
    if (!builder) return;
    const sections = parsePolicySections(raw || getPolicyRawValue());
    builder.innerHTML = '';
    sections.forEach((section, index) => addPolicySectionRow(section, index === 0));
    if (!sections.length) addPolicySectionRow({ title: '', body: '' }, true);
  }

  function ensureAdminPolicyCard() {
    const tab = document.getElementById('dashboardSettingsTab');
    if (!tab) return;

    let card = document.getElementById(ADMIN_CARD_ID);
    if (!card) {
      const raw = getPolicyRawValue();
      const aboutCard = document.getElementById('aboutUsAdminText')?.closest('.settings-card');
      const panelId = 'taldoPrivacyPolicySettingsPanel';
      const wrapper = document.createElement('div');
      wrapper.className = 'settings-card taldo-settings-accordion-card';
      wrapper.id = ADMIN_CARD_ID;
      wrapper.dataset.settingsAccordionEnhanced = '1';
      wrapper.innerHTML = `
        <button type="button" class="taldo-settings-accordion-toggle collapsed" data-bs-toggle="collapse" data-bs-target="#${panelId}" aria-expanded="false" aria-controls="${panelId}">
          <span><i class="fa-solid fa-shield-halved text-primary ms-1"></i> سياسة الخصوصية والنشر</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div id="${panelId}" class="taldo-settings-accordion-body collapse">
          <div class="taldo-privacy-policy-admin-help mb-3">
            هذا النص يظهر في المودال الإجباري عند فتح الموقع. يمكنك تعديله من هنا دون تغيير الأكواد. سيظهر للمستخدم على شكل أقسام أكورديون.
          </div>
          <textarea id="${ADMIN_TEXTAREA_ID}" class="d-none" aria-hidden="true">${escapeHtml(raw)}</textarea>
          <div id="${ADMIN_BUILDER_ID}" class="taldo-privacy-policy-admin"></div>
          <div class="d-flex gap-2 flex-wrap mt-3 taldo-privacy-policy-save-row">
            <button type="button" class="btn btn-outline-primary" onclick="addPrivacyPolicySectionRow({ title: '', body: '' })">
              <i class="fa-solid fa-plus ms-1"></i>
              إضافة عنوان ونص جديد
            </button>
            <button type="button" class="btn btn-outline-secondary" onclick="resetPrivacyPolicyDefaultText()">
              <i class="fa-solid fa-rotate-right ms-1"></i>
              استرجاع النص الافتراضي
            </button>
            <button type="button" class="btn btn-primary" id="taldoPrivacyPolicySaveBtn" onclick="savePrivacyPolicyText()">
              <i class="fa-solid fa-floppy-disk ms-1"></i>
              حفظ سياسة الخصوصية والنشر
            </button>
          </div>
        </div>`;

      if (aboutCard && aboutCard.parentElement === tab) {
        aboutCard.insertAdjacentElement('afterend', wrapper);
      } else {
        tab.appendChild(wrapper);
      }
      card = wrapper;
      rebuildPolicyBuilder(raw);
      return;
    }

    const hidden = document.getElementById(ADMIN_TEXTAREA_ID);
    if (hidden && !document.activeElement?.closest?.('#' + ADMIN_CARD_ID)) {
      const raw = getPolicyRawValue();
      if (raw && String(hidden.value || '').trim() !== String(raw || '').trim()) {
        hidden.value = raw;
        rebuildPolicyBuilder(raw);
      }
    }
  }

  function setButtonLoading(button, loading, text) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.classList.add('taldo-privacy-btn-loading');
      button.innerHTML = `<span class="spinner-border spinner-border-sm ms-1"></span>${escapeHtml(text || 'جاري الحفظ...')}`;
    } else {
      button.disabled = false;
      button.classList.remove('taldo-privacy-btn-loading');
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  window.addPrivacyPolicySectionRow = function (section) {
    addPolicySectionRow(section || { title: '', body: '' }, true);
  };

  window.removePrivacyPolicySectionRow = function (key) {
    const row = document.querySelector(`.taldo-privacy-policy-section-admin-item[data-row-key="${safeCssEscape(String(key || ''))}"]`);
    if (!row) return;
    const rows = document.querySelectorAll('.taldo-privacy-policy-section-admin-item');
    if (rows.length <= 1) {
      if (typeof showToast === 'function') showToast('يجب إبقاء قسم واحد على الأقل.');
      return;
    }
    row.remove();
    renumberPolicyRows();
  };

  window.resetPrivacyPolicyDefaultText = function () {
    const value = stringifyPolicySections(DEFAULT_SECTIONS);
    setPolicyValueEverywhere(value);
    rebuildPolicyBuilder(value);
    if (typeof showToast === 'function') showToast('تم استرجاع النص الافتراضي، اضغط حفظ لتثبيت التعديل.');
  };

  window.savePrivacyPolicyText = function () {
    const sections = getAdminPolicySectionsFromRows();
    if (!sections.length) {
      if (typeof showToast === 'function') showToast('يرجى إضافة عنوان أو نص واحد على الأقل.');
      return;
    }

    if (typeof apiRequest !== 'function') {
      if (typeof showToast === 'function') showToast('تعذر الوصول إلى دالة الحفظ.');
      return;
    }

    const value = stringifyPolicySections(sections);
    const button = document.getElementById('taldoPrivacyPolicySaveBtn');
    setPolicyValueEverywhere(value);
    setButtonLoading(button, true, 'جاري حفظ السياسة...');

    apiRequest('updateSettingValue', {
      key: SETTING_KEY,
      value: value,
      description: 'نص سياسة الخصوصية والنشر الذي يظهر عند فتح الموقع'
    })
      .then(res => {
        if (!res || res.success === false) {
          throw new Error(res?.message || 'تعذر حفظ سياسة الخصوصية والنشر.');
        }
        setPolicyValueEverywhere(value);
        rebuildPolicyBuilder(value);
        const content = document.getElementById('taldoPrivacyConsentPolicyContent');
        if (content) content.innerHTML = renderPolicyAccordionHtml(parsePolicySections(value), 'taldoPrivacyConsentPolicyAccordion');
        if (typeof showToast === 'function') showToast(res.message || 'تم حفظ سياسة الخصوصية والنشر.');
      })
      .catch(error => {
        if (typeof showToast === 'function') showToast(error.message || 'تعذر حفظ سياسة الخصوصية والنشر.');
      })
      .finally(() => setButtonLoading(button, false));
  };

  function wrapRenderSettingsTab() {
    const current = window.renderSettingsTab;
    if (typeof current !== 'function' || current.__taldoPrivacyPolicyWrapped) return;

    const wrapped = function () {
      const result = current.apply(this, arguments);
      setTimeout(ensureAdminPolicyCard, 0);
      setTimeout(ensureAdminPolicyCard, 250);
      return result;
    };

    wrapped.__taldoPrivacyPolicyWrapped = true;
    wrapped.__previousRenderSettingsTab = current;
    window.renderSettingsTab = wrapped;
    try { renderSettingsTab = window.renderSettingsTab; } catch (error) {}
  }

  function bootPrivacyPolicyConsent() {
    wrapIntroModalFlow();
    wrapRenderSettingsTab();
    ensureAdminPolicyCard();
  }

  window.taldoShowPrivacyPolicyConsentModal = showConsentModal;
  window.taldoRenderPrivacyPolicyAccordionHtml = renderPolicyAccordionHtml;
  window.taldoParsePrivacyPolicySections = parsePolicySections;

  bootPrivacyPolicyConsent();
  setTimeout(bootPrivacyPolicyConsent, 300);
  setTimeout(bootPrivacyPolicyConsent, 1200);
  setTimeout(maybeShowConsentAsFallback, 1800);

  document.addEventListener('DOMContentLoaded', function () {
    bootPrivacyPolicyConsent();
    setTimeout(bootPrivacyPolicyConsent, 400);
    setTimeout(maybeShowConsentAsFallback, 2200);
  });
})();
