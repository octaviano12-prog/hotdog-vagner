const premiumMobile = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function setHeroCopy() {
  const hero = document.querySelector('.mobile-order-hero');
  if (!hero) return;
  document.body.classList.add('mobile-premium-v2', 'mobile-final-layout');
  const pill = hero.querySelector('span');
  const title = hero.querySelector('h1');
  const text = hero.querySelector('p');
  if (pill) pill.innerHTML = '🌭 Cardápio online';
  if (title) title.textContent = 'Escolha seu pedido';
  if (text) text.textContent = 'Cardápio simples, rápido e direto para pedir pelo celular.';
  hero.querySelector('.premium-hero-food')?.remove();
  hero.querySelector('.premium-hero-dots')?.remove();
}

function enhanceHeader() {
  const header = document.querySelector('.mobile-order-header');
  if (!header || header.dataset.premiumReady) return;
  header.dataset.premiumReady = '1';
  const title = header.querySelector('strong');
  if (title) title.textContent = 'Pedido mobile';
}

function enhanceSearch() {
  const input = document.querySelector('.mobile-quick-search input');
  if (!input || input.dataset.premiumReady) return;
  input.dataset.premiumReady = '1';
  input.placeholder = 'Buscar no cardápio';
}

function enhanceProducts() {
  document.querySelectorAll('.mobile-product-card').forEach((card) => {
    if (!card.querySelector('.premium-heart')) {
      const heart = document.createElement('button');
      heart.type = 'button';
      heart.className = 'premium-heart';
      heart.setAttribute('aria-label', 'Favoritar');
      heart.innerHTML = '♡';
      card.appendChild(heart);
    }
  });
}

function cartCount() {
  const text = document.querySelector('.mobile-cart-head span')?.textContent || '';
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function ensurePremiumBottom() {
  const bottom = document.querySelector('.mobile-bottom-bar');
  if (!bottom) return;
  const count = cartCount();
  document.body.classList.toggle('premium-has-cart', count > 0);
  document.querySelector('.mobile-premium-shortcuts')?.remove();
}

function bootPremiumMobile() {
  if (premiumMobile.booted || !isMobileOrderRoute()) return;
  premiumMobile.booted = true;
  setInterval(() => {
    setHeroCopy();
    enhanceHeader();
    enhanceSearch();
    enhanceProducts();
    ensurePremiumBottom();
  }, 500);
}

bootPremiumMobile();
