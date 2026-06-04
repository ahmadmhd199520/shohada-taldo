(function () {
  const WATERMARK_ID = 'taldoVisualWatermark';
  const WATERMARK_TEXT = 'أرشيف شهداء تلدو';

  function ensureWatermarkStyles() {
    if (document.getElementById('taldoVisualWatermarkStyles')) return;

    const style = document.createElement('style');
    style.id = 'taldoVisualWatermarkStyles';
    style.textContent = `
      #${WATERMARK_ID} {
        position: fixed;
        inset: -12vh -12vw;
        z-index: 2147482000;
        pointer-events: none;
        user-select: none;
        display: grid;
        grid-template-columns: repeat(4, minmax(180px, 1fr));
        gap: 70px 90px;
        align-content: center;
        justify-content: center;
        opacity: 1;
        transform: rotate(-24deg);
        overflow: hidden;
      }

      #${WATERMARK_ID} .taldo-watermark-item {
        font-family: "Tajawal", Arial, sans-serif;
        font-weight: 800;
        font-size: clamp(18px, 2vw, 28px);
        color: rgba(5, 66, 57, 0.12);
        white-space: nowrap;
        text-align: center;
        letter-spacing: 0.5px;
      }

      body.dark-mode #${WATERMARK_ID} .taldo-watermark-item,
      body[data-theme="dark"] #${WATERMARK_ID} .taldo-watermark-item {
        color: rgba(255, 255, 255, 0.10);
      }

      @media (max-width: 768px) {
        #${WATERMARK_ID} {
          grid-template-columns: repeat(3, minmax(150px, 1fr));
          gap: 58px 65px;
          inset: -10vh -18vw;
        }

        #${WATERMARK_ID} .taldo-watermark-item {
          font-size: 18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createWatermark() {
    if (document.getElementById(WATERMARK_ID)) return;

    ensureWatermarkStyles();

    const layer = document.createElement('div');
    layer.id = WATERMARK_ID;
    layer.setAttribute('aria-hidden', 'true');

    const itemsCount = 42;

    for (let i = 0; i < itemsCount; i++) {
      const item = document.createElement('div');
      item.className = 'taldo-watermark-item';
      item.textContent = WATERMARK_TEXT;
      layer.appendChild(item);
    }

    document.body.appendChild(layer);
  }

  function bootWatermark() {
    if (!document.body) return;
    createWatermark();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWatermark);
  } else {
    bootWatermark();
  }
})();
