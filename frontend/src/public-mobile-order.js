const mobileOrder = {
  booted: false,
  loaded: false,
  menu: { categories: [], products: [] },
  settings: {},
  cart: [],
  category: 'todos',
  payment: 'dinheiro',
  delivery: 'entrega',
  notes: '',
  message: ''
};

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
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

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function imageFor(product = {}) {
  const type = product.product_type || '';
  const name = String(product.name || '').toLowerCase();
  if (type === 'bebida' || type === 'suco' || name.includes('coca') || name.includes('suco')) return '/images/delivery-premium.svg';
  return '/images/hotdog-premium.svg';
}

async function loadMobileData() {
  const [settings, menu] = await Promise.all([
    fetch('/api/public/settings').then((r) => r.json()).catch(() => ({})),
    fetch('/api/public/menu').then((r) => r.json()).catch(() => ({ categories: [], products: [] }))
  ]);
  mobileOrder.settings = settings || {};
  mobileOrder.menu = menu || { categories: [], products: [] };
  mobileOrder.loaded = true;
}

function extras() {
  return mobileOrder.menu.products.filter((p) => p.product_type === 'adicional');
}

function visibleProducts() {
  const products = mobileOrder.menu.products.filter((p) => p.product_type !== 'adicional');
  if (mobileOrder.category === 'todos') return products;
  return products.filter((p) => String(p.category_id) === String(mobileOrder.category));
}

function subtotal() {
  return mobileOrder.cart.reduce((sum, item) => sum + item.quantity * (Number(item.price || 0) + item.extras.reduce((s, e) => s + Number(e.price || 0), 0)), 0);
}

function deliveryFee() {
  return mobileOrder.delivery === 'entrega' ? Number(mobileOrder.settings?.delivery_fee || 0) : 0;
}

function total() {
  return subtotal() + deliveryFee();
}

function addProduct(productId) {
  const product = mobileOrder.menu.products.find((p) => Number(p.id) === Number(productId));
  if (!product) return;
  mobileOrder.cart.push({ key: uid(), ...product, quantity: 1, extras: [] });
  renderMobilePage('Produto adicionado.');
  document.querySelector('.mobile-order-cart')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  renderMobilePage();
}

function openAccount() {
  if (document.querySelector('.customer-account-float')) document.querySelector('.customer-account-float').click();
  else window.location.href = '/';
}

async function sendMobileOrder(event) {
  event.preventDefault();
  if (!isLogged()) {
    mobileOrder.message = 'Entre ou cadastre-se para finalizar o pedido.';
    renderMobilePage();
    openAccount();
    return;
  }
  if (!mobileOrder.cart.length) {
    mobileOrder.message = 'Adicione pelo menos um produto ao pedido.';
    return renderMobilePage();
  }
  const profile = customerProfile() || {};
  const changeFor = Number(document.querySelector('[data-mobile-change]')?.value || 0);
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
    notes: document.querySelector('[data-mobile-notes]')?.value || '',
    items: mobileOrder.cart.map((item) => ({ product_id: Number(item.id), quantity: Number(item.quantity), extras: item.extras.map((extra) => Number(extra.id)), notes: '' }))
  };
  mobileOrder.message = 'Enviando pedido...';
  renderMobilePage();
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken()}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Nao foi possivel enviar o pedido.');
    mobileOrder.cart = [];
    const code = data?.order?.public_code || (data?.order?.id ? `HD${String(data.order.id).padStart(4, '0')}` : 'pedido');
    mobileOrder.message = `Pedido ${code} enviado com sucesso!`;
    renderMobilePage();
    setTimeout(() => { window.location.href = `/acompanhar?codigo=${encodeURIComponent(code)}&phone=${encodeURIComponent(profile.phone || '')}`; }, 900);
  } catch (error) {
    mobileOrder.message = error.message;
    renderMobilePage();
  }
}

function productCard(product) {
  return `<article class="mobile-product-card"><img src="${imageFor(product)}" alt="${product.name}" loading="lazy" /><div><span>${product.category_name || product.product_type || 'Produto'}</span><h3>${product.name}</h3><p>${product.description || 'Feito na hora.'}</p><footer><strong>${brl(product.price)}</strong><button type="button" data-add-product="${product.id}">Adicionar</button></footer></div></article>`;
}

function cartLine(item) {
  const itemExtras = extras();
  return `<article class="mobile-cart-line"><div><strong>${item.quantity}x ${item.name}</strong><small>${item.extras.length ? `+ ${item.extras.map((e) => e.name).join(', ')}` : 'Sem adicionais'}</small></div><div class="mobile-qty"><button type="button" data-qty="${item.key}" data-delta="-1">-</button><b>${item.quantity}</b><button type="button" data-qty="${item.key}" data-delta="1">+</button></div>${item.product_type === 'hotdog' && itemExtras.length ? `<div class="mobile-extra-list">${itemExtras.map((extra) => `<button type="button" class="${item.extras.some((e) => Number(e.id) === Number(extra.id)) ? 'active' : ''}" data-extra-key="${item.key}" data-extra-id="${extra.id}">${extra.name} +${brl(extra.price)}</button>`).join('')}</div>` : ''}</article>`;
}

function renderMobilePage(message = mobileOrder.message) {
  document.body.classList.add('mobile-order-page');
  let root = document.querySelector('.mobile-order-app');
  if (!root) {
    root = document.createElement('main');
    root.className = 'mobile-order-app';
    document.body.appendChild(root);
  }
  const profile = customerProfile();
  const count = mobileOrder.cart.reduce((sum, item) => sum + item.quantity, 0);
  root.innerHTML = `<header class="mobile-order-header"><button type="button" data-back>←</button><div><span>Hot Dog do Vagner</span><strong>Pedido mobile</strong></div><button type="button" data-account>${isLogged() ? 'Conta' : 'Entrar'}</button></header><section class="mobile-order-hero"><div><span>🌭 Pedido rápido</span><h1>Monte seu hot dog pelo celular</h1><p>Escolha, personalize, finalize com cadastro e acompanhe em tempo real.</p></div><img src="/images/hotdog-premium.svg" alt="Hot dog prensado" /></section><section class="mobile-login-card ${isLogged() ? 'logged' : ''}">${isLogged() ? `<strong>✅ Pedido liberado</strong><p>Comprando como <b>${profile?.name || 'cliente'}</b>.</p>` : '<strong>🔒 Entre para pedir</strong><p>O pedido só finaliza com cadastro. Seu endereço fica salvo para as próximas compras.</p><button type="button" data-account>Entrar / cadastrar</button>'}</section><nav class="mobile-category-tabs"><button class="${mobileOrder.category === 'todos' ? 'active' : ''}" data-cat="todos">Todos</button>${mobileOrder.menu.categories.map((cat) => `<button class="${String(mobileOrder.category) === String(cat.id) ? 'active' : ''}" data-cat="${cat.id}">${cat.name}</button>`).join('')}</nav><section class="mobile-product-list">${mobileOrder.loaded ? visibleProducts().map(productCard).join('') : '<div class="mobile-loading">Carregando cardápio...</div>'}</section><section class="mobile-order-cart"><div class="mobile-cart-head"><div><span>${count} item(ns)</span><h2>Seu pedido</h2></div><strong>${brl(total())}</strong></div>${mobileOrder.cart.length ? mobileOrder.cart.map(cartLine).join('') : '<div class="mobile-empty-cart">Adicione produtos para começar.</div>'}<form class="mobile-checkout-form"><div class="mobile-choice"><button type="button" class="${mobileOrder.delivery === 'entrega' ? 'active' : ''}" data-delivery="entrega">Entrega</button><button type="button" class="${mobileOrder.delivery === 'retirada' ? 'active' : ''}" data-delivery="retirada">Retirada</button></div><select data-payment><option value="dinheiro" ${mobileOrder.payment === 'dinheiro' ? 'selected' : ''}>Dinheiro</option><option value="pix" ${mobileOrder.payment === 'pix' ? 'selected' : ''}>PIX</option><option value="cartao" ${mobileOrder.payment === 'cartao' ? 'selected' : ''}>Cartão</option><option value="fiado" ${mobileOrder.payment === 'fiado' ? 'selected' : ''}>Fiado</option></select>${mobileOrder.payment === 'dinheiro' ? '<input data-mobile-change type="number" step="0.01" placeholder="Troco para quanto?" />' : ''}<textarea data-mobile-notes placeholder="Observações do pedido"></textarea><div class="mobile-total-box"><span>Subtotal <b>${brl(subtotal())}</b></span><span>Entrega <b>${brl(deliveryFee())}</b></span><strong>Total <b>${brl(total())}</b></strong></div><button class="mobile-send-order" type="submit">${isLogged() ? 'Finalizar pedido' : 'Entrar para finalizar'}</button>${message ? `<p class="mobile-order-message">${message}</p>` : ''}</form></section><div class="mobile-bottom-bar"><button type="button" data-menu>Cardápio</button><button type="button" data-cart>Pedido • ${brl(total())}</button></div>`;
  root.querySelector('[data-back]').addEventListener('click', () => { window.location.href = '/'; });
  root.querySelectorAll('[data-account]').forEach((btn) => btn.addEventListener('click', openAccount));
  root.querySelectorAll('[data-cat]').forEach((btn) => btn.addEventListener('click', () => { mobileOrder.category = btn.dataset.cat; renderMobilePage(); }));
  root.querySelectorAll('[data-add-product]').forEach((btn) => btn.addEventListener('click', () => addProduct(btn.dataset.addProduct)));
  root.querySelectorAll('[data-qty]').forEach((btn) => btn.addEventListener('click', () => changeQty(btn.dataset.qty, Number(btn.dataset.delta))));
  root.querySelectorAll('[data-extra-key]').forEach((btn) => btn.addEventListener('click', () => addExtra(btn.dataset.extraKey, btn.dataset.extraId)));
  root.querySelectorAll('[data-delivery]').forEach((btn) => btn.addEventListener('click', () => { mobileOrder.delivery = btn.dataset.delivery; renderMobilePage(); }));
  root.querySelector('[data-payment]')?.addEventListener('change', (event) => { mobileOrder.payment = event.target.value; renderMobilePage(); });
  root.querySelector('.mobile-checkout-form')?.addEventListener('submit', sendMobileOrder);
  root.querySelector('[data-menu]')?.addEventListener('click', () => root.querySelector('.mobile-product-list')?.scrollIntoView({ behavior: 'smooth' }));
  root.querySelector('[data-cart]')?.addEventListener('click', () => root.querySelector('.mobile-order-cart')?.scrollIntoView({ behavior: 'smooth' }));
}

async function bootMobileOrder() {
  if (mobileOrder.booted || !isMobileOrderRoute()) return;
  mobileOrder.booted = true;
  renderMobilePage('Carregando cardápio...');
  await loadMobileData();
  renderMobilePage('');
}

bootMobileOrder();
