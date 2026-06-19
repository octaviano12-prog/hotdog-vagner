const imageUpgrade = { booted: false };

const images = {
  hotdog: '/images/hotdog-premium.svg',
  combo: '/images/combo-premium.svg',
  delivery: '/images/delivery-premium.svg',
  account: '/images/account-loyalty.svg'
};

function isPublicHome() {
  return !['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`))
    && !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas') && !window.location.pathname.includes('acompanhar');
}

function normalize(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function productImage(title = '') {
  const text = normalize(title);
  if (text.includes('combo')) return images.combo;
  if (text.includes('suco') || text.includes('bebida') || text.includes('coca') || text.includes('refrigerante')) return images.delivery;
  if (text.includes('cadastro') || text.includes('conta') || text.includes('fidelidade')) return images.account;
  return images.hotdog;
}

function addHeroImage() {
  const art = document.querySelector('.hero-art');
  if (!art || art.querySelector('.real-hero-food')) return;
  const img = document.createElement('img');
  img.className = 'real-hero-food';
  img.src = images.hotdog;
  img.alt = 'Hot dog prensado premium do Hot Dog do Vagner';
  img.loading = 'eager';
  art.insertAdjacentElement('afterbegin', img);
}

function addImageShowcase() {
  if (document.querySelector('.image-showcase-v2')) return;
  const featureRow = document.querySelector('.feature-row');
  if (!featureRow) return;
  const section = document.createElement('section');
  section.className = 'image-showcase-v2';
  section.innerHTML = `
    <article><img src="${images.hotdog}" alt="Hot dog prensado"><div><span>Mais pedido</span><strong>Hot dog prensado caprichado</strong><p>Visual premium para destacar o lanche principal.</p></div></article>
    <article><img src="${images.combo}" alt="Combo da noite"><div><span>Combo da noite</span><strong>Oferta com bebida gelada</strong><p>Perfeito para aumentar o ticket medio no delivery.</p></div></article>
    <article><img src="${images.delivery}" alt="Entrega rapida"><div><span>Entrega rápida</span><strong>Pedido acompanhado em tempo real</strong><p>Cliente compra com mais confiança.</p></div></article>
  `;
  featureRow.insertAdjacentElement('afterend', section);
}

function upgradeProductCards() {
  document.querySelectorAll('.ultra-product-card').forEach((card) => {
    if (card.querySelector('.real-product-image')) return;
    const title = card.querySelector('h3')?.textContent || '';
    const wrap = card.querySelector('.product-photo-wrap');
    if (!wrap) return;
    const img = document.createElement('img');
    img.className = 'real-product-image';
    img.src = productImage(title);
    img.alt = title || 'Produto do cardapio';
    img.loading = 'lazy';
    wrap.insertAdjacentElement('afterbegin', img);
  });
}

function upgradeSignupImage() {
  const banner = document.querySelector('.home-v2-signup');
  if (!banner || banner.querySelector('.signup-real-image')) return;
  const img = document.createElement('img');
  img.className = 'signup-real-image';
  img.src = images.account;
  img.alt = 'Cadastro e fidelidade';
  img.loading = 'lazy';
  banner.appendChild(img);
}

function bootImageUpgrade() {
  if (imageUpgrade.booted || !isPublicHome()) return;
  imageUpgrade.booted = true;
  const applyUpgrade = () => {
    document.body.classList.add('site-images-v2');
    addHeroImage();
    addImageShowcase();
    upgradeProductCards();
    upgradeSignupImage();
    window.__markHotdogHomeReady?.('images');
    window.dispatchEvent(new CustomEvent('hotdog:home-images-ready'));
    let frame = 0;
    const finishCards = () => {
      upgradeProductCards();
      frame += 1;
      if (!document.querySelector('.ultra-product-card') && frame < 180) requestAnimationFrame(finishCards);
    };
    requestAnimationFrame(finishCards);
  };
  window.addEventListener('hotdog:home-v2-ready', applyUpgrade, { once: true });
  if (document.querySelector('.ultra-hero[data-home-v2-ready="1"]')) applyUpgrade();
}

bootImageUpgrade();
