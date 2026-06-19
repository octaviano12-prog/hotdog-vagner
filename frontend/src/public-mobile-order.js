import { BRAND_NAME, productMedia, productMediaPosition } from './product-media.js';

const mobileOrder = {
  booted: false,
  loaded: false,
  menu: { categories: [], products: [] },
  settings: {},
  cart: [],
  payment: 'dinheiro',
  delivery: 'entrega',
  notes: '',
  changeFor: '',
  message: '',
  step: 1,
  sending: false,
  favorites: loadFavorites()
};

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function brl(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function customerToken() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customerProfile() {
  try { return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null'); } catch { return null; }
}

function isLogged() {
  return Boolean(customerToken() && customerProfile());
}

function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem('hotdog_mobile_favorites') || '[]').map(String)); } catch { return new Set(); }
}

function saveFavorites() {
  localStorage.setItem('hotdog_mobile_favorites', JSON.stringify([...mobileOrder.favorites]));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function imageFor(product = {}) {
  return productMedia(product);
}

function productKind(product = {}) {
  const type = String(product.product_type || '').toLowerCase();
  const text = `${product.category_name || ''} ${product.name || ''}`.toLowerCase();
  if (type === 'hotdog' || text.includes('hot dog') || text.includes('hotdog') || text.includes('lanche')) return 'snack';
  if (type === 'bebida' || type === 'suco' || text.includes('bebida') || text.includes('refrigerante') || text.includes('suco')) return 'drink';
  return 'other';
}

async function loadMobileData() {
  const [settings, menu] = await Promise.all([
    fetch('/api/public/settings').then((response) => response.ok ? response.json() : {}).catch(() => ({})),
    fetch('/api/public/menu').then((response) => response.ok ? response.json() : { categories: [], products: [] }).catch(() => ({ categories: [], products: [] }))
  ]);
  mobileOrder.settings = settings || {};
  mobileOrder.menu = menu || { categories: [], products: [] };
  mobileOrder.loaded = true;
}

function extras() {
  return (mobileOrder.menu.products || []).filter((product) => product.product_type === 'adicional');
}

function productsForStep() {
  const products = (mobileOrder.menu.products || []).filter((product) => product.product_type !== 'adicional');
  if (mobileOrder.step === 1) return products.filter((product) => productKind(product) === 'snack');
  if (mobileOrder.step === 3) return products.filter((product) => productKind(product) === 'drink');
  return [];
}

function subtotal() {
  return mobileOrder.cart.reduce((sum, item) => sum + item.quantity * (Number(item.price || 0) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price || 0), 0)), 0);
}

function deliveryFee() {
  if (!mobileOrder.cart.length || mobileOrder.delivery !== 'entrega') return 0;
  return Number(mobileOrder.settings?.delivery_fee || 0);
}

function total() {
  return subtotal() + deliveryFee();
}

function openAccount(tab) {
  if (window.hotdogOpenAccountModal) {
    window.hotdogOpenAccountModal(tab || (isLogged() ? 'profile' : 'login'));
    return;
  }
  window.dispatchEvent(new CustomEvent('hotdog-open-account', { detail: { tab: tab || 'login' } }));
}

function logoutCustomer() {
  localStorage.removeItem('hotdog_customer_token');
  localStorage.removeItem('hotdog_customer_profile');
  mobileOrder.cart = [];
  mobileOrder.step = 1;
  mobileOrder.message = 'Você saiu da conta.';
  document.body.classList.remove('account-modal-open');
  window.dispatchEvent(new Event('hotdog-customer-logout'));
  renderMobilePage();
}

function normalizeStep() {
  if (!mobileOrder.cart.length && mobileOrder.step > 1) mobileOrder.step = 1;
  mobileOrder.step = Math.max(1, Math.min(4, Number(mobileOrder.step) || 1));
}

function setStep(step, focus = true) {
  mobileOrder.step = step;
  normalizeStep();
  renderMobilePage();
  if (!focus) return;
  requestAnimationFrame(() => {
    const selector = mobileOrder.step === 1 || mobileOrder.step === 3 ? '.mobile-product-list' : '.mobile-order-cart';
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function addProduct(productId) {
  const product = (mobileOrder.menu.products || []).find((entry) => Number(entry.id) === Number(productId));
  if (!product) return;
  mobileOrder.cart.push({ key: uid(), ...product, quantity: 1, extras: [] });
  mobileOrder.message = '';
  setStep(productKind(product) === 'drink' ? 4 : 2);
}

function toggleFavorite(productId) {
  const key = String(productId);
  if (mobileOrder.favorites.has(key)) mobileOrder.favorites.delete(key);
  else mobileOrder.favorites.add(key);
  saveFavorites();
  renderMobilePage();
}

function addExtra(key, extraId) {
  const item = mobileOrder.cart.find((entry) => entry.key === key);
  const extra = extras().find((entry) => Number(entry.id) === Number(extraId));
  if (!item || !extra) return;
  const exists = item.extras.some((entry) => Number(entry.id) === Number(extraId));
  item.extras = exists ? item.extras.filter((entry) => Number(entry.id) !== Number(extraId)) : [...item.extras, extra];
  renderMobilePage();
}

function changeQty(key, delta) {
  const item = mobileOrder.cart.find((entry) => entry.key === key);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) mobileOrder.cart = mobileOrder.cart.filter((entry) => entry.key !== key);
  normalizeStep();
  renderMobilePage();
}

function stepContent() {
  const content = {
    1: ['Etapa 1 de 4', 'Escolha seu lanche', 'Comece pelo hot dog prensado. Depois você poderá escolher os adicionais.'],
    2: ['Etapa 2 de 4', 'Personalize seu lanche', 'Escolha os adicionais que desejar e continue para as bebidas.'],
    3: ['Etapa 3 de 4', 'Quer uma bebida?', 'Adicione refrigerante ou suco, ou avance sem bebida.'],
    4: ['Etapa 4 de 4', 'Revise e finalize', 'Confira os itens, escolha a entrega e envie seu pedido.']
  };
  return content[mobileOrder.step] || content[1];
}

function stepPanel() {
  const [eyebrow, title, text] = stepContent();
  const previous = mobileOrder.step > 1 ? `<button type="button" class="guided-secondary" data-step="${mobileOrder.step - 1}">Voltar</button>` : '';
  let next = '';
  if (mobileOrder.step === 2) next = '<button type="button" class="guided-primary" data-step="3">Continuar para bebida</button>';
  if (mobileOrder.step === 3) next = '<button type="button" class="guided-primary" data-step="4">Continuar sem bebida</button>';
  if (mobileOrder.step === 4) next = '<button type="button" class="guided-secondary" data-step="1">Adicionar mais itens</button>';
  return `<section class="mobile-guided-panel" aria-labelledby="guided-title"><div class="guided-progress" aria-label="${eyebrow}">${[1, 2, 3, 4].map((step) => `<i class="${step <= mobileOrder.step ? 'done' : ''}"></i>`).join('')}</div><span>${eyebrow}</span><h2 id="guided-title">${title}</h2><p>${text}</p>${previous || next ? `<div class="guided-actions">${previous}${next}</div>` : ''}</section>`;
}

function productCard(product) {
  const favorite = mobileOrder.favorites.has(String(product.id));
  return `<article class="mobile-product-card ${productMediaPosition(product)}"><div class="mobile-product-image"><img src="${escapeHtml(imageFor(product))}" alt="${escapeHtml(product.name)}" width="128" height="128" loading="lazy" /></div><div class="mobile-product-copy"><span>${escapeHtml(product.category_name || product.product_type || 'Produto')}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description || 'Feito na hora.')}</p><footer><strong>${brl(product.price)}</strong><button type="button" data-add-product="${Number(product.id)}">Adicionar <b>+</b></button></footer></div><button type="button" class="premium-heart ${favorite ? 'active' : ''}" data-favorite-product="${Number(product.id)}" aria-label="${favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button></article>`;
}

function cartLine(item) {
  const itemExtras = extras();
  const extraButtons = mobileOrder.step === 2 && item.product_type === 'hotdog' && itemExtras.length
    ? `<div class="mobile-extra-list">${itemExtras.map((extra) => `<button type="button" class="${item.extras.some((entry) => Number(entry.id) === Number(extra.id)) ? 'active' : ''}" data-extra-key="${escapeHtml(item.key)}" data-extra-id="${Number(extra.id)}">${escapeHtml(extra.name)} <b>+${brl(extra.price)}</b></button>`).join('')}</div>`
    : '';
  return `<article class="mobile-cart-line"><div class="mobile-cart-item-copy"><strong>${item.quantity}x ${escapeHtml(item.name)}</strong><small>${item.extras.length ? `+ ${item.extras.map((extra) => escapeHtml(extra.name)).join(', ')}` : 'Sem adicionais'}</small></div><div class="mobile-qty"><button type="button" data-qty="${escapeHtml(item.key)}" data-delta="-1" aria-label="Diminuir quantidade">−</button><b>${item.quantity}</b><button type="button" data-qty="${escapeHtml(item.key)}" data-delta="1" aria-label="Aumentar quantidade">+</button></div>${extraButtons}</article>`;
}

function checkoutForm() {
  if (mobileOrder.step !== 4) return '';
  const logged = isLogged();
  return `<form class="mobile-checkout-form"><fieldset><legend>Como você quer receber?</legend><div class="mobile-choice"><button type="button" class="${mobileOrder.delivery === 'entrega' ? 'active' : ''}" data-delivery="entrega">Entrega</button><button type="button" class="${mobileOrder.delivery === 'retirada' ? 'active' : ''}" data-delivery="retirada">Retirada</button></div></fieldset><label class="mobile-field">Forma de pagamento<select data-payment><option value="dinheiro" ${mobileOrder.payment === 'dinheiro' ? 'selected' : ''}>Dinheiro</option><option value="pix" ${mobileOrder.payment === 'pix' ? 'selected' : ''}>PIX</option><option value="cartao" ${mobileOrder.payment === 'cartao' ? 'selected' : ''}>Cartão</option><option value="fiado" ${mobileOrder.payment === 'fiado' ? 'selected' : ''}>Fiado</option></select></label>${mobileOrder.payment === 'dinheiro' ? `<label class="mobile-field">Troco para quanto?<input data-mobile-change type="number" step="0.01" inputmode="decimal" value="${escapeHtml(mobileOrder.changeFor)}" placeholder="Ex.: 50,00" /></label>` : ''}<label class="mobile-field">Observações<textarea data-mobile-notes placeholder="Ex.: retirar milho">${escapeHtml(mobileOrder.notes)}</textarea></label><div class="mobile-total-box"><span>Subtotal <b>${brl(subtotal())}</b></span><span>Entrega <b>${brl(deliveryFee())}</b></span><strong>Total <b>${brl(total())}</b></strong></div><button class="mobile-send-order" type="submit" ${mobileOrder.sending ? 'disabled' : ''}>${mobileOrder.sending ? 'Enviando pedido…' : logged ? 'Finalizar pedido' : 'Entrar para finalizar'}</button></form>`;
}

async function sendMobileOrder(event) {
  event.preventDefault();
  if (mobileOrder.sending) return;
  if (!isLogged()) {
    mobileOrder.message = 'Entre ou cadastre-se para finalizar o pedido.';
    renderMobilePage();
    openAccount('login');
    return;
  }
  if (!mobileOrder.cart.length) {
    mobileOrder.message = 'Adicione pelo menos um produto ao pedido.';
    renderMobilePage();
    return;
  }
  const profile = customerProfile() || {};
  const changeFor = Number(String(mobileOrder.changeFor || '').replace(',', '.'));
  const payload = {
    customer: {
      name: profile.name || 'Cliente',
      phone: profile.phone || '',
      address: profile.address || '',
      reference: profile.reference || '',
      neighborhood: profile.neighborhood || ''
    },
    delivery_type: mobileOrder.delivery,
    payment_method: mobileOrder.payment,
    change_for: mobileOrder.payment === 'dinheiro' && changeFor > 0 ? changeFor : null,
    notes: mobileOrder.notes,
    items: mobileOrder.cart.map((item) => ({ product_id: Number(item.id), quantity: Number(item.quantity), extras: item.extras.map((extra) => Number(extra.id)), notes: '' }))
  };
  mobileOrder.sending = true;
  mobileOrder.message = '';
  renderMobilePage();
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken()}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Não foi possível enviar o pedido.');
    const code = data?.order?.public_code || (data?.order?.id ? `HD${String(data.order.id).padStart(4, '0')}` : 'pedido');
    mobileOrder.cart = [];
    mobileOrder.message = `Pedido ${code} enviado com sucesso!`;
    renderMobilePage();
    window.setTimeout(() => { window.location.href = `/acompanhar?codigo=${encodeURIComponent(code)}&phone=${encodeURIComponent(profile.phone || '')}`; }, 900);
  } catch (error) {
    mobileOrder.sending = false;
    mobileOrder.message = error.message;
    renderMobilePage();
  }
}

function renderMobilePage() {
  if (!isMobileOrderRoute()) return;
  normalizeStep();
  document.body.classList.add('mobile-order-page', 'mobile-order-stable');
  document.body.dataset.guidedStep = String(mobileOrder.step);
  let root = document.querySelector('.mobile-order-app');
  if (!root) {
    root = document.createElement('main');
    root.className = 'mobile-order-app';
    root.addEventListener('click', handleClick);
    root.addEventListener('input', handleInput);
    root.addEventListener('change', handleInput);
    root.addEventListener('submit', (event) => {
      if (event.target.matches('.mobile-checkout-form')) sendMobileOrder(event);
    });
    document.body.appendChild(root);
  }
  const logged = isLogged();
  const profile = customerProfile();
  const products = productsForStep();
  const productList = !mobileOrder.loaded
    ? '<div class="mobile-loading">Carregando cardápio…</div>'
    : products.length ? products.map(productCard).join('') : '<div class="mobile-empty-products">Nenhum produto disponível nesta etapa.</div>';
  const cart = mobileOrder.cart.length ? mobileOrder.cart.map(cartLine).join('') : '<div class="mobile-empty-cart">Adicione produtos para começar.</div>';
  root.innerHTML = `<header class="mobile-order-header"><div class="mobile-brand"><span>${BRAND_NAME.toUpperCase()}</span><strong>Pedido online</strong></div><div class="mobile-header-actions"><button type="button" data-account="${logged ? 'orders' : 'login'}">${logged ? 'Meus pedidos' : 'Entrar'}</button>${logged ? '<button type="button" class="mobile-logout-top" data-mobile-logout>Sair</button>' : ''}</div></header><section class="mobile-order-hero"><span>🌭 Cardápio online</span><h1>Escolha seu pedido</h1><p>Hot dog prensado, feito na hora e do seu jeito.</p></section><section class="mobile-login-card ${logged ? 'logged' : ''}">${logged ? `<div><strong>Pedido liberado</strong><p>Comprando como <b>${escapeHtml(profile?.name || 'cliente')}</b>.</p></div>` : '<div><strong>Entre para finalizar</strong><p>Escolha os produtos agora e faça login antes de enviar.</p></div><button type="button" data-account="login">Entrar</button>'}</section>${stepPanel()}${mobileOrder.step === 1 || mobileOrder.step === 3 ? `<section class="mobile-product-list" aria-live="polite">${productList}</section>` : ''}${mobileOrder.step === 2 || mobileOrder.step === 4 ? `<section class="mobile-order-cart"><div class="mobile-cart-head"><div><span>${mobileOrder.cart.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</span><h2>Seu pedido</h2></div><strong>${brl(total())}</strong></div>${cart}${checkoutForm()}</section>` : ''}${mobileOrder.message ? `<p class="mobile-order-message" role="status">${escapeHtml(mobileOrder.message)}</p>` : ''}`;
}

function handleClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.account) return openAccount(button.dataset.account);
  if (button.hasAttribute('data-mobile-logout')) return logoutCustomer();
  if (button.dataset.favoriteProduct) return toggleFavorite(button.dataset.favoriteProduct);
  if (button.dataset.addProduct) return addProduct(button.dataset.addProduct);
  if (button.dataset.qty) return changeQty(button.dataset.qty, Number(button.dataset.delta));
  if (button.dataset.extraKey) return addExtra(button.dataset.extraKey, button.dataset.extraId);
  if (button.dataset.delivery) {
    mobileOrder.delivery = button.dataset.delivery;
    renderMobilePage();
    return;
  }
  if (button.dataset.step) setStep(Number(button.dataset.step));
}

function handleInput(event) {
  if (event.target.matches('[data-payment]')) {
    mobileOrder.payment = event.target.value;
    renderMobilePage();
  } else if (event.target.matches('[data-mobile-change]')) {
    mobileOrder.changeFor = event.target.value;
  } else if (event.target.matches('[data-mobile-notes]')) {
    mobileOrder.notes = event.target.value;
  }
}

async function bootMobileOrder() {
  if (mobileOrder.booted || !isMobileOrderRoute()) return;
  mobileOrder.booted = true;
  renderMobilePage();
  await loadMobileData();
  try {
    const pending = JSON.parse(localStorage.getItem('hotdog_pending_cart') || '[]');
    localStorage.removeItem('hotdog_pending_cart');
    pending.forEach(({ productId, extraIds = [] }) => {
      const product = (mobileOrder.menu.products || []).find((entry) => Number(entry.id) === Number(productId));
      if (!product) return;
      const selectedExtras = extras().filter((extra) => extraIds.map(Number).includes(Number(extra.id)));
      mobileOrder.cart.push({ key: uid(), ...product, quantity: 1, extras: selectedExtras });
    });
    if (mobileOrder.cart.length) mobileOrder.step = 2;
  } catch {
    localStorage.removeItem('hotdog_pending_cart');
  }
  renderMobilePage();
}

window.addEventListener('hotdog-customer-session', () => renderMobilePage());
window.addEventListener('hotdog-account-updated', () => renderMobilePage());
window.addEventListener('storage', (event) => {
  if (event.key === 'hotdog_customer_token' || event.key === 'hotdog_customer_profile') renderMobilePage();
});

bootMobileOrder();
