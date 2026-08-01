// iOS legt het on-screen toetsenbord óver de layout-viewport heen: 100dvh
// krimpt niet mee en alles dat onderaan "fixed" staat (inputbar, send-knop)
// verdwijnt achter het toetsenbord. We spiegelen daarom de visualViewport
// naar CSS-variabelen; de sheets rekenen daarmee hun hoogte en bodemafstand.
export function trackVisualViewport(el: HTMLElement): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const sync = (): void => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    el.style.setProperty('--ltb-kb', kb + 'px');
    el.style.setProperty('--ltb-vvh', vv.height + 'px');
  };
  // Krimpt de viewport (toetsenbord opent), dan moet het nieuwste bericht
  // onderin de chat zichtbaar blijven.
  const pinChat = (): void => {
    const chat = el.querySelector<HTMLElement>('.ltb-wa-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  };
  vv.addEventListener('resize', () => {
    sync();
    pinChat();
  });
  vv.addEventListener('scroll', sync);
  sync();
}
