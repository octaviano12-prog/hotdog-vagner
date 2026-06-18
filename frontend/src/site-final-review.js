const siteFinalReview = { booted: false };

function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function customerToken() {
  return localStorage.getItem('hotdog_customer_token') || '';
}

function customerProfile() {
  try {
    return JSON.parse(localStorage.getItem('hotdog_customer_profile') || 'null');
  } catch {
    return null;
  }
}

function isLogged() {
  return Boolean(customerToken() && customerProfile());
}

function removeMobileNoise() {
  if (!isMobileOrderRoute()) return;
  document.querySelectorAll('.track-order-float,.loyalty-mini-badge,.home-v2-sticky-cta,.mobile-premium-shortcuts').forEach((node) => node.remove());
}

function refineMobileHeader() {
  if (!isMobileOrderRoute()) return;
  const header = document.querySelector('.mobile-order-header');
  const account = header?.querySelector('[data-account]');
  const title = header?.querySelector('strong');
  if (!header || !account || !title) return;
  title.textContent = 'Pedido mobile';
  if (isLogged()) {
    account.classList.add('mobile-account-orders-button');
    account.textContent = 'Meus pedidos';
  } else {
    account.classList.remove('mobile-account-orders-button');
    account.textContent = 'Entrar';
  }
}

function refineMobileCart() {
  if (!isMobileOrderRoute()) return;
  const cartCountText = document.querySelector('.mobile-cart-head span')?.textContent || '';
  const hasCart = !cartCountText.startsWith('0 item');
  document.body.classList.toggle('mobile-cart-active', hasCart);
  const cartButton = document.querySelector('.mobile-bottom-bar [data-cart]');
  if (cartButton && !hasCart) cartButton.textContent = 'Pedido';
}

function refineProductCards() {
  if (!isMobileOrderRoute()) return;
  document.querySelectorAll('.mobile-product-card').forEach((card) => {
    card.classList.add('product-ready');
    const button = card.querySelector('[data-add-product]');
    if (button && !button.dataset.finalText) {
      button.dataset.finalText = '1';
      button.innerHTML = '<span>+</span> Adicionar';
    }
  });
}

function refineAccountModal() {
  const modal = document.querySelector('.customer-account-modal');
  if (!modal) return;
  modal.classList.add('account-polished');
}

function bootFinalReview() {
  if (siteFinalReview.booted) return;
  siteFinalReview.booted = true;
  setInterval(() => {
    removeMobileNoise();
    refineMobileHeader();
    refineMobileCart();
    refineProductCards();
    refineAccountModal();
  }, 450);
}

bootFinalReview();
