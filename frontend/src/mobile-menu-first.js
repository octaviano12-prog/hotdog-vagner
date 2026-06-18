const menuFirst = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function simplifyMobileOrder() {
  if (!isMobileOrderRoute()) return;
  document.body.classList.add('mobile-menu-first');
  const hero = document.querySelector('.mobile-order-hero');
  if (hero && !hero.dataset.menuFirstReady) {
    hero.dataset.menuFirstReady = '1';
    const title = hero.querySelector('h1');
    const text = hero.querySelector('p');
    const pill = hero.querySelector('span');
    if (pill) pill.textContent = '🌭 Cardápio online';
    if (title) title.textContent = 'Escolha seu pedido';
    if (text) text.textContent = 'Cardápio simples, rápido e direto para pedir pelo celular.';
  }

  const login = document.querySelector('.mobile-login-card');
  if (login && !login.dataset.menuFirstReady) {
    login.dataset.menuFirstReady = '1';
    if (!login.classList.contains('logged')) {
      const strong = login.querySelector('strong');
      const p = login.querySelector('p');
      if (strong) strong.textContent = '🔒 Entre para finalizar';
      if (p) p.textContent = 'Você pode escolher os produtos agora. Para enviar, faça login/cadastro.';
    }
  }
}

function bootMenuFirst() {
  if (menuFirst.booted || !isMobileOrderRoute()) return;
  menuFirst.booted = true;
  setInterval(simplifyMobileOrder, 500);
}

bootMenuFirst();
