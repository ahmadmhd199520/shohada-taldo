(function () {
  'use strict';

  const BUTTON_ID = 'taldoPrivacyPolicyFooterBtn';
  const MODAL_ID = 'taldoPrivacyPolicyFooterModal';
  const CONTENT_ID = 'taldoPrivacyPolicyFooterContent';
  const SETTING_KEY = 'privacy_publish_policy_text';
  const FORMAT = 'privacy_policy_sections_v1';

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

  function stringifyDefaultPolicy() {
    return JSON.stringify({ type: FORMAT, sections: DEFAULT_SECTIONS });
  }

  function extractSectionsFromParsed(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return normalizeSections(parsed);
    if (parsed.type === FORMAT && Array.isArray(parsed.sections)) return normalizeSections(parsed.sections);
    if (Array.isArray(parsed.sections)) return normalizeSections(parsed.sections);
    if (parsed.title || parsed.body || parsed.text || parsed.content) return normalizeSections([parsed]);
    if (typeof parsed === 'string') return parsePolicySectionsFallback(parsed, true);
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

  function parsePolicySectionsFallback(rawValue, nested) {
    const raw = String(rawValue || '').trim();
    if (!raw) return nested ? [] : DEFAULT_SECTIONS.slice();

    const jsonSections = parseJsonSectionsLoose(raw);
    if (jsonSections.length) return jsonSections;

    const textSections = parseTextSections(raw);
    if (textSections.length) return textSections;

    return nested ? [] : [{ title: 'سياسة الخصوصية والنشر', body: raw }];
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

  function getCurrentPolicyRawValue() {
    const settings = getSettingsObject();
    const adminTextarea = document.getElementById('taldoPrivacyPolicyAdminText');
    const candidates = [
      window.__taldoPrivacyPolicyRawValue,
      settings[SETTING_KEY],
      settings.privacy_policy_text,
      settings.privacy_text,
      adminTextarea ? adminTextarea.value : ''
    ].map(value => String(value || '').trim()).filter(Boolean);

    return candidates[0] || stringifyDefaultPolicy();
  }

  function getCurrentPolicySections() {
    const raw = getCurrentPolicyRawValue();
    if (typeof window.taldoParsePrivacyPolicySections === 'function') {
      try {
        const sections = window.taldoParsePrivacyPolicySections(raw);
        if (Array.isArray(sections) && sections.length) return sections;
      } catch (error) {}
    }
    return parsePolicySectionsFallback(raw);
  }

  function renderAccordionHtml(sections) {
    if (typeof window.taldoRenderPrivacyPolicyAccordionHtml === 'function') {
      try {
        return window.taldoRenderPrivacyPolicyAccordionHtml(sections, 'taldoPrivacyPolicyFooterAccordion');
      } catch (error) {}
    }

    const list = normalizeSections(sections);
    return `
      <div class="accordion taldo-privacy-policy-accordion" id="taldoPrivacyPolicyFooterAccordion">
        ${list.map((section, index) => {
          const headingId = 'taldoPrivacyPolicyFooterAccordion_heading_' + index;
          const collapseId = 'taldoPrivacyPolicyFooterAccordion_collapse_' + index;
          const isOpen = index === 0;
          return `
            <div class="accordion-item">
              <h2 class="accordion-header" id="${escapeAttr(headingId)}">
                <button class="accordion-button ${isOpen ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${escapeAttr(collapseId)}" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${escapeAttr(collapseId)}">
                  <i class="fa-solid fa-shield-heart ms-1"></i>
                  ${escapeHtml(section.title || 'قسم')}
                </button>
              </h2>
              <div id="${escapeAttr(collapseId)}" class="accordion-collapse collapse ${isOpen ? 'show' : ''}" aria-labelledby="${escapeAttr(headingId)}" data-bs-parent="#taldoPrivacyPolicyFooterAccordion">
                <div class="accordion-body">${formatMultiline(section.body || '')}</div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function ensureManualPrivacyModal() {
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
                  <div class="taldo-privacy-policy-scroll" id="${CONTENT_ID}"></div>
                  <div class="taldo-privacy-consent-footer taldo-privacy-footer-modal-actions">
                    <button type="button" class="taldo-privacy-consent-agree-btn" id="taldoPrivacyPolicyFooterCloseBtn">
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

      const closeBtn = document.getElementById('taldoPrivacyPolicyFooterCloseBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          try {
            if (window.bootstrap && bootstrap.Modal) {
              bootstrap.Modal.getOrCreateInstance(modal).hide();
            }
          } catch (error) {}
        });
      }
    }

    const content = document.getElementById(CONTENT_ID);
    if (content) {
      content.innerHTML = renderAccordionHtml(getCurrentPolicySections());
    }

    return modal;
  }

  function openManualPrivacyModal() {
    const modal = ensureManualPrivacyModal();
    if (!modal) return;

    if (window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modal, {
        backdrop: 'static',
        keyboard: false,
        focus: true
      }).show();
    }
  }

  function ensureFooterButton() {
    if (document.getElementById(BUTTON_ID)) return true;

    const footer = document.querySelector('.site-footer');
    if (!footer) return false;

    const aboutBtn = Array.from(footer.querySelectorAll('button, a')).find(el => {
      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      return text.includes('من نحن');
    });

    const button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'btn btn-outline-light taldo-privacy-policy-footer-btn';
    button.innerHTML = '<i class="fa-solid fa-shield-halved ms-1"></i> سياسة الخصوصية';
    button.addEventListener('click', openManualPrivacyModal);

    if (aboutBtn && aboutBtn.parentElement) {
      aboutBtn.insertAdjacentElement('beforebegin', button);
    } else {
      footer.appendChild(button);
    }

    return true;
  }

  function boot() {
    ensureFooterButton();
  }

  window.openPrivacyPolicyFooterModal = openManualPrivacyModal;
  window.taldoOpenPrivacyPolicyModalFromFooter = openManualPrivacyModal;

  boot();
  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1000);
})();
