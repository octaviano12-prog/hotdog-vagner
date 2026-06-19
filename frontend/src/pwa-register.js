const manifest = {
  rel: 'manifest',
  href: '/manifest.webmanifest'
};

function addMeta(name, content) {
  if (document.querySelector(`meta[name="${name}"]`)) return;
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.appendChild(meta);
}

function addLink(rel, href) {
  if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

export function registerPwa() {
  addLink(manifest.rel, manifest.href);
  addMeta('application-name', 'Hotdog Prensado');
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addMeta('apple-mobile-web-app-title', 'Hotdog Prensado');
  addMeta('mobile-web-app-capable', 'yes');
  addMeta('theme-color', '#080604');

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {
        // Mantem o site funcionando normalmente mesmo se o navegador bloquear o service worker.
      });
    });
  }
}
