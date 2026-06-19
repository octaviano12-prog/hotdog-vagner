function isMobileOrderRoute() {
  return ['/pedir', '/pedido-mobile', '/mobile'].some((path) => window.location.pathname === path || window.location.pathname.startsWith(`${path}/`));
}

function installPreflight() {
  if (!isMobileOrderRoute()) return;
  document.body.classList.add('mobile-order-page');
  if (document.getElementById('mobile-preflight-style')) return;
  const style = document.createElement('style');
  style.id = 'mobile-preflight-style';
  style.textContent = `
    body.mobile-order-page{background:#070504!important;}
    body.mobile-order-page #root{display:none!important;}
    body.mobile-order-page .mobile-order-hero .premium-hero-food,
    body.mobile-order-page .mobile-order-hero img:not(.product-image){display:none!important;}
  `;
  document.head.appendChild(style);
}

installPreflight();
