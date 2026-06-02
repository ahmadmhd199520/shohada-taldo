  function startSiteSound() {
    const audio = document.getElementById('siteSound');
    if (!audio) return;

    audio.play().catch(function (error) {
      console.log('لم يتم تشغيل الصوت:', error);
    });

    document.removeEventListener('click', startSiteSound);
    document.removeEventListener('touchstart', startSiteSound);
    document.removeEventListener('keydown', startSiteSound);
  }

  document.addEventListener('click', startSiteSound);
  document.addEventListener('touchstart', startSiteSound);
  document.addEventListener('keydown', startSiteSound);
