/** Detecção de dispositivo touch (celular/tablet). Força com ?touch=1 ou ?touch=0 na URL. */
const params = new URLSearchParams(location.search);
const forced = params.get('touch');

export const isTouch =
  forced === '1' ||
  (forced !== '0' &&
    (matchMedia('(hover: none) and (pointer: coarse)').matches ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)));

if (isTouch) document.documentElement.classList.add('touch');

/** Tela cheia + paisagem (Chrome Android). Silencioso se não suportado (ex.: iPhone). */
export async function enterImmersive() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    await screen.orientation?.lock?.('landscape');
  } catch {
    /* sem suporte — segue em janela normal */
  }
}
