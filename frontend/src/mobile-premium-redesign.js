const premiumMobile = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function setHeroCopy() {
  const hero = document.querySelector('.mobile-order-hero');
  if (!hero) return;
  document.body.classList.add('mobile-premium-v2');
  const pill = hero.querySelector('span');
  const title = hero.querySelector('h1');
  const text = hero.querySelector('p');
  if (pill) pill.innerHTML = '⚡ Pedido rápido';
  if (title) title.innerHTML = 'Seu hot dog,<br/>do seu jeito.';
  if (text) text.textContent = 'Escolha, personalize e receba seu pedido em minutos.';
  if (!hero.querySelector('.premium-hero-food')) {
    const img = document.createElement('img');
    img.className = 'premium-hero-food';
    img.src = '/images/hotdog-premium.svg';
    img.alt = 'Hot dog premium';
    img.loading = 'eager';
    hero.appendChild(img);
  }
  if (!hero.querySelector('.premium-hero-dots')) {
    const dots = document.createElement('div');
    dots.className = 'premium-hero-dots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    hero.appendChild(dots);
  }
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
  if (!document.querySelector('.mobile-premium-shortcuts')) {
    const shortcuts = document.createElement('div');
    shortcuts.className = 'mobile-premium-shortcuts';
    shortcuts.innerHTML = '<a href="/acompanhar"><span>🛵</span><div><strong>Acompanhar pedido</strong><small>Veja o status do seu pedido</small></div></a><button type="button" data-premium-account><span>👤</span><div><strong>Minha conta</strong><small>Endereços, dados e pedidos</small></div></button>';
    bottom.insertAdjacentElement('afterend', shortcuts);
    shortcuts.querySelector('[data-premium-account]').addEventListener('click', () => document.querySelector('[data-account]')?.click());
  }
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
