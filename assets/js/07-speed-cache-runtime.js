(function() {
  'use strict';

  const CACHE_PREFIX = 'taldo_api_cache_v5:';
  const CACHE_MAX_STALE = 7 * 24 * 60 * 60 * 1000;
  const PUBLIC_ACTION_TTL = {
    getInitialData: 10 * 60 * 1000,
    getMartyrsPublicData: 5 * 60 * 1000,
    getMartyrShareData: 30 * 60 * 1000
  };
  const MUTATING_ACTIONS = new Set([
    'submitMartyr',
    'updateVerificationStatus',
    'submitDataUpdate',
    'approveDataUpdate',
    'rejectDataUpdate',
    'updateDataRequestStatus',
    'submitJoinRequest',
    'updateJoinRequestStatus',
    'saveSiteMessage',
    'updateSiteMessageStatus',
    'updateSettingValue',
    'updateMartyrFields',
    'setMartyrCompletionOptions',
    'verifyMartyrWithCompletion',
    'submitMessageReply',
    'deleteMartyrImage',
    'updateMartyrImagePosition',
    'setHoulaMassacreStatus'
  ]);

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }

  function cacheKey(action, data) {
    return CACHE_PREFIX + action + ':' + stableStringify(data || {});
  }

  function readCache(action, data) {
    try {
      const raw = localStorage.getItem(cacheKey(action, data));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.savedAt || !parsed.value) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeCache(action, data, value) {
    if (!PUBLIC_ACTION_TTL[action] || !value || value.success === false) return;
    try {
      localStorage.setItem(cacheKey(action, data), JSON.stringify({
        savedAt: Date.now(),
        value
      }));
    } catch (error) {
      // عند امتلاء التخزين المحلي نحذف كاش المشروع فقط ثم نحاول مرة واحدة.
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(key);
        });
        localStorage.setItem(cacheKey(action, data), JSON.stringify({
          savedAt: Date.now(),
          value
        }));
      } catch (ignored) {}
    }
  }

  function clearPublicClientCache() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.indexOf(CACHE_PREFIX) === 0) localStorage.removeItem(key);
      });
    } catch (error) {}
  }
  window.clearTaldoPublicClientCache = clearPublicClientCache;

window.forceTaldoPublicFreshData = function() {
  clearPublicClientCache();
  window.__taldoBypassPublicCacheUntil = Date.now() + 90 * 1000;
};

  function dispatchCacheUpdate(action, data, value) {
    try {
      window.dispatchEvent(new CustomEvent('taldo:api-cache-updated', {
        detail: { action, data, value }
      }));
    } catch (error) {}
  }

  const networkApiRequest = window.apiRequest;
  if (typeof networkApiRequest === 'function' && !window.__taldoCachedApiInstalled) {
    window.__taldoCachedApiInstalled = true;

    window.apiRequest = function(action, data = {}, options = {}) {
      const ttl = PUBLIC_ACTION_TTL[action] || 0;
      const forceNetwork =
  options &&
  (
    options.forceNetwork ||
    options.forceFresh ||
    options.useClientCache === false
  );
      const now = Date.now();
      const mustBypassPublicEdge = ttl && window.__taldoBypassPublicCacheUntil && now < window.__taldoBypassPublicCacheUntil;
      const requestData = (forceNetwork || mustBypassPublicEdge)
        ? Object.assign({}, data || {}, { __cacheBust: String(window.__taldoBypassPublicCacheUntil || now) })
        : data;
      const cached = ttl && !forceNetwork && !mustBypassPublicEdge ? readCache(action, data) : null;

      if (cached) {
        const age = now - cached.savedAt;
        const isFresh = age < ttl;
        const isUsableStale = age < CACHE_MAX_STALE;

        if (isFresh) {
          return Promise.resolve(Object.assign({}, cached.value, {
            __fromClientCache: true,
            __cacheAge: age
          }));
        }

        if (isUsableStale) {
          networkApiRequest(action, requestData)
            .then(result => {
              writeCache(action, data, result);
              dispatchCacheUpdate(action, data, result);
            })
            .catch(() => {});
          return Promise.resolve(Object.assign({}, cached.value, {
            __fromClientCache: true,
            __stale: true,
            __cacheAge: age
          }));
        }
      }

      return networkApiRequest(action, requestData).then(result => {
        writeCache(action, data, result);
        if (MUTATING_ACTIONS.has(action) && result && result.success !== false) {
          clearPublicClientCache();
          window.__taldoBypassPublicCacheUntil = Date.now() + 90 * 1000;
        }
        return result;
      });
    };

    try {
      apiRequest = window.apiRequest;
    } catch (error) {}
  }

  function normalizeFast(value) {
    if (typeof normalizeText === 'function') return normalizeText(value || '');
    return String(value || '').toLowerCase().trim();
  }

  function prepareMartyrRecord(item) {
    if (!item || item.__perfPrepared) return item;
    const searchable = [
      item.full_name,
      item.family_name,
      item.father_name,
      item.nickname,
      item.martyrdom_place,
      item.martyrdom_date,
      item.martyrdom_type,
      item.extra_info
    ].join(' ');
    item.__searchText = normalizeFast(searchable);
    item.__familyKey = item.family_name || '';
    item.__createdSort = String(item.created_at || item.updated_at || '');
    item.__perfPrepared = true;
    return item;
  }

  function prepareInitialData(res) {
    if (!res || !res.success) return res;
    (res.martyrs || []).forEach(prepareMartyrRecord);
    return res;
  }

  function applyInitialData(res) {
    if (!res || !res.success) {
      showToast('تعذر تحميل البيانات.');
      return false;
    }

    prepareInitialData(res);

    allFamilies = res.families || [];
    statsData = res.stats || {};
    allMartyrs = res.martyrs || [];
    if (typeof siteMessages !== 'undefined') siteMessages = res.messages || [];
    if (typeof publicSettings !== 'undefined') publicSettings = res.settings || {};

    fillFamiliesSelects();
    updateStatsCards();
    renderMartyrs();

    const martyrFromUrl = typeof getMartyrIdFromUrl === 'function' ? getMartyrIdFromUrl() : '';
    if (martyrFromUrl) {
      setTimeout(() => openMartyrDetails(martyrFromUrl, 'homePage', true), 120);
    } else if (typeof applyRouteFromLocation === 'function') {
      setTimeout(() => applyRouteFromLocation(), 120);
    }

    if (!window.__taldoIntroChecked && typeof maybeShowIntroModal === 'function') {
      window.__taldoIntroChecked = true;
      setTimeout(() => maybeShowIntroModal(), 250);
    }

    return true;
  }

if (typeof window.loadInitialData === 'function') {
  window.loadInitialData = function() {
    window.__taldoInitialDataLoading = true;

    const loadingBox = document.getElementById('loadingBox');
    const container = document.getElementById('martyrsContainer');

    if (loadingBox) loadingBox.style.display = 'block';
    if (container) container.innerHTML = '';

    return apiRequest('getInitialData')
.then(res => {
  const ok = applyInitialData(res);
  window.__taldoInitialDataLoading = false;
  if (loadingBox) loadingBox.style.display = 'none';
  
          const container = document.getElementById('martyrsContainer');
          if (container && res && res.__fromClientCache) {
            let note = document.getElementById('perfCacheNote');
            if (!note) {
              note = document.createElement('div');
              note.id = 'perfCacheNote';
              note.className = 'perf-cache-note';
              container.parentNode.insertBefore(note, container);
            }
            note.textContent = res.__stale
              ? 'تم عرض نسخة محفوظة سريعًا، وسيتم تحديثها تلقائيًا عند توفر بيانات أحدث.'
              : 'تم تحميل البيانات بسرعة من الكاش.';
            setTimeout(() => { if (note) note.remove(); }, 3500);
          }

          return ok;
        })
.catch(err => {
  window.__taldoInitialDataLoading = false;
  if (loadingBox) loadingBox.style.display = 'none';
  showToast(err.message || 'حدث خطأ أثناء تحميل البيانات.');
  return false;
});
  };

    try {
      loadInitialData = window.loadInitialData;
    } catch (error) {}
  }

  window.addEventListener('taldo:api-cache-updated', event => {
    const detail = event.detail || {};
    if (detail.action === 'getInitialData' && detail.value && detail.value.success) {
      applyInitialData(detail.value);
    }
  });

  function getResponsiveDriveImage(item, size) {
    if (!item) return '';
    const fileId = item.image_file_id || (typeof extractDriveFileId === 'function' ? extractDriveFileId(item.image_url) : '');
    if (fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size || 900}`;
    return item.image_url || '';
  }

  if (typeof window.getImageSrc === 'function') {
    window.getImageSrc = function(item, size) {
      return getResponsiveDriveImage(item, size || 900);
    };
    try {
      getImageSrc = window.getImageSrc;
    } catch (error) {}
  }

  function getCardImageSrc(item) {
    return getResponsiveDriveImage(item, window.innerWidth <= 576 ? 320 : 420);
  }

  function getPageSize() {
    if (window.innerWidth <= 576) return 24;
    if (window.innerWidth <= 992) return 36;
    return 42;
  }

  function sortListFast(list, sortBy) {
    list.sort((a, b) => {
      if (sortBy === 'family') return String(a.family_name || '').localeCompare(String(b.family_name || ''), 'ar');
      if (sortBy === 'newest') return String(b.__createdSort || '').localeCompare(String(a.__createdSort || ''));
      if (sortBy === 'oldest') return String(a.__createdSort || '').localeCompare(String(b.__createdSort || ''));
      return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
    });
  }

  function completionFilterMatches(item, completion) {
    if (!completion) return true;
    const needs = typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : String(item.needs_completion || '').trim() === 'نعم';
    return completion === 'needs' ? needs : !needs;
  }


  function renderMartyrsPaginationPerf(totalPages, totalItems, pageSize) {
    if (totalPages <= 1) return '';

    const pages = [];
    const start = Math.max(1, currentMartyrsPage - 2);
    const end = Math.min(totalPages, currentMartyrsPage + 2);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) pages.push(i);

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    const buttons = pages.map(page => {
      if (page === '...') return `<span class="px-2 text-muted">...</span>`;
      const active = page === currentMartyrsPage ? 'btn-primary' : 'btn-outline-primary';
      return `<button class="btn ${active} page-btn" onclick="goToMartyrsPage(${page})">${page}</button>`;
    }).join('');

    const from = Math.min(totalItems, (currentMartyrsPage - 1) * pageSize + 1);
    const to = Math.min(totalItems, currentMartyrsPage * pageSize);

    return `
      <div class="martyrs-pagination">
        <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage - 1})" ${currentMartyrsPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        ${buttons}
        <button class="btn btn-outline-primary page-btn" onclick="goToMartyrsPage(${currentMartyrsPage + 1})" ${currentMartyrsPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="w-100 text-center text-muted small mt-1">
          عرض ${from} - ${to} من ${totalItems}
        </div>
      </div>`;
  }

  if (typeof window.renderMartyrs === 'function') {
    window.renderMartyrs = function(customList) {
const container = document.getElementById('martyrsContainer');
if (!container) return;

if (window.__taldoInitialDataLoading && !customList && (!Array.isArray(allMartyrs) || !allMartyrs.length)) {
  container.innerHTML = '';
  return;
}

const search = normalizeFast(document.getElementById('searchInput')?.value || '');
      const family = document.getElementById('familyFilter')?.value || '';
      const sortBy = document.getElementById('sortSelect')?.value || 'name';
      const completion = document.getElementById('completionFilter')?.value || '';
      const pageSize = getPageSize();

      let list = customList ? customList.slice() : allMartyrs.slice();
      list.forEach(prepareMartyrRecord);

      if (currentStatusFilter) {
        list = list.filter(item => item.verification_status === currentStatusFilter);
      }

      if (family) {
        list = list.filter(item => item.__familyKey === family);
      }

      if (completion) {
        list = list.filter(item => completionFilterMatches(item, completion));
      }

      if (search) {
        list = list.filter(item => item.__searchText && item.__searchText.includes(search));
      }

      sortListFast(list, sortBy);

      if (!list.length) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fa-regular fa-folder-open fa-2x mb-3 text-primary"></i>
            <h5 class="fw-bold">لا توجد نتائج</h5>
            <p class="mb-0">جرّب تغيير البحث أو الفلاتر.</p>
          </div>`;
        return;
      }

      const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
      if (currentMartyrsPage > totalPages) currentMartyrsPage = totalPages;
      if (currentMartyrsPage < 1) currentMartyrsPage = 1;

      const start = (currentMartyrsPage - 1) * pageSize;
      const pageList = list.slice(start, start + pageSize);

      const contentHtml = viewMode === 'cards'
        ? `<div class="martyrs-grid">${pageList.map((item, index) => renderMartyrCard(item, index)).join('')}</div>`
        : `<div>${pageList.map(renderMartyrListItem).join('')}</div>`;

      container.innerHTML = contentHtml + renderMartyrsPagination(totalPages, list.length);
    };

    try {
      renderMartyrs = window.renderMartyrs;
    } catch (error) {}
  }


  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function getPrimaryPositionTargetPerf(item) {
    if (!item) return {};
    const images = typeof window.normalizeImages === 'function' ? window.normalizeImages(item) : [];
    const primary = images.find(img => String(img.is_primary || '').trim() === 'نعم');
    const byFile = images.find(img => img.image_file_id && img.image_file_id === item.image_file_id);
    return primary || byFile || images[0] || item || {};
  }

  function getImageStylePerf(target, mode) {
    const prefix = mode === 'card' ? 'card' : 'detail';
    const x = clampNumber(target?.[prefix + '_position_x'] || target?.position_x || target?.image_position_x || 50, 50, 0, 100);
    const y = clampNumber(target?.[prefix + '_position_y'] || target?.position_y || target?.image_position_y || 50, 50, 0, 100);
    const zoom = clampNumber(target?.[prefix + '_zoom'] || target?.image_zoom || 1, 1, 1, 3);
    return `object-position:${x}% ${y}%;transform:scale(${zoom});transform-origin:${x}% ${y}%;`;
  }

  if (typeof window.renderMartyrCard === 'function') {
    window.renderMartyrCard = function(item, index) {
      const verified = item.verification_status === 'موثق';
      const pending = item.verification_status === 'بانتظار التوثيق';
      const needsCompletion = typeof isNeedsCompletion === 'function' ? isNeedsCompletion(item) : false;
      const img = getCardImageSrc(item);
      const clickAction = pending && !isAdminLoggedIn
        ? 'showPendingInfo()'
        : `openMartyrDetails('${escapeAttr(item.martyr_id)}', 'homePage')`;
      const targetImage = getPrimaryPositionTargetPerf(item);
      const positionStyle = getImageStylePerf(targetImage, 'card');

      const priorityAttrs = Number(index || 0) < 4
        ? 'loading="eager" fetchpriority="high"'
        : 'loading="lazy" fetchpriority="low"';

      return `
        <div class="martyr-card ${pending ? 'pending-card' : ''}" onclick="${clickAction}">
          ${pending ? `<div class="pending-corner">قيد التدقيق</div>` : needsCompletion ? `
            <div class="needs-completion-corner">يحتاج استكمال</div>
          ` : verified ? `<div class="verified-corner"><i class="fa-solid fa-check"></i></div>` : ''}
          <div class="martyr-image-wrap">
            ${img ? `
              <img src="${escapeAttr(img)}" class="martyr-image" style="${positionStyle}" alt="" width="420" height="315" decoding="async" ${priorityAttrs} onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
              <div class="martyr-placeholder" style="display:none;"><i class="fa-solid fa-user"></i></div>
            ` : `<div class="martyr-placeholder"><i class="fa-solid fa-user"></i></div>`}
          </div>
          <div class="martyr-body">
            <h6 class="martyr-name">${escapeHtml(item.full_name || '')}</h6>
            <div class="martyr-family">عائلة ${escapeHtml(item.family_name || '')}</div>
            ${pending ? `<span class="badge text-bg-secondary mt-2">قيد التدقيق</span>` : needsCompletion ? `
              <span class="badge text-bg-warning mt-2">يحتاج استكمال</span>
            ` : verified ? `<span class="badge badge-soft-blue mt-2">موثق</span>` : ''}
          </div>
        </div>`;
    };

    try {
      renderMartyrCard = window.renderMartyrCard;
    } catch (error) {}
  }

  if (typeof window.renderMartyrListItem === 'function') {
    const originalListItem = window.renderMartyrListItem;
    window.renderMartyrListItem = function(item) {
      prepareMartyrRecord(item);
      return originalListItem(item);
    };
    try {
      renderMartyrListItem = window.renderMartyrListItem;
    } catch (error) {}
  }

  function scheduleMartyrsRender() {
    clearTimeout(window.__taldoRenderTimer);
    window.__taldoRenderTimer = setTimeout(() => {
      currentMartyrsPage = 1;
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => renderMartyrs(), { timeout: 250 });
      } else {
        requestAnimationFrame(() => renderMartyrs());
      }
    }, 120);
  }

  window.scheduleMartyrsRender = scheduleMartyrsRender;

  document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('searchInput');
    const mobileSearch = document.getElementById('mobileSearchInput');
    const family = document.getElementById('familyFilter');
    const completion = document.getElementById('completionFilter');

    if (search) search.oninput = scheduleMartyrsRender;
    if (family) family.onchange = scheduleMartyrsRender;
    if (completion) completion.onchange = scheduleMartyrsRender;

    if (mobileSearch) {
      mobileSearch.oninput = function() {
        const target = document.getElementById('searchInput');
        if (target) target.value = mobileSearch.value || '';
        scheduleMartyrsRender();
      };
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (document.getElementById('homePage')?.classList.contains('active')) {
        renderMartyrs();
      }
    }, 180);
  }, { passive: true });

  window.TaldoPerformanceTools = {
    clearPublicClientCache,
    getPageSize
  };
})();
