function installAdminBalcaoPreflight() {
  if (!window.location.pathname.includes('admin')) return;
  document.body.classList.add('admin-route', 'admin-balcao-modern');

  if (document.getElementById('admin-balcao-preflight-style')) return;
  const style = document.createElement('style');
  style.id = 'admin-balcao-preflight-style';
  style.textContent = `
    body.admin-balcao-modern .big-form-panel{transition:opacity .16s ease, transform .16s ease;}
    body.admin-balcao-modern .big-form-panel.balcao-pos-panel{opacity:1!important;transform:none!important;}
  `;
  document.head.appendChild(style);
}

installAdminBalcaoPreflight();
