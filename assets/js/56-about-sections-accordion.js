(function () {
  const ABOUT_SETTING_KEY = 'about_us_text';
  const ABOUT_FORMAT = 'about_sections_v1';
  const ABOUT_HERO_IMAGE = './assets/site-preview.png';
  const ABOUT_LOGO_IMAGE = './assets/favicon-512.png';

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

  function getDefaultSections() {
    return [
      {
        title: 'هدف المشروع',
        body: 'أرشيف شهداء تلدو هو مشروع توثيقي إنساني يهدف إلى حفظ أسماء شهداء مدينة تلدو وجمع ما يتيسر من بياناتهم وصورهم ومعلوماتهم في أرشيف رقمي منظم.'
      },
      {
        title: 'آلية التوثيق',
        body: 'يعتمد المشروع على جمع البيانات المتاحة، ثم مراجعتها وتنظيمها وتحديثها تدريجيًا، مع استقبال الإضافات والتصحيحات من الأهالي والمهتمين بالتوثيق.'
      },
      {
        title: 'كيف يمكن المساهمة',
        body: 'يمكنكم المساهمة بإرسال معلومة ناقصة، أو تصحيح خطأ، أو تزويدنا بصورة أو تفاصيل إضافية تساعد في استكمال بيانات الشهداء.'
      },
      {
        title: 'تنبيه حول الصور والبيانات',
        body: 'الصور والبيانات المنشورة في هذا الأرشيف مخصصة لغرض التوثيق الإنساني وحفظ الذاكرة، ونرجو التعامل معها باحترام ومسؤولية.'
      }
    ];
  }

  function cleanSection(section) {
    section = section || {};
    return {
      title: String(section.title || '').trim(),
      body: String(section.body || '').trim()
    };
  }

  function normalizeSections(sections) {
    return (Array.isArray(sections) ? sections : [])
      .map(cleanSection)
      .filter(section => section.title || section.body)
      .map(section => ({
        title: section.title || 'قسم بدون عنوان',
        body: section.body || ''
      }));
  }

  function parseAboutSections(rawValue) {
    const raw = String(rawValue || '').trim();

    if (!raw) return getDefaultSections();

    try {
      const parsed = JSON.parse(raw);

      if (parsed && parsed.type === ABOUT_FORMAT) {
        const sections = normalizeSections(parsed.sections);
        return sections.length ? sections : getDefaultSections();
      }

      if (Array.isArray(parsed)) {
        const sections = normalizeSections(parsed);
        return sections.length ? sections : getDefaultSections();
      }
    } catch (error) {}

    return [{
      title: 'من نحن',
      body: raw
    }];
  }

  function stringifyAboutSections(sections) {
    return JSON.stringify({
      type: ABOUT_FORMAT,
      sections: normalizeSections(sections)
    });
  }

  function ensureAboutContainer() {
    const current = document.getElementById('aboutUsText');
    if (!current) return null;

    if (current.tagName && current.tagName.toLowerCase() === 'p') {
      const div = document.createElement('div');
      div.id = current.id;
      div.className = (current.className || '') + ' taldo-about-sections-content';
      current.replaceWith(div);
      return div;
    }

    current.classList.add('taldo-about-sections-content');
    return current;
  }

  function renderAboutSectionsPublic() {
    const container = ensureAboutContainer();
    if (!container) return;

    const sections = parseAboutSections(window.publicSettings && publicSettings.about_us_text);

    container.innerHTML = `
      <div class="taldo-about-hero">
        <img src="${escapeAttr(ABOUT_HERO_IMAGE)}" alt="" aria-hidden="true">
        <div class="taldo-about-hero-content">
          <img class="taldo-about-hero-logo" src="${escapeAttr(ABOUT_LOGO_IMAGE)}" alt="أرشيف شهداء تلدو">
          <h5 class="taldo-about-hero-title">أرشيف شهداء تلدو</h5>
          <p class="taldo-about-hero-subtitle">منصة توثيقية إنسانية لحفظ الذاكرة</p>
        </div>
      </div>

      <div class="accordion taldo-about-accordion" id="taldoAboutAccordion">
        ${sections.map((section, index) => {
          const collapseId = 'taldoAboutSection_' + index;
          const show = index === 0 ? 'show' : '';
          const collapsed = index === 0 ? '' : 'collapsed';
          return `
            <div class="accordion-item">
              <h2 class="accordion-header" id="${collapseId}_heading">
                <button class="accordion-button ${collapsed}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="${collapseId}">
                  <i class="fa-solid fa-circle-info"></i>
                  <span>${escapeHtml(section.title)}</span>
                </button>
              </h2>
              <div id="${collapseId}" class="accordion-collapse collapse ${show}" aria-labelledby="${collapseId}_heading" data-bs-parent="#taldoAboutAccordion">
                <div class="accordion-body">${escapeHtml(section.body)}</div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function readSectionsFromBuilder() {
    const rows = Array.from(document.querySelectorAll('.taldo-about-section-admin-item'));
    return normalizeSections(rows.map(row => ({
      title: row.querySelector('.taldo-about-section-title')?.value || '',
      body: row.querySelector('.taldo-about-section-body')?.value || ''
    })));
  }

  function renumberAboutRows() {
    const rows = Array.from(document.querySelectorAll('.taldo-about-section-admin-item'));
    rows.forEach((row, index) => {
      const num = row.querySelector('.taldo-about-section-number');
      if (num) num.textContent = String(index + 1);

      const removeBtn = row.querySelector('.taldo-about-remove-section-btn');
      if (removeBtn) removeBtn.classList.toggle('d-none', rows.length <= 1);
    });
  }

  function addAboutSectionRow(section) {
    const container = document.getElementById('aboutSectionsBuilder');
    if (!container) return;

    section = cleanSection(section);
    const key = 'about_row_' + Date.now() + '_' + Math.random().toString(16).slice(2);

    const wrap = document.createElement('div');
    wrap.className = 'taldo-about-section-admin-item';
    wrap.dataset.rowKey = key;
    wrap.innerHTML = `
      <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="taldo-about-section-number">1</span>
          <strong>قسم من نحن</strong>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger taldo-about-remove-section-btn" onclick="removeAboutSectionRow('${escapeAttr(key)}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>

      <div class="row g-3">
        <div class="col-12">
          <label class="form-label fw-bold">عنوان القسم</label>
          <input type="text" class="form-control taldo-about-section-title" value="${escapeAttr(section.title)}" placeholder="مثال: هدف المشروع">
        </div>
        <div class="col-12">
          <label class="form-label fw-bold">النص</label>
          <textarea class="form-control taldo-about-section-body" rows="4" placeholder="اكتب نص هذا القسم هنا...">${escapeHtml(section.body)}</textarea>
        </div>
      </div>`;

    container.appendChild(wrap);
    renumberAboutRows();
  }

  function removeAboutSectionRow(key) {
    const rows = Array.from(document.querySelectorAll('.taldo-about-section-admin-item'));
    if (rows.length <= 1) return;

    const target = rows.find(row => row.dataset.rowKey === key);
    if (target) target.remove();
    renumberAboutRows();
  }

  window.addAboutSectionRow = addAboutSectionRow;
  window.removeAboutSectionRow = removeAboutSectionRow;

  function enhanceAboutAdminCard() {
    const textarea = document.getElementById('aboutUsAdminText');
    if (!textarea) return;

    const card = textarea.closest('.settings-card') || textarea.parentElement;
    if (!card) return;
    if (card.dataset.aboutSectionsEnhanced === '1') return;

    const sections = parseAboutSections(window.publicSettings && publicSettings.about_us_text);
    const hiddenValue = String((window.publicSettings && publicSettings.about_us_text) || '');

    card.dataset.aboutSectionsEnhanced = '1';
    card.innerHTML = `
      <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-primary ms-1"></i> قسم من نحن</h5>

      <div class="taldo-about-sections-help mb-3">
        أضف الأقسام التي تريد ظهورها في نافذة <strong>من نحن</strong>. كل قسم يحتوي على عنوان ونص، وسيظهر للزائر بشكل أكورديون منسق.
      </div>

      <input type="hidden" id="aboutUsAdminText" value="${escapeAttr(hiddenValue)}">

      <div id="aboutSectionsBuilder" class="taldo-about-sections-admin"></div>

      <div class="d-flex gap-2 flex-wrap mt-3">
        <button type="button" class="btn btn-outline-primary" onclick="addAboutSectionRow({ title: '', body: '' })">
          <i class="fa-solid fa-plus ms-1"></i>
          إضافة عنوان ونص جديد
        </button>
        <button type="button" class="btn btn-primary" onclick="saveAboutUsText()">
          <i class="fa-solid fa-floppy-disk ms-1"></i>
          حفظ قسم من نحن
        </button>
      </div>`;

    const builder = document.getElementById('aboutSectionsBuilder');
    if (builder) {
      builder.innerHTML = '';
      sections.forEach(section => addAboutSectionRow(section));
      if (!sections.length) addAboutSectionRow({ title: '', body: '' });
    }
  }

  const previousOpenAboutUsModal = window.openAboutUsModal;
  window.openAboutUsModal = function () {
    renderAboutSectionsPublic();

    if (window.modals && modals.aboutUsModal) {
      modals.aboutUsModal.show();
      return;
    }

    if (typeof previousOpenAboutUsModal === 'function') {
      return previousOpenAboutUsModal.apply(this, arguments);
    }
  };

  const previousRenderSettingsTab = window.renderSettingsTab;
  window.renderSettingsTab = function () {
    if (typeof previousRenderSettingsTab === 'function') {
      previousRenderSettingsTab.apply(this, arguments);
    }

    setTimeout(enhanceAboutAdminCard, 0);
  };

  window.saveAboutUsText = function () {
    const sections = readSectionsFromBuilder();

    if (!sections.length) {
      showToast('يرجى إضافة عنوان أو نص واحد على الأقل في قسم من نحن.');
      return;
    }

    const value = stringifyAboutSections(sections);
    const hidden = document.getElementById('aboutUsAdminText');
    if (hidden) hidden.value = value;

    apiRequest('updateSettingValue', {
      key: ABOUT_SETTING_KEY,
      value: value,
      description: 'أقسام تظهر عند الضغط على زر من نحن'
    })
      .then(res => {
        if (!res || !res.success) {
          showToast(res?.message || 'تعذر حفظ قسم من نحن.');
          return;
        }

        publicSettings.about_us_text = value;
        showToast(res.message || 'تم حفظ قسم من نحن.');
        renderAboutSectionsPublic();
        loadInitialData();
      })
      .catch(err => {
        showToast(err.message || 'تعذر حفظ قسم من نحن.');
      });
  };

  function bootAboutSections() {
    try { enhanceAboutAdminCard(); } catch (error) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(bootAboutSections, 800);
    setTimeout(bootAboutSections, 1800);
  });
})();
