const checkoutUx = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function cartHasItems() {
  const head = document.querySelector('.mobile-cart-head span')?.textContent || '';
  return !head.startsWith('0 item');
}

function ensureStepBar() {
  const form = document.querySelector('.mobile-checkout-form');
  if (!form || form.querySelector('.mobile-step-bar')) return;
  const steps = document.createElement('div');
  steps.className = 'mobile-step-bar';
  steps.innerHTML = '<span class="done">1 Produto</span><span>2 Entrega</span><span>3 Pagamento</span><span>4 Finalizar</span>';
  form.insertAdjacentElement('afterbegin', steps);
}

function updateCartState() {
  document.body.classList.toggle('mobile-has-cart', cartHasItems());
}

function ensureQuickSearch() {
  const list = document.querySelector('.mobile-product-list');
  const tabs = document.querySelector('.mobile-category-tabs');
  if (!list || !tabs || document.querySelector('.mobile-quick-search')) return;
  const box = document.createElement('div');
  box.className = 'mobile-quick-search';
  box.innerHTML = '<input type="search" placeholder="Buscar no cardápio" />';
  tabs.insertAdjacentElement('afterend', box);
  const input = box.querySelector('input');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('.mobile-product-card').forEach((card) => {
      const text = card.textContent.toLowerCase();
      card.hidden = q && !text.includes(q);
    });
  });
}

function compactAfterScroll() {
  const compact = window.scrollY > 120;
  document.body.classList.toggle('mobile-scrolled', compact);
}

function enhanceButtons() {
  document.querySelectorAll('.mobile-product-card button[data-add-product]').forEach((button) => {
    if (button.dataset.uxReady) return;
    button.dataset.uxReady = '1';
    button.addEventListener('click', () => {
      button.classList.add('added');
      button.textContent = 'Adicionado';
      setTimeout(() => {
        button.classList.remove('added');
        button.textContent = 'Adicionar';
      }, 900);
    });
  });
}

function bootCheckoutUx() {
  if (checkoutUx.booted || !isMobileOrderRoute()) return;
  checkoutUx.booted = true;
  window.addEventListener('scroll', compactAfterScroll, { passive: true });
  setInterval(() => {
    ensureStepBar();
    updateCartState();
    ensureQuickSearch();
    enhanceButtons();
    compactAfterScroll();
  }, 600);
}

bootCheckoutUx();
