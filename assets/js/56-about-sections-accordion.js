(function () {
  const ABOUT_SETTING_KEY = 'about_us_text';
  const ABOUT_FORMAT = 'about_sections_v1';
  const ABOUT_LOGO_IMAGE = './assets/favicon-512.png';

  let aboutRenderTimer = null;
  let isRenderingAbout = false;

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

  function getDefaultSections() {
    return [
      {
        title: 'من نحن',
        body: 'أرشيف شهداء تلدو هو مشروع توثيقي إنساني يهدف إلى حفظ أسماء شهداء مدينة تلدو وجمع ما يتيسر من بياناتهم وصورهم ومعلوماتهم في أرشيف رقمي منظم.'
      },
      {
        title: 'آلية التوثيق',
        body: 'يعتمد المشروع على جمع البيانات المتاحة، ثم مراجعتها وتنظيمها وتحديثها تدريجيًا، مع استقبال الإضافات والتصحيحات من الأهالي والمهتمين بالتوثيق.'
      },
      {
        title: 'كيف يمكن المساهمة',
        body: 'يمكنكم المساهمة بإرسال معلومة ناقصة، أو تصحيح خطأ، أو تزويدنا بصورة أو تفاصيل إضافية تساعد في استكمال بيانات الشهداء.'
      }
    ];
  }

  function cleanSection(section) {
    section = section || {};
    return {
      title: String(section.title || section.heading || '').trim(),
      body: String(section.body || section.text || section.content || '').trim()
    };
  }

  function normalizeSections(sections) {
    const normalized = (Array.isArray(sections) ? sections : [])
      .map(cleanSection)
      .filter(section => section.title || section.body)
      .map(section => ({
        title: section.title || 'قسم بدون عنوان',
        body: section.body || ''
      }));

    // لو حُفظ كل المحتوى داخل قسم واحد بالغلط، نحاول تقسيم النص الداخلي.
    if (normalized.length === 1) {
      const inner = parseSectionsFromTextPatterns(normalized[0].body);
      if (inner.length > 1) return inner;

      const fromJson = parseJsonSectionsLoose(normalized[0].body);
      if (fromJson.length > 1) return fromJson;
    }

    return normalized;
  }

  function extractSectionsFromParsed(parsed) {
    if (!parsed) return [];

    if (typeof parsed === 'string') {
      return parseAboutSections(parsed, true);
    }

    if (Array.isArray(parsed)) {
      return normalizeSections(parsed);
    }

    if (parsed.type === ABOUT_FORMAT && Array.isArray(parsed.sections)) {
      return normalizeSections(parsed.sections);
    }

    if (Array.isArray(parsed.sections)) {
      return normalizeSections(parsed.sections);
    }

    if (parsed.title || parsed.body || parsed.text || parsed.content) {
      return normalizeSections([parsed]);
    }

    return [];
  }

  function tryJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function parseJsonSectionsLoose(rawValue) {
    let raw = decodeHtmlEntities(String(rawValue || '').trim());
    if (!raw) return [];

    // أحيانًا تكون القيمة محفوظة بين علامتي اقتباس كـ JSON داخل JSON.
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

    // إذا كان النص عبارة عن أجزاء كائنات بلا أقواس مصفوفة: {..},{..}
    if (/\{\s*["']title["']\s*:/.test(raw) && !raw.startsWith('[')) {
      const wrapped = '[' + raw.replace(/^,|,$/g, '') + ']';
      const sections = extractSectionsFromParsed(tryJsonParse(wrapped));
      if (sections.length) return sections;
    }

    // إذا كان هناك مصفوفة داخل نص أكبر، نستخرجها.
    const firstBracket = raw.indexOf('[');
    const lastBracket = raw.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = raw.slice(firstBracket, lastBracket + 1);
      const sections = extractSectionsFromParsed(tryJsonParse(candidate));
      if (sections.length) return sections;
    }

    return [];
  }

  function parseSectionsFromTextPatterns(rawValue) {
    const raw = String(rawValue || '').replace(/\r/g, '').trim();
    if (!raw) return [];

    // الصيغة التي أعطيناها سابقًا: العنوان: ... النص: ...
    const labelRegex = /(?:^|\n)\s*العنوان\s*:\s*([\s\S]*?)\n\s*النص\s*:\s*([\s\S]*?)(?=\n\s*العنوان\s*:|$)/g;
    const labeled = [];
    let match;
    while ((match = labelRegex.exec(raw)) !== null) {
      labeled.push({
        title: String(match[1] || '').trim(),
        body: String(match[2] || '').trim()
      });
    }
    if (labeled.length > 1) return normalizeSections(labeled);

    // تقسيم احتياطي عند وجود عناوين معروفة كسطور مستقلة.
    const knownTitles = [
      'من نحن',
      'هدف المشروع',
      'آلية التوثيق',
      'من يراجع البيانات',
      'كيف يمكن المساهمة',
      'فريق العمل',
      'تنبيه حول الصور والبيانات',
      'ملاحظات مهمة',
      'شكر وتقدير'
    ];

    const lines = raw.split('\n').map(line => line.trim());
    const sections = [];
    let current = null;

    lines.forEach(line => {
      if (!line) {
        if (current) current.bodyLines.push('');
        return;
      }

      const normalizedLine = line.replace(/^#+\s*/, '').replace(/[:：]$/, '').trim();
      if (knownTitles.includes(normalizedLine)) {
        if (current) sections.push({ title: current.title, body: current.bodyLines.join('\n').trim() });
        current = { title: normalizedLine, bodyLines: [] };
      } else if (current) {
        current.bodyLines.push(line);
      }
    });

    if (current) sections.push({ title: current.title, body: current.bodyLines.join('\n').trim() });
    return sections.length > 1 ? normalizeSections(sections) : [];
  }

  function parseAboutSections(rawValue, nested) {
    const raw = String(rawValue || '').trim();
    if (!raw) return nested ? [] : getDefaultSections();

    const jsonSections = parseJsonSectionsLoose(raw);
    if (jsonSections.length) return jsonSections;

    const textSections = parseSectionsFromTextPatterns(raw);
    if (textSections.length) return textSections;

    return nested ? [] : [{ title: 'من نحن', body: raw }];
  }

  function stringifyAboutSections(sections) {
    return JSON.stringify({
      type: ABOUT_FORMAT,
      sections: normalizeSections(sections)
    });
  }

  function getAboutRawValue() {
    if (typeof window.__taldoAboutRawValue === 'string' && window.__taldoAboutRawValue.trim()) {
      return window.__taldoAboutRawValue;
    }

    if (window.publicSettings && typeof window.publicSettings.about_us_text === 'string' && window.publicSettings.about_us_text.trim()) {
      return window.publicSettings.about_us_text;
    }

    try {
      if (typeof publicSettings !== 'undefined' && publicSettings && typeof publicSettings.about_us_text === 'string' && publicSettings.about_us_text.trim()) {
        return publicSettings.about_us_text;
      }
    } catch (error) {}

    const hidden = document.getElementById('aboutUsAdminText');
    if (hidden && String(hidden.value || '').trim()) return hidden.value;

    const current = document.getElementById('aboutUsText');
    if (current) {
      const text = String(current.textContent || '').trim();
      if (text && !current.querySelector('.taldo-about-accordion')) return text;
    }

    return '';
  }

  function ensureAboutContainer() {
    const current = document.getElementById('aboutUsText');
    if (!current) return null;

    if (current.tagName && current.tagName.toLowerCase() === 'p') {
      const div = document.createElement('div');
      div.id = current.id;
      div.className = ((current.className || '') + ' taldo-about-sections-content').trim();
      current.replaceWith(div);
      return div;
    }

    current.classList.add('taldo-about-sections-content');
    current.style.whiteSpace = 'normal';
    return current;
  }

  function renderAboutSectionsPublic() {
    if (isRenderingAbout) return;
    isRenderingAbout = true;

    try {
      const container = ensureAboutContainer();
      if (!container) return;

      const rawValue = getAboutRawValue();
      const sections = parseAboutSections(rawValue);

      // نحفظ الخام للمرات القادمة كي لا نقرأ النص بعد تحويله إلى أكورديون.
      if (rawValue) window.__taldoAboutRawValue = rawValue;

      container.innerHTML = `
        <div class="taldo-about-hero">
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
                  <div class="accordion-body">${escapeHtml(section.body).replace(/\n/g, '<br>')}</div>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    } finally {
      isRenderingAbout = false;
    }
  }

  function renderAboutSectionsSoon() {
    clearTimeout(aboutRenderTimer);
    renderAboutSectionsPublic();
    aboutRenderTimer = setTimeout(renderAboutSectionsPublic, 60);
    setTimeout(renderAboutSectionsPublic, 180);
    setTimeout(renderAboutSectionsPublic, 420);
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

    const raw = String(textarea.value || getAboutRawValue() || '');
    if (raw) window.__taldoAboutRawValue = raw;
    const sections = parseAboutSections(raw);

    card.dataset.aboutSectionsEnhanced = '1';
    card.innerHTML = `
      <h5 class="fw-bold mb-3"><i class="fa-solid fa-circle-info text-primary ms-1"></i> قسم من نحن</h5>

      <div class="taldo-about-sections-help mb-3">
        أضف الأقسام التي تريد ظهورها في نافذة <strong>من نحن</strong>. كل قسم يحتوي على عنوان ونص، وسيظهر للزائر بشكل أكورديون منسق.
      </div>

      <input type="hidden" id="aboutUsAdminText" value="${escapeAttr(raw)}">
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

  function patchOpenAboutUsModal() {
    const current = window.openAboutUsModal;
    if (typeof current !== 'function') return;
    if (current.__aboutSectionsWrapped === true) return;

    const wrapped = function () {
      const result = current.apply(this, arguments);

      const el = document.getElementById('aboutUsText');
      if (el) {
        const raw = String(el.textContent || '').trim();
        if (raw) window.__taldoAboutRawValue = raw;
      }

      renderAboutSectionsSoon();
      return result;
    };

    wrapped.__aboutSectionsWrapped = true;
    wrapped.__previousOpenAboutUsModal = current;
    window.openAboutUsModal = wrapped;
  }

  const previousRenderSettingsTab = window.renderSettingsTab;
  window.renderSettingsTab = function () {
    if (typeof previousRenderSettingsTab === 'function') {
      previousRenderSettingsTab.apply(this, arguments);
    }

    setTimeout(enhanceAboutAdminCard, 0);
    setTimeout(enhanceAboutAdminCard, 300);
  };

  window.saveAboutUsText = function () {
    const sections = readSectionsFromBuilder();

    if (!sections.length) {
      showToast('يرجى إضافة عنوان أو نص واحد على الأقل في قسم من نحن.');
      return;
    }

    const value = stringifyAboutSections(sections);
    window.__taldoAboutRawValue = value;

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

        if (!window.publicSettings) window.publicSettings = {};
        window.publicSettings.about_us_text = value;
        try {
          if (typeof publicSettings !== 'undefined' && publicSettings) publicSettings.about_us_text = value;
        } catch (error) {}

        showToast(res.message || 'تم حفظ قسم من نحن.');
        renderAboutSectionsPublic();
      })
      .catch(err => {
        showToast(err.message || 'تعذر حفظ قسم من نحن.');
      });
  };

  function installAboutMutationGuard() {
    const el = document.getElementById('aboutUsText');
    if (!el || el.dataset.aboutMutationGuard === '1') return;
    el.dataset.aboutMutationGuard = '1';

    const observer = new MutationObserver(() => {
      if (isRenderingAbout) return;
      const text = String(el.textContent || '').trim();
      const hasAccordion = !!el.querySelector('.taldo-about-accordion');
      const looksRaw = text.includes('"title"') || text.includes('العنوان:') || text.includes('about_sections_v1');
      if (!hasAccordion && (looksRaw || text.length > 0)) {
        window.__taldoAboutRawValue = text;
        setTimeout(renderAboutSectionsPublic, 40);
      }
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
  }

  function bootAboutSections() {
    try { patchOpenAboutUsModal(); } catch (error) {}
    try { enhanceAboutAdminCard(); } catch (error) {}
    try { installAboutMutationGuard(); } catch (error) {}

    const aboutModal = document.getElementById('aboutUsModal');
    if (aboutModal && aboutModal.dataset.aboutSectionsListener !== '1') {
      aboutModal.dataset.aboutSectionsListener = '1';
      aboutModal.addEventListener('show.bs.modal', renderAboutSectionsSoon);
      aboutModal.addEventListener('shown.bs.modal', renderAboutSectionsSoon);
    }
  }

  window.taldoRenderAboutSectionsPublic = renderAboutSectionsPublic;
  window.taldoParseAboutSections = parseAboutSections;

  document.addEventListener('DOMContentLoaded', () => {
    bootAboutSections();
    setTimeout(bootAboutSections, 500);
    setTimeout(bootAboutSections, 1500);
    setTimeout(bootAboutSections, 3000);
  });

  bootAboutSections();
  setTimeout(bootAboutSections, 500);
  setTimeout(bootAboutSections, 1500);
  setTimeout(bootAboutSections, 3000);
})();
