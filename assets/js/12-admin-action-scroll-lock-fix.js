(function() {
  if (window.__taldoAdminActionScrollLockInstalled) return;
  window.__taldoAdminActionScrollLockInstalled = true;

  const nativeScrollTo = window.__taldoNativeScrollTo || window.scrollTo.bind(window);
  window.__taldoNativeScrollTo = nativeScrollTo;

  function getScrollPos() {
    return {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    };
  }

  function parseTop(args) {
    if (!args || !args.length) return null;
    const first = args[0];
    if (first && typeof first === 'object') {
      return Number(first.top ?? first.y ?? 0);
    }
    if (args.length > 1) return Number(args[1] || 0);
    return null;
  }

  function parseLeft(args) {
    if (!args || !args.length) return null;
    const first = args[0];
    if (first && typeof first === 'object') {
      return Number(first.left ?? first.x ?? 0);
    }
    return Number(args[0] || 0);
  }

  if (!window.__taldoScrollToGuardPatched) {
    window.__taldoScrollToGuardPatched = true;

    window.scrollTo = function() {
      const state = window.__taldoAdminScrollGuard;
      const top = parseTop(arguments);

      if (state && Date.now() < state.until && state.y > 40 && Number.isFinite(top) && top <= 2) {
        const left = parseLeft(arguments);
        nativeScrollTo(Number.isFinite(left) ? left : state.x, state.y);
        return;
      }

      return nativeScrollTo.apply(window, arguments);
    };
  }

  function restoreScroll(state) {
    if (!state) return;
    nativeScrollTo(state.x, state.y);
  }

  function extendGuard(state, ms) {
    if (!state) return;
    state.until = Math.max(state.until || 0, Date.now() + (ms || 900));
  }

  function startGuard(ms) {
    const existing = window.__taldoAdminScrollGuard;
    const pos = existing && Date.now() < existing.until ? existing : getScrollPos();

    // لا حاجة لقفل السكرول عندما تكون الصفحة أصلًا في الأعلى.
    // هذا يمنع المشكلة التي كانت تحدث عند فتح لوحة التحكم:
    // يبدأ تحميل البيانات، فيلتقط القفل y=0 ثم يعيد الصفحة للأعلى مع كل محاولة سكرول.
    if (!pos || (Number(pos.y) || 0) <= 40) {
      window.__taldoAdminScrollGuard = null;
      window.__taldoKeepScroll = false;
      return { state: null, finish: function() {} };
    }

    const state = {
      x: pos.x,
      y: pos.y,
      until: Date.now() + (ms || 3200),
      userCanceled: false
    };

    window.__taldoAdminScrollGuard = state;
    window.__taldoKeepScroll = true;

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body ? document.body.style : null;
    const oldHtmlScrollBehavior = htmlStyle.scrollBehavior;
    const oldBodyScrollBehavior = bodyStyle ? bodyStyle.scrollBehavior : '';

    htmlStyle.scrollBehavior = 'auto';
    if (bodyStyle) bodyStyle.scrollBehavior = 'auto';

    const restoreSchedule = [0, 40, 120, 260, 520, 900, 1400, 2200, 3200];
    restoreSchedule.forEach(delay => {
      setTimeout(() => {
        if (window.__taldoAdminScrollGuard === state && !state.userCanceled && Date.now() < state.until + 100) {
          restoreScroll(state);
        }
      }, delay);
    });

    const interval = setInterval(() => {
      if (window.__taldoAdminScrollGuard !== state || state.userCanceled || Date.now() > state.until) {
        clearInterval(interval);
        return;
      }
      restoreScroll(state);
    }, 180);

    const finish = function(extraMs) {
      if (!state || state.userCanceled) return;
      extendGuard(state, extraMs || 900);
      restoreScroll(state);

      setTimeout(() => {
        if (window.__taldoAdminScrollGuard === state && Date.now() >= state.until) {
          window.__taldoAdminScrollGuard = null;
          window.__taldoKeepScroll = false;
          htmlStyle.scrollBehavior = oldHtmlScrollBehavior;
          if (bodyStyle) bodyStyle.scrollBehavior = oldBodyScrollBehavior;
        }
      }, (extraMs || 900) + 80);
    };

    return { state, finish };
  }

  window.__taldoRunAdminActionWithoutScrollJump = function(work, holdMs) {
    const guard = startGuard(holdMs || 3600);

    try {
      const result = typeof work === 'function' ? work() : undefined;

      if (result && typeof result.finally === 'function') {
        return result.finally(() => guard.finish(1200));
      }

      guard.finish(2200);
      return result;
    } catch (error) {
      guard.finish(1200);
      throw error;
    }
  };


  function unwrapDashboardRefreshIfNeeded() {
    const fn = window.refreshDashboardData;
    if (typeof fn === 'function' && fn.__taldoNoScrollRefreshWrapped && typeof fn.__taldoOriginal === 'function') {
      window.refreshDashboardData = fn.__taldoOriginal;
      try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
    }
  }

  unwrapDashboardRefreshIfNeeded();
  document.addEventListener('DOMContentLoaded', unwrapDashboardRefreshIfNeeded);
  setTimeout(unwrapDashboardRefreshIfNeeded, 0);
  setTimeout(unwrapDashboardRefreshIfNeeded, 150);

  function cancelGuardBecauseUserScrolled() {
    const state = window.__taldoAdminScrollGuard;
    if (!state || Date.now() > state.until) return;

    state.userCanceled = true;
    state.until = 0;
    window.__taldoAdminScrollGuard = null;
    window.__taldoKeepScroll = false;
  }

  ['wheel', 'touchmove'].forEach(eventName => {
    window.addEventListener(eventName, cancelGuardBecauseUserScrolled, {
      passive: true,
      capture: true
    });
  });

  window.addEventListener('keydown', function(event) {
    const scrollKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'];
    if (scrollKeys.includes(event.key)) {
      cancelGuardBecauseUserScrolled();
    }
  }, true);

  function wrapFunction(name, holdMs) {
    const original = window[name];
    if (typeof original !== 'function' || original.__taldoNoScrollWrapped) return;

    const wrapped = function() {
      const args = arguments;
      const self = this;
      return window.__taldoRunAdminActionWithoutScrollJump(function() {
        return original.apply(self, args);
      }, holdMs || 4200);
    };

    wrapped.__taldoNoScrollWrapped = true;
    wrapped.__taldoOriginal = original;
    window[name] = wrapped;

    try {
      if (name in window) {
        eval(name + ' = window["' + name + '"];');
      }
    } catch (e) {}
  }

  [
    'quickUpdateStatus',
    'verifyWithCompletionQuick',
    'updateStatusFromDetails',
    'verifyWithCompletionFromDetails',
    'approveDataUpdateFromDashboard',
    'approveDataUpdateWithMode',
    'rejectDataUpdateFromDashboard',
    'updateDataRequestStatusFromDashboard',
    'updateJoinRequestStatusFromDashboard',
    'saveCompletionSwitches'
  ].forEach(name => wrapFunction(name, 4800));

  const originalRefreshDashboardData = window.refreshDashboardData;
  if (typeof originalRefreshDashboardData === 'function' && !originalRefreshDashboardData.__taldoNoScrollRefreshWrapped) {
    const wrappedRefresh = function() {
      const args = arguments;
      const self = this;
      const active = document.getElementById('dashboardPage')?.classList.contains('active');
      if (!active) return originalRefreshDashboardData.apply(self, args);

      return window.__taldoRunAdminActionWithoutScrollJump(function() {
        return originalRefreshDashboardData.apply(self, args);
      }, 5200);
    };
    wrappedRefresh.__taldoNoScrollRefreshWrapped = true;
    wrappedRefresh.__taldoOriginal = originalRefreshDashboardData;
    window.refreshDashboardData = wrappedRefresh;
    try { refreshDashboardData = window.refreshDashboardData; } catch (e) {}
  }

  const originalRenderDashboardTable = window.renderDashboardTable;
  if (typeof originalRenderDashboardTable === 'function' && !originalRenderDashboardTable.__taldoActionButtonTypeWrapped) {
    window.renderDashboardTable = function() {
      const result = originalRenderDashboardTable.apply(this, arguments);
      document.querySelectorAll('#dashboardPage button:not([type])').forEach(btn => {
        btn.setAttribute('type', 'button');
      });
      return result;
    };
    window.renderDashboardTable.__taldoActionButtonTypeWrapped = true;
    try { renderDashboardTable = window.renderDashboardTable; } catch (e) {}
  }

  document.addEventListener('click', function(event) {
    const btn = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!btn || !document.getElementById('dashboardPage')?.contains(btn)) return;

    const action = btn.getAttribute('onclick') || '';
    if (/quickUpdateStatus|verifyWithCompletion|approveDataUpdate|rejectDataUpdate|updateDataRequestStatus|updateJoinRequestStatus/.test(action)) {
      startGuard(2600);
    }
  }, true);
})();
