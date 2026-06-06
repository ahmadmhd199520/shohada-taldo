(function() {
  'use strict';

  const VERIFIED_STATUS = 'موثق';
  const PENDING_STATUS = 'بانتظار التوثيق';
  const REJECTED_STATUS = 'مرفوض';

  let duplicateRowsLoaded = false;
  let duplicateRowsLoading = false;
  let duplicateRowsPromise = null;
  let selectedDuplicateItem = null;
  let bypassPossibleDuplicateOnce = false;
  let pendingSubmitAfterWarning = null;

  function safeText(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[\u200f\u200e]/g, '')
      .replace(/[،,؛;:.!؟?()\[\]{}"'`´“”‘’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeNameToken(value) {
    return normalizeName(value).replace(/^ال/, '');
  }

  function nameTokens(value) {
    return normalizeName(value)
      .split(' ')
      .map(normalizeNameToken)
      .filter(Boolean);
  }

  function tokenMatches(queryToken, candidateTokens) {
    if (!queryToken) return false;
    return candidateTokens.some(function(token) {
      return token === queryToken || token.includes(queryToken) || queryToken.includes(token);
    });
  }

  function rowStatus(row) {
    return String(
      row?.verification_status ||
      row?.verificationStatus ||
      row?.status ||
      ''
    ).trim();
  }

  function rowKey(row) {
    return String(
      row?.martyr_id ||
      row?.id ||
      row?.row_id ||
      row?.full_name ||
      ''
    ).trim();
  }

  function normalizeRows(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.martyrs)) return res.martyrs;
    if (Array.isArray(res?.all)) return res.all;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.rows)) return res.rows;
    return [];
  }

  function localDuplicateSources() {
    const rows = [];

    try {
      if (Array.isArray(allMartyrs)) rows.push.apply(rows, allMartyrs);
    } catch (e) {}

    try {
      if (Array.isArray(dashboardData)) rows.push.apply(rows, dashboardData);
    } catch (e) {}

    try {
      if (Array.isArray(window.__taldoDuplicateNameRows)) rows.push.apply(rows, window.__taldoDuplicateNameRows);
    } catch (e) {}

    const map = new Map();

    rows.forEach(function(row, index) {
      if (!row || !String(row.full_name || '').trim()) return;

      const key = rowKey(row) || `${normalizeName(row.full_name)}__${index}`;
      if (!map.has(key)) {
        map.set(key, row);
        return;
      }

      // نحتفظ بالنسخة التي تحتوي حالة أوضح إذا وُجدت.
      const old = map.get(key);
      if (!rowStatus(old) && rowStatus(row)) map.set(key, row);
    });

    return Array.from(map.values());
  }

  function mergeDuplicateRows(rows) {
    rows = normalizeRows(rows).filter(function(row) {
      return row && String(row.full_name || '').trim();
    });

    if (!rows.length) return;

    if (!Array.isArray(window.__taldoDuplicateNameRows)) {
      window.__taldoDuplicateNameRows = [];
    }

    const map = new Map();

    window.__taldoDuplicateNameRows.forEach(function(row, index) {
      map.set(rowKey(row) || `${normalizeName(row.full_name)}__old_${index}`, row);
    });

    rows.forEach(function(row, index) {
      const key = rowKey(row) || `${normalizeName(row.full_name)}__new_${index}`;
      if (map.has(key)) {
        Object.assign(map.get(key), row);
      } else {
        map.set(key, row);
      }
    });

    window.__taldoDuplicateNameRows = Array.from(map.values());
  }

  function loadDuplicateRows() {
    if (duplicateRowsLoaded) return Promise.resolve(localDuplicateSources());
    if (duplicateRowsLoading && duplicateRowsPromise) return duplicateRowsPromise;

    duplicateRowsLoading = true;

    const requests = [];

    if (typeof apiRequest === 'function') {
      // هذه الطلبات لا تغيّر عرض الصفحة الرئيسية؛ تُستخدم فقط لفحص التكرار.
      [VERIFIED_STATUS, PENDING_STATUS, REJECTED_STATUS].forEach(function(status) {
        requests.push(
          apiRequest('getMartyrsPublicData', { statusFilter: status })
            .then(function(res) { mergeDuplicateRows(res); })
            .catch(function() {})
        );
      });

      // عند الأدمن نستفيد من لوحة التحكم لأنها تحتوي عادةً على كل الحالات.
      try {
        if (isAdminLoggedIn) {
          requests.push(
            apiRequest('getAdminDashboardData', { reason: 'duplicateNameGuard' })
              .then(function(res) { mergeDuplicateRows(res); })
              .catch(function() {})
          );
        }
      } catch (e) {}
    }

    duplicateRowsPromise = Promise.allSettled(requests)
      .then(function() {
        duplicateRowsLoaded = true;
        return localDuplicateSources();
      })
      .finally(function() {
        duplicateRowsLoading = false;
      });

    return duplicateRowsPromise;
  }

  function getMatchScore(query, row) {
    const fullName = row?.full_name || '';
    const qNorm = normalizeName(query);
    const nNorm = normalizeName(fullName);

    if (!qNorm || !nNorm) return 0;
    if (qNorm === nNorm) return 100;

    const qTokens = nameTokens(query);
    const nTokens = nameTokens(fullName);

    if (!qTokens.length || !nTokens.length) return 0;

    const matchedCount = qTokens.filter(function(token) {
      return tokenMatches(token, nTokens);
    }).length;

    const allQueryTokensMatched = matchedCount === qTokens.length;

    if (allQueryTokensMatched) {
      const missingFromQuery = Math.max(0, nTokens.length - qTokens.length);
      return Math.max(72, 94 - missingFromQuery * 6);
    }

    const ratio = matchedCount / qTokens.length;
    if (ratio >= 0.67 && matchedCount >= 2) return Math.round(65 + ratio * 10);
    if (ratio >= 0.5 && matchedCount >= 2) return 62;

    return 0;
  }

  function getNameMatches(query) {
    const q = String(query || '').trim();
    if (!q) return [];

    return localDuplicateSources()
      .map(function(row) {
        return {
          row,
          score: getMatchScore(q, row)
        };
      })
      .filter(function(item) {
        return item.score >= 62;
      })
      .sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.row.full_name || '').localeCompare(String(b.row.full_name || ''), 'ar');
      });
  }

  function findExactDuplicate(query) {
    const qNorm = normalizeName(query);
    if (!qNorm) return null;

    return localDuplicateSources().find(function(row) {
      return normalizeName(row.full_name || '') === qNorm;
    }) || null;
  }

  function getStatusMessage(row) {
    const status = rowStatus(row);

    if (status === VERIFIED_STATUS) {
      return 'هذا الاسم موجود سابقًا، يمكنكم الوصول إليه عن طريق البحث، وهو اسم موثق.';
    }

    if (status === PENDING_STATUS || status === 'قيد التدقيق') {
      return 'تم إرسال هذا الاسم سابقًا، وهو الآن قيد التدقيق. سيكون بالإمكان الدخول للصفحة الخاصة بالشهيد بعد توثيق بياناته.';
    }

    if (status === REJECTED_STATUS || status === 'rejected') {
      return 'تم رفع الاسم مسبقًا، نرجو منكم عدم رفع الاسم مجددًا.';
    }

    return 'تم رفع هذا الاسم سابقًا، نرجو التأكد قبل رفعه مرة أخرى.';
  }

  function getStatusBadgeClass(row) {
    const status = rowStatus(row);
    if (status === VERIFIED_STATUS) return 'text-bg-success';
    if (status === PENDING_STATUS || status === 'قيد التدقيق') return 'text-bg-warning';
    if (status === REJECTED_STATUS || status === 'rejected') return 'text-bg-danger';
    return 'text-bg-secondary';
  }
  
  function shouldShowStatusBadge(row) {
  const status = rowStatus(row);
  return !(status === REJECTED_STATUS || status === 'rejected');
}

  function getSubmitNameInput() {
    return document.querySelector('#martyrForm input[name="full_name"]');
  }

  function getSubmitModalElement() {
    return document.getElementById('submitModal');
  }

  function ensureDuplicateDropdown() {
    const input = getSubmitNameInput();
    if (!input) return null;

    const fieldBox = input.closest('.col-md-6') || input.parentElement;
    if (!fieldBox) return null;

    fieldBox.classList.add('position-relative');
    input.id = input.id || 'martyrNameDuplicateInput';
    input.setAttribute('autocomplete', 'off');

    let dropdown = document.getElementById('martyrNameDuplicateDropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.id = 'martyrNameDuplicateDropdown';
      dropdown.className = 'family-dropdown martyr-name-duplicate-dropdown d-none';
      input.insertAdjacentElement('afterend', dropdown);
    }

    let help = document.getElementById('martyrNameDuplicateHelp');
    if (!help) {
      help = document.createElement('div');
      help.id = 'martyrNameDuplicateHelp';
      help.className = 'form-text';
      help.textContent = 'اكتب الاسم وسيتم تنبيهك إذا كان مرفوعًا سابقًا لتفادي التكرار.';
      dropdown.insertAdjacentElement('afterend', help);
    }

    return dropdown;
  }

  function hideDuplicateDropdown() {
    const dropdown = document.getElementById('martyrNameDuplicateDropdown');
    if (dropdown) dropdown.classList.add('d-none');
  }

  function renderDuplicateDropdown(query) {
    const dropdown = ensureDuplicateDropdown();
    if (!dropdown) return;

    const typed = String(query || '').trim();
    selectedDuplicateItem = null;

    if (!typed) {
      dropdown.classList.add('d-none');
      dropdown.innerHTML = '';
      return;
    }

    const matches = getNameMatches(typed).slice(0, 8);

    if (!matches.length) {
      dropdown.classList.add('d-none');
      dropdown.innerHTML = '';
      return;
    }

    dropdown.classList.remove('d-none');
    dropdown.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'family-suggestion-title';
    title.textContent = 'أسماء مشابهة أو مرفوعة سابقًا';
    dropdown.appendChild(title);

    matches.forEach(function(match) {
      const row = match.row;
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'family-option martyr-name-duplicate-option';
      option.innerHTML = `
        <span class="martyr-name-duplicate-main">${safeText(row.full_name || '')}</span>
        ${shouldShowStatusBadge(row) ? `<span class="badge ${getStatusBadgeClass(row)} martyr-name-duplicate-status">${safeText(rowStatus(row) || 'مسجل')}</span>` : ''}
      `;
      option.addEventListener('click', function() {
        selectDuplicateName(row);
      });

      dropdown.appendChild(option);
    });
  }

  function showDuplicateStatusModal(row) {
    const modal = ensureDuplicateStatusModal();
    const msg = modal.querySelector('[data-duplicate-status-message]');
    const name = modal.querySelector('[data-duplicate-status-name]');

    if (name) name.textContent = row?.full_name || '';
    if (msg) msg.textContent = getStatusMessage(row);

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }

  function selectDuplicateName(row) {
    const input = getSubmitNameInput();
    if (!input || !row) return;

    selectedDuplicateItem = row;
    input.value = row.full_name || '';
    hideDuplicateDropdown();
    showDuplicateStatusModal(row);
  }

  function ensureDuplicateStatusModal() {
    let modal = document.getElementById('nameDuplicateStatusModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'nameDuplicateStatusModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body p-4 text-center">
            <div class="intro-icon bg-warning-subtle text-warning">
              <i class="fa-solid fa-circle-info"></i>
            </div>
            <h5 class="fw-bold mb-2" data-duplicate-status-name></h5>
            <p class="text-muted lh-lg mb-3" data-duplicate-status-message></p>
            <button type="button" class="btn btn-primary w-100" data-bs-dismiss="modal">موافق</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function ensurePossibleDuplicateModal() {
    let modal = document.getElementById('possibleDuplicateNameModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'possibleDuplicateNameModal';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-body p-4 text-center">
            <div class="intro-icon bg-warning-subtle text-warning">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h4 class="fw-bold mb-3">ربما كان هذا الاسم مرفوعًا سابقًا</h4>
            <div class="text-muted lh-lg mb-3">
              وجدنا أسماء قريبة من الاسم الذي أدخلته. يرجى التأكد قبل الإكمال لتفادي تكرار الأسماء.
            </div>
            <div class="possible-duplicate-list text-end mb-3" data-possible-duplicate-list></div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-secondary w-50" data-possible-duplicate-cancel>إلغاء</button>
              <button type="button" class="btn btn-primary w-50" data-possible-duplicate-continue>أعي ذلك، أريد الإكمال</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('[data-possible-duplicate-cancel]').addEventListener('click', function() {
      bootstrap.Modal.getOrCreateInstance(modal).hide();
      const submitModal = getSubmitModalElement();
      if (submitModal) bootstrap.Modal.getOrCreateInstance(submitModal).hide();
      pendingSubmitAfterWarning = null;
      bypassPossibleDuplicateOnce = false;
    });

    modal.querySelector('[data-possible-duplicate-continue]').addEventListener('click', function() {
      bootstrap.Modal.getOrCreateInstance(modal).hide();
      bypassPossibleDuplicateOnce = true;

      const submitFn = pendingSubmitAfterWarning;
      pendingSubmitAfterWarning = null;

      if (typeof submitFn === 'function') {
        setTimeout(function() {
          submitFn();
        }, 150);
      }
    });

    return modal;
  }

  function showPossibleDuplicateModal(matches, continueFn) {
    const modal = ensurePossibleDuplicateModal();
    const listBox = modal.querySelector('[data-possible-duplicate-list]');

    pendingSubmitAfterWarning = continueFn;

    if (listBox) {
      listBox.innerHTML = matches.slice(0, 5).map(function(match) {
        const row = match.row;
        return `
          <div class="possible-duplicate-item">
            <span class="fw-bold">${safeText(row.full_name || '')}</span>
            ${shouldShowStatusBadge(row) ? `<span class="badge ${getStatusBadgeClass(row)}">${safeText(rowStatus(row) || 'مسجل')}</span>` : ''}
          </div>
        `;
      }).join('');
    }

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }

  function installDuplicateInputEvents() {
    const input = getSubmitNameInput();
    if (!input || input.__taldoDuplicateNameGuardInstalled) return;

    ensureDuplicateDropdown();

    input.addEventListener('focus', function() {
      loadDuplicateRows().then(function() {
        renderDuplicateDropdown(input.value);
      });
    });

    input.addEventListener('input', function() {
      selectedDuplicateItem = null;
      loadDuplicateRows().then(function() {
        renderDuplicateDropdown(input.value);
      });
    });

    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('martyrNameDuplicateDropdown');
      if (!dropdown || !input) return;
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('d-none');
      }
    });

    input.__taldoDuplicateNameGuardInstalled = true;
  }

  async function runDuplicateCheckBeforeSubmit(continueFn) {
    const input = getSubmitNameInput();
    const name = String(input?.value || '').trim();

    if (!name) return true;

    await loadDuplicateRows();

    const exact = selectedDuplicateItem || findExactDuplicate(name);
    if (exact && normalizeName(exact.full_name || '') === normalizeName(name)) {
      showDuplicateStatusModal(exact);
      bypassPossibleDuplicateOnce = false;
      return false;
    }

    if (bypassPossibleDuplicateOnce) {
      bypassPossibleDuplicateOnce = false;
      return true;
    }

    const possible = getNameMatches(name).filter(function(match) {
      return match.score >= 72 && match.score < 100;
    });

    if (possible.length) {
      showPossibleDuplicateModal(possible, continueFn);
      return false;
    }

    return true;
  }

  function wrapSubmitFunction(fnName) {
    const oldFn = window[fnName] || (typeof globalThis[fnName] === 'function' ? globalThis[fnName] : null);
    if (typeof oldFn !== 'function' || oldFn.__taldoDuplicateNameGuardWrapped) return;

    const wrapped = function() {
      const args = arguments;
      const context = this;

      const continueFn = function() {
        return oldFn.apply(context, args);
      };

      return runDuplicateCheckBeforeSubmit(continueFn).then(function(canSubmit) {
        if (!canSubmit) return false;
        return oldFn.apply(context, args);
      });
    };

    wrapped.__taldoDuplicateNameGuardWrapped = true;
    window[fnName] = wrapped;

    try {
      globalThis[fnName] = wrapped;
    } catch (e) {}
  }

  function resetDuplicateGuardState() {
    selectedDuplicateItem = null;
    bypassPossibleDuplicateOnce = false;
    pendingSubmitAfterWarning = null;
    hideDuplicateDropdown();
  }

  function installFeature() {
    installDuplicateInputEvents();
    wrapSubmitFunction('submitMartyrForm');
    wrapSubmitFunction('submitMartyrFormAsVerified');
  }

  const oldContinueToSubmitModal =
    window.continueToSubmitModal ||
    (typeof continueToSubmitModal === 'function' ? continueToSubmitModal : null);

  if (typeof oldContinueToSubmitModal === 'function' && !oldContinueToSubmitModal.__taldoDuplicateNameGuardWrapped) {
    window.continueToSubmitModal = function() {
      resetDuplicateGuardState();
      const result = oldContinueToSubmitModal.apply(this, arguments);
      setTimeout(function() {
        installFeature();
        loadDuplicateRows();
      }, 400);
      return result;
    };

    window.continueToSubmitModal.__taldoDuplicateNameGuardWrapped = true;

    try {
      continueToSubmitModal = window.continueToSubmitModal;
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(installFeature, 0);
      setTimeout(installFeature, 800);
    });
  } else {
    setTimeout(installFeature, 0);
    setTimeout(installFeature, 800);
  }
})();
