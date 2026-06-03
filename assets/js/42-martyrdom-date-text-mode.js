(function() {
  'use strict';

  function isMartyrdomDateInput(input) {
    if (!input || input.tagName?.toLowerCase() !== 'input') return false;

    const id = String(input.id || '').toLowerCase();
    const name = String(input.name || '').toLowerCase();
    const placeholder = String(input.placeholder || '').toLowerCase();

    return (
      name === 'martyrdom_date' ||
      id === 'martyrdomdate' ||
      id === 'editmartyrdomdate' ||
      (id.includes('martyrdom') && id.includes('date')) ||
      (name.includes('martyrdom') && name.includes('date')) ||
      placeholder.includes('تاريخ الاستشهاد')
    );
  }

  function convertMartyrdomDateInputsToText() {
    document.querySelectorAll('input').forEach(function(input) {
      if (!isMartyrdomDateInput(input)) return;

      if (input.dataset.taldoDateTextMode === '1') return;

      input.dataset.taldoDateTextMode = '1';

      /*
        نحوله إلى نص عادي بدل التقويم.
      */
      input.type = 'text';

      /*
        لوحة أرقام على الجوال قدر الإمكان.
      */
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('dir', 'ltr');

      input.placeholder = input.placeholder || 'مثال: 25-05-2012 أو 2012';

      /*
        لا نجعل النمط إجباريًا حتى لا نمنع الحالات غير الدقيقة.
      */
      input.removeAttribute('min');
      input.removeAttribute('max');

      const parent = input.closest('.mb-3, .col-md-6, .col-12, .form-group');

      if (parent && !parent.querySelector('.martyrdom-date-help')) {
        const help = document.createElement('div');
        help.className = 'form-text martyrdom-date-help';
        help.textContent = 'اكتب التاريخ نصًا، مثل: 25-05-2012 أو 2012 إذا لم يُعرف اليوم والشهر.';
        input.insertAdjacentElement('afterend', help);
      }
    });
  }

  /*
    تشغيل مباشر.
  */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', convertMartyrdomDateInputsToText);
  } else {
    convertMartyrdomDateInputsToText();
  }

  /*
    لأن بعض المودالات تُفتح أو تُرسم بعد تحميل الصفحة.
  */
  setTimeout(convertMartyrdomDateInputsToText, 400);
  setTimeout(convertMartyrdomDateInputsToText, 1200);

  /*
    عند فتح أي مودال، نعيد تطبيق التحويل.
  */
  document.addEventListener('shown.bs.modal', function() {
    setTimeout(convertMartyrdomDateInputsToText, 80);
  }, true);

  /*
    مراقبة أي حقول تُضاف لاحقًا.
  */
  const observer = new MutationObserver(function() {
    convertMartyrdomDateInputsToText();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
