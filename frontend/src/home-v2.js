const homeV2 = { booted: false };

function isPublicHome() {
  return !['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`))
    && !window.location.pathname.includes('admin') && !window.location.pathname.includes('cozinha') && !window.location.pathname.includes('entregas') && !window.location.pathname.includes('acompanhar');
}

function installHomePreflight() {
  document.body.classList.add('home-v2-ready', 'home-v2-preparing');
  if (document.getElementById('home-v2-preflight')) return;
  const style = document.createElement('style');
  style.id = 'home-v2-preflight';
  style.textContent = 'body.home-v2-preparing #root{visibility:hidden!important}';
  document.head.appendChild(style);
}

function revealHome() {
  document.body.classList.remove('home-v2-preparing');
  document.getElementById('home-v2-preflight')?.remove();
}

window.__revealHotdogHome = revealHome;
window.__hotdogHomeReady = window.__hotdogHomeReady || new Set();
window.__markHotdogHomeReady = (part) => {
  window.__hotdogHomeReady.add(part);
  const required = ['core', 'images', 'offer', 'rules'];
  if (required.every((item) => window.__hotdogHomeReady.has(item))) revealHome();
};

function scrollToOrder() {
  document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goMobileOrder() {
  window.location.href = '/pedir';
}

function openAccount() {
  document.querySelector('.customer-account-float')?.click();
}

function ensureHeroUpgrade() {
  const hero = document.querySelector('.ultra-hero');
  const copy = document.querySelector('.hero-copy');
  const art = document.querySelector('.hero-art');
  if (!hero || !copy || hero.dataset.homeV2Ready) return;
  hero.dataset.homeV2Ready = '1';
  document.body.classList.add('home-v2-ready');

  const top = document.createElement('div');
  top.className = 'home-v2-topline';
  top.innerHTML = '<span>🔥 Hot dog prensado</span><span>🚚 Entrega rápida</span><span>👤 Pedido com cadastro</span>';
  copy.insertAdjacentElement('afterbegin', top);

  const actions = copy.querySelector('.hero-actions');
  if (actions && !actions.querySelector('[data-v2-account]')) {
    const mobile = document.createElement('button');
    mobile.type = 'button';
    mobile.className = 'hero-mobile-v2';
    mobile.textContent = 'Pedido mobile';
    mobile.addEventListener('click', goMobileOrder);
    actions.appendChild(mobile);

    const account = document.createElement('button');
    account.type = 'button';
    account.className = 'hero-account-v2';
    account.dataset.v2Account = '1';
    account.textContent = 'Entrar / cadastrar';
    account.addEventListener('click', openAccount);
    actions.appendChild(account);
  }

  const proof = document.createElement('div');
  proof.className = 'home-v2-proof';
  proof.innerHTML = '<article><strong>1 clique</strong><span>para repetir pedido</span></article><article><strong>Tempo real</strong><span>acompanhe o preparo</span></article><article><strong>Fidelidade</strong><span>benefícios no cadastro</span></article>';
  copy.appendChild(proof);

  const badge = document.createElement('div');
  badge.className = 'home-v2-price-card';
  badge.innerHTML = '<span>Mais pedido</span><strong>Hot Dog Prensado</strong><small>Monte com adicionais e envie direto para a cozinha.</small><button type="button">Ver cardápio</button>';
  badge.querySelector('button').addEventListener('click', goMobileOrder);
  art?.appendChild(badge);
}

function ensureSignupBanner() {
  if (document.querySelector('.home-v2-signup')) return;
  const workflow = document.querySelector('.workflow-section');
  if (!workflow) return;
  const banner = document.createElement('section');
  banner.className = 'home-v2-signup';
  banner.innerHTML = '<div><span>Cadastro obrigatório</span><h2>Cadastre uma vez e peça mais rápido sempre.</h2><p>Seu endereço fica salvo, você acompanha o pedido em tempo real e ainda ganha acesso ao histórico, fidelidade e pedir novamente.</p></div><button type="button">Criar cadastro / entrar</button>';
  banner.querySelector('button').addEventListener('click', openAccount);
  workflow.insertAdjacentElement('afterend', banner);
}

function ensureStickyCta() {
  if (document.querySelector('.home-v2-sticky-cta')) return;
  const bar = document.createElement('div');
  bar.className = 'home-v2-sticky-cta';
  bar.innerHTML = '<button type="button" data-menu>Fazer pedido</button><button type="button" data-account>Minha conta</button>';
  bar.querySelector('[data-menu]').addEventListener('click', goMobileOrder);
  bar.querySelector('[data-account]').addEventListener('click', openAccount);
  document.body.appendChild(bar);
}

function ensureSectionLabels() {
  document.querySelectorAll('.ultra-section').forEach((section, index) => {
    if (section.dataset.homeV2Label) return;
    section.dataset.homeV2Label = '1';
    const head = section.querySelector('.section-heading');
    if (head && index === 0) head.classList.add('home-v2-featured-heading');
  });
}

function bootHomeV2() {
  if (homeV2.booted || !isPublicHome()) return;
  homeV2.booted = true;
  installHomePreflight();
  const finish = () => {
    const hero = document.querySelector('.ultra-hero');
    const workflow = document.querySelector('.workflow-section');
    if (!hero || !workflow) return false;
    observer.disconnect();
    ensureHeroUpgrade();
    ensureSignupBanner();
    ensureStickyCta();
    ensureSectionLabels();
    window.__markHotdogHomeReady('core');
    window.dispatchEvent(new CustomEvent('hotdog:home-v2-ready'));
    return true;
  };
  const observer = new MutationObserver(finish);
  observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
  finish();
  setTimeout(revealHome, 3500);
}

bootHomeV2();
