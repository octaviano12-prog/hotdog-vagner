const offerShowcase = { booted: false, active: 0 };

const offerImages = {
  hotdog: '/images/hotdog-premium.svg',
  combo: '/images/combo-premium.svg',
  delivery: '/images/delivery-premium.svg',
  account: '/images/account-loyalty.svg'
};

const offers = [
  {
    tag: 'Mais pedido',
    title: 'Hot dog prensado caprichado',
    text: 'Pão prensado, salsicha, molhos, batata, milho e adicionais para montar do seu jeito.',
    image: offerImages.hotdog,
    action: 'Pedir agora'
  },
  {
    tag: 'Combo da noite',
    title: 'Lanche + bebida gelada',
    text: 'A sugestão perfeita para aumentar a fome e fechar o pedido em poucos cliques.',
    image: offerImages.combo,
    action: 'Ver combo'
  },
  {
    tag: 'Entrega rápida',
    title: 'Acompanhe o pedido em tempo real',
    text: 'Depois de pedir, o cliente acompanha o preparo, saída para entrega e conclusão.',
    image: offerImages.delivery,
    action: 'Acompanhar'
  },
  {
    tag: 'Cliente cadastrado',
    title: 'Peça mais rápido sempre',
    text: 'Com cadastro, endereço fica salvo, pedido repete fácil e a fidelidade acompanha tudo.',
    image: offerImages.account,
    action: 'Criar conta'
  }
];

function isPublicHome() {
  return !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas') && !window.location.pathname.includes('acompanhar');
}

function scrollToMenu() {
  document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openAccount() {
  document.querySelector('.customer-account-float')?.click();
}

function primaryAction(index) {
  if (index === 2) window.location.href = '/acompanhar';
  else if (index === 3) openAccount();
  else scrollToMenu();
}

function renderOffer(section) {
  const item = offers[offerShowcase.active % offers.length];
  section.innerHTML = `<div class="offer-copy"><span>${item.tag}</span><h2>${item.title}</h2><p>${item.text}</p><div class="offer-actions"><button type="button" data-offer-action>${item.action}</button><button type="button" data-offer-menu>Ver cardápio</button></div></div><div class="offer-art"><img src="${item.image}" alt="${item.title}" loading="lazy" /><div class="offer-badge"><strong>${offerShowcase.active + 1}/${offers.length}</strong><small>vitrine premium</small></div></div><div class="offer-dots">${offers.map((offer, index) => `<button type="button" class="${index === offerShowcase.active ? 'active' : ''}" data-offer-dot="${index}" aria-label="${offer.tag}"></button>`).join('')}</div>`;
  section.querySelector('[data-offer-action]').addEventListener('click', () => primaryAction(offerShowcase.active));
  section.querySelector('[data-offer-menu]').addEventListener('click', scrollToMenu);
  section.querySelectorAll('[data-offer-dot]').forEach((button) => button.addEventListener('click', () => {
    offerShowcase.active = Number(button.dataset.offerDot);
    renderOffer(section);
  }));
}

function ensureOfferShowcase() {
  let section = document.querySelector('.offer-showcase-v2');
  if (!section) {
    const after = document.querySelector('.image-showcase-v2') || document.querySelector('.feature-row') || document.querySelector('.workflow-section');
    if (!after) return;
    section = document.createElement('section');
    section.className = 'offer-showcase-v2';
    after.insertAdjacentElement('afterend', section);
    renderOffer(section);
  }
}

function bootOfferShowcase() {
  if (offerShowcase.booted || !isPublicHome()) return;
  offerShowcase.booted = true;
  setInterval(ensureOfferShowcase, 1200);
  setInterval(() => {
    const section = document.querySelector('.offer-showcase-v2');
    if (!section) return;
    offerShowcase.active = (offerShowcase.active + 1) % offers.length;
    renderOffer(section);
  }, 6500);
}

bootOfferShowcase();
