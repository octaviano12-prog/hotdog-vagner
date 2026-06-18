const guidedOrder = { booted: false, step: 1, touched: false, observer: null, raf: 0 };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function cardKind(card) {
  const label = card.querySelector('span')?.textContent?.trim().toLowerCase() || '';
  const title = card.querySelector('h3')?.textContent?.trim().toLowerCase() || '';
  if (label.includes('bebida') || label.includes('suco') || title.includes('refrigerante') || title.includes('suco')) return 'drink';
  if (label.includes('hotdog') || label.includes('hot dog') || title.includes('hot dog') || title.includes('lanche')) return 'snack';
  return 'other';
}

function hasCartItems() {
  const text = document.querySelector('.mobile-cart-head span')?.textContent || '';
  return !text.startsWith('0 item');
}

function hasSnackInCart() {
  return [...document.querySelectorAll('.mobile-cart-line strong')].some((node) => /hot dog|lanche|x-|x\s/i.test(node.textContent || ''));
}

function scheduleApply() {
  cancelAnimationFrame(guidedOrder.raf);
  guidedOrder.raf = requestAnimationFrame(applyGuidedFlow);
}

function setStep(step) {
  guidedOrder.step = Math.max(1, Math.min(4, Number(step) || 1));
  guidedOrder.touched = true;
  scheduleApply();
}

function inferredStep() {
  if (!hasCartItems()) return 1;
  if (!guidedOrder.touched) return hasSnackInCart() ? 2 : 1;
  return guidedOrder.step;
}

function stepInfo(step) {
  const data = {
    1: ['Etapa 1 de 4', 'Escolha seu lanche', 'Comece pelo hot dog prensado. Depois o sistema mostra adicionais e bebida.'],
    2: ['Etapa 2 de 4', 'Personalize seu lanche', 'Escolha adicionais, se quiser. Depois continue para a bebida.'],
    3: ['Etapa 3 de 4', 'Quer uma bebida?', 'Escolha refrigerante ou suco. Se não quiser, avance para finalizar.'],
    4: ['Etapa 4 de 4', 'Revise e finalize', 'Confira entrega, pagamento e envie seu pedido.']
  };
  return data[step] || data[1];
}

function ensurePanel() {
  let panel = document.querySelector('.mobile-guided-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'mobile-guided-panel';
    const login = document.querySelector('.mobile-login-card');
    const hero = document.querySelector('.mobile-order-hero');
    (login || hero)?.insertAdjacentElement('afterend', panel);
  }
  return panel;
}

function renderPanel(step) {
  const panel = ensurePanel();
  const [eyebrow, title, text] = stepInfo(step);
  panel.innerHTML = `
    <div class="guided-progress"><i class="${step >= 1 ? 'done' : ''}"></i><i class="${step >= 2 ? 'done' : ''}"></i><i class="${step >= 3 ? 'done' : ''}"></i><i class="${step >= 4 ? 'done' : ''}"></i></div>
    <span>${eyebrow}</span>
    <h2>${title}</h2>
    <p>${text}</p>
    <div class="guided-actions">
      ${step > 1 ? '<button type="button" data-guided-prev>Voltar</button>' : ''}
      ${step === 2 ? '<button type="button" data-guided-next>Continuar para bebida</button>' : ''}
      ${step === 3 ? '<button type="button" data-guided-next>Não quero bebida</button>' : ''}
      ${step === 4 ? '<button type="button" data-guided-menu>Adicionar mais itens</button>' : ''}
    </div>
  `;
  panel.querySelector('[data-guided-prev]')?.addEventListener('click', () => setStep(step - 1));
  panel.querySelector('[data-guided-next]')?.addEventListener('click', () => setStep(step + 1));
  panel.querySelector('[data-guided-menu]')?.addEventListener('click', () => setStep(1));
}

function filterProducts(step) {
  const cards = [...document.querySelectorAll('.mobile-product-card')];
  cards.forEach((card) => {
    const kind = cardKind(card);
    const show = step === 1 ? kind === 'snack' : step === 3 ? kind === 'drink' : false;
    card.classList.toggle('guided-hidden-product', !show);
  });
  document.body.classList.toggle('guided-hide-products', step === 2 || step === 4);
  document.body.classList.toggle('guided-products-ready', cards.length > 0 || step === 2 || step === 4);
}

function focusCorrectArea(step) {
  if (!guidedOrder.touched) return;
  const target = step === 2 || step === 4 ? document.querySelector('.mobile-order-cart') : document.querySelector('.mobile-product-list');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyGuidedFlow() {
  if (!isMobileOrderRoute()) return;
  const step = inferredStep();
  guidedOrder.step = step;
  document.body.classList.add('mobile-guided-order');
  document.body.dataset.guidedStep = String(step);
  renderPanel(step);
  filterProducts(step);
}

function installClickFlow() {
  if (window.__hotdogGuidedFlowClick) return;
  window.__hotdogGuidedFlowClick = true;
  document.addEventListener('click', (event) => {
    const add = event.target.closest?.('[data-add-product]');
    if (!add || !isMobileOrderRoute()) return;
    const card = add.closest('.mobile-product-card');
    const kind = cardKind(card);
    if (kind === 'snack') setTimeout(() => { setStep(2); focusCorrectArea(2); }, 120);
    if (kind === 'drink') setTimeout(() => { setStep(4); focusCorrectArea(4); }, 120);
  }, true);
}

function installMutationSync() {
  if (guidedOrder.observer) return;
  guidedOrder.observer = new MutationObserver(() => scheduleApply());
  guidedOrder.observer.observe(document.body, { childList: true, subtree: true });
}

function bootGuidedOrder() {
  if (guidedOrder.booted || !isMobileOrderRoute()) return;
  guidedOrder.booted = true;
  document.body.classList.add('mobile-guided-order');
  document.body.dataset.guidedStep = '1';
  installClickFlow();
  installMutationSync();
  applyGuidedFlow();
  setTimeout(applyGuidedFlow, 0);
  setTimeout(applyGuidedFlow, 80);
  setInterval(applyGuidedFlow, 900);
}

bootGuidedOrder();
