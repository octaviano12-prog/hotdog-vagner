(() => {
  const KEY = "hotdog-vagner-state-v1";
  const pinKey = "hotdog-vagner-admin";
  const statuses = ["novo", "preparo", "entrega", "concluido", "cancelado"];
  const statusLabel = { novo: "Novo", preparo: "Preparo", entrega: "Entrega", concluido: "Concluido", cancelado: "Cancelado" };
  const defaults = {
    settings: {
      businessName: "Hot Dog do Vagner",
      phone: "5518991959898",
      deliveryFee: 2,
      dailyTarget: 500,
      adminPin: "1234",
      pixKey: "(18) 99195-9898",
      address: "Presidente Venceslau - SP",
      open: true,
    },
    products: [
      ["hd-simples", "Hot Dog Simples", "Prensados", 18, 8.5, "hotdog", "Pao prensado, salsicha, molho da casa, batata palha, ketchup, maionese, mostarda, alface e vinagrete."],
      ["hd-tradicional", "Hot Dog Tradicional", "Prensados", 20, 9.25, "hotdog", "Pao prensado, 1 salsicha, alface, molho da casa, batata palha, ketchup, maionese, mostarda, milho e vinagrete."],
      ["hd-especial", "Hot Dog Especial", "Prensados", 22, 10.4, "hotdog", "Pao prensado, 1 salsicha, bacon, queijo, molho da casa, batata palha, ketchup, maionese, mostarda, milho, alface e vinagrete."],
      ["hd-completo", "Hot Dog Completo", "Prensados", 28, 14.5, "hotdog", "Pao prensado, 2 salsichas, molho especial, queijo, bacon, calabresa, batata palha, catupiry, milho, pure, alface e vinagrete."],
      ["carne", "Carne", "Especiais", 15, 7.3, "hotdog", "Salsicha bovina, molho de carne, alface, vinagrete e batata palha."],
      ["frango", "Frango", "Especiais", 15, 7.1, "hotdog", "Salsicha bovina, frango desfiado, alface e vinagrete."],
      ["misto", "Misto", "Especiais", 17, 8.6, "hotdog", "Salsicha, molho de carne, frango desfiado, alface, vinagrete e batata palha."],
      ["duplo-pure", "Duplo com Pure", "Especiais", 20, 10.1, "hotdog", "Duas salsichas, pure, alface, vinagrete e batata palha."],
      ["suco-500", "Suco Natural 500 ml", "Sucos", 8, 3.4, "juice", "Laranja, morango, maracuja, abacaxi com hortela, abacaxi, acerola, uva ou limao."],
      ["suco-jarra", "Jarra de Suco 1 litro", "Sucos", 15, 6.2, "juice", "Suco natural preparado na hora. Sabores sujeitos a disponibilidade."],
      ["refrigerante-mini", "Coca-Cola Mini", "Bebidas", 4, 2.2, "drink", "Lata mini 200 ml gelada."],
      ["refrigerante-lata", "Refrigerante Lata", "Bebidas", 6, 3.25, "drink", "Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva 350 ml."],
      ["refrigerante-600", "Refrigerante 600 ml", "Bebidas", 8, 4.7, "drink", "Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva."],
      ["refrigerante-2l", "Refrigerante 2 litros", "Bebidas", 14, 8.1, "drink", "Coca-Cola, Guarana, Fanta Laranja ou Fanta Uva."],
      ["adicional-catupiry", "Catupiry", "Adicionais", 2, 0.75, "side", "Adicional unitario para qualquer hot dog."],
      ["adicional-cheddar", "Cheddar", "Adicionais", 2, 0.75, "side", "Adicional unitario para qualquer hot dog."],
      ["adicional-queijo", "Queijo", "Adicionais", 2, 0.8, "side", "Adicional unitario para qualquer hot dog."],
      ["adicional-salsicha", "Salsicha", "Adicionais", 2, 1.05, "side", "Adicional unitario para qualquer hot dog."],
      ["adicional-bacon", "Bacon", "Adicionais", 2, 1.2, "side", "Adicional unitario para qualquer hot dog."],
      ["adicional-calabresa", "Calabresa", "Adicionais", 2, 1.05, "side", "Adicional unitario para qualquer hot dog."],
    ].map(([id, name, category, price, cost, art, description]) => ({ id, name, category, price, cost, art, description, active: true })),
    orders: [],
    expenses: [],
  };

  let state = load();
  let cart = [];
  let ui = { view: "cardapio", category: "Todos", query: "", mode: "entrega", orderFilter: "todos" };
  let refs = {};
  let toastTimer;

  document.addEventListener("DOMContentLoaded", () => {
    refs = mapRefs();
    refs.spotlightArt.innerHTML = artwork("hotdog", "Prensado");
    refs.expenseDate.value = today();
    bind();
    fillSettings();
    resetProductForm();
    render();
  });

  function mapRefs() {
    return {
      nav: $(".main-nav"), views: $$(".view"), navButtons: $$(".nav-button"),
      search: $("#product-search"), filters: $("#category-filters"), grid: $("#product-grid"),
      cartItems: $("#cart-items"), cartTotals: $("#cart-totals"), clearCart: $("#clear-cart"),
      orderForm: $("#order-form"), deliveryMode: $("#delivery-mode"), addressField: $("#address-field"),
      orderBoard: $("#order-board"), orderFilter: $("#order-status-filter"), printOrders: $("#print-orders"),
      metrics: $("#finance-metrics"), bars: $("#category-bars"), cashflow: $("#cashflow-table"),
      expenseForm: $("#expense-form"), expenseDate: $("#expense-date"), expenseCategory: $("#expense-category"),
      expenseAmount: $("#expense-amount"), expenseDescription: $("#expense-description"),
      exportCsv: $("#export-csv"), backupJson: $("#backup-json"), restoreJson: $("#restore-json"),
      resetData: $("#reset-data"), productForm: $("#product-form"), productTable: $("#product-table"),
      productId: $("#product-id"), productName: $("#product-name"), productCategory: $("#product-category"),
      productPrice: $("#product-price"), productCost: $("#product-cost"), productArt: $("#product-art"),
      productDescription: $("#product-description"), productActive: $("#product-active"), newProduct: $("#new-product"),
      settingsForm: $("#settings-form"), settingBusiness: $("#setting-business"), settingPhone: $("#setting-phone"),
      settingDelivery: $("#setting-delivery"), settingTarget: $("#setting-target"), settingPin: $("#setting-pin"),
      settingPix: $("#setting-pix"), settingAddress: $("#setting-address"), settingOpen: $("#setting-open"),
      toast: $("#toast"), spotlightArt: $("#spotlight-art"),
    };
  }

  function bind() {
    refs.nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) setView(button.dataset.view);
    });
    refs.search.addEventListener("input", (event) => { ui.query = event.target.value; renderProducts(); icons(); });
    refs.filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      ui.category = button.dataset.category;
      renderFilters(); renderProducts(); icons();
    });
    refs.grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-add-product]");
      if (button) addToCart(button.dataset.addProduct);
    });
    refs.cartItems.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cart-action]");
      if (button) changeQty(button.dataset.productId, button.dataset.cartAction);
    });
    refs.clearCart.addEventListener("click", () => { cart = []; renderCart(); toast("Pedido limpo."); });
    refs.deliveryMode.addEventListener("change", (event) => { ui.mode = event.target.value; syncDelivery(); renderCart(); });
    refs.orderForm.addEventListener("submit", (event) => { event.preventDefault(); placeOrder(); });
    refs.orderFilter.addEventListener("change", (event) => { ui.orderFilter = event.target.value; renderOrders(); icons(); });
    refs.orderBoard.addEventListener("click", (event) => {
      const button = event.target.closest("[data-order-action]");
      if (button) orderAction(button.dataset.orderId, button.dataset.orderAction);
    });
    refs.printOrders.addEventListener("click", () => window.print());
    refs.expenseForm.addEventListener("submit", (event) => { event.preventDefault(); addExpense(); });
    refs.exportCsv.addEventListener("click", exportCsv);
    refs.backupJson.addEventListener("click", () => download(JSON.stringify(state, null, 2), `backup-hotdog-vagner-${today()}.json`, "application/json"));
    refs.restoreJson.addEventListener("change", restoreBackup);
    refs.resetData.addEventListener("click", () => {
      if (!confirm("Restaurar exemplo e limpar pedidos, despesas e alteracoes?")) return;
      state = freshState(); cart = []; save(); fillSettings(); resetProductForm(); render(); toast("Dados de exemplo restaurados.");
    });
    refs.newProduct.addEventListener("click", () => { resetProductForm(); refs.productName.focus(); });
    refs.productForm.addEventListener("submit", (event) => { event.preventDefault(); saveProduct(); });
    refs.productTable.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit-product]");
      const remove = event.target.closest("[data-delete-product]");
      if (edit) editProduct(edit.dataset.editProduct);
      if (remove) deleteProduct(remove.dataset.deleteProduct);
    });
    refs.settingsForm.addEventListener("submit", (event) => { event.preventDefault(); saveSettings(); });
  }

  function setView(view) {
    if (["pedidos", "financeiro", "gestao"].includes(view) && sessionStorage.getItem(pinKey) !== "true") {
      const pin = prompt("Digite o PIN administrativo");
      if (pin !== String(state.settings.adminPin || "1234")) return toast("PIN incorreto.");
      sessionStorage.setItem(pinKey, "true");
    }
    ui.view = view;
    refs.navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
    refs.views.forEach((section) => section.classList.toggle("is-active", section.id === `view-${view}`));
    renderFinance(); icons();
  }

  function render() {
    applySettings(); syncDelivery(); renderFilters(); renderProducts(); renderCart(); renderOrders(); renderFinance(); renderAdmin(); icons();
  }

  function applySettings() {
    $$("[data-business-name]").forEach((el) => { el.textContent = state.settings.businessName; });
    const status = $("[data-store-status]");
    status.textContent = state.settings.open ? "Aberto" : "Fechado";
    status.classList.toggle("is-closed", !state.settings.open);
    $("[data-delivery-fee]").textContent = money(state.settings.deliveryFee);
    $("[data-phone-display]").textContent = phoneView(state.settings.phone);
    $("[data-whatsapp-link]").href = `https://wa.me/${phoneDigits(state.settings.phone)}`;
  }

  function renderFilters() {
    const cats = ["Todos", ...new Set(state.products.map((p) => p.category))];
    refs.filters.innerHTML = cats.map((cat) => `<button class="category-button ${cat === ui.category ? "is-active" : ""}" type="button" data-category="${esc(cat)}">${esc(cat)}</button>`).join("");
  }

  function renderProducts() {
    const query = clean(ui.query);
    const list = state.products
      .filter((p) => p.active !== false)
      .filter((p) => ui.category === "Todos" || p.category === ui.category)
      .filter((p) => !query || clean(`${p.name} ${p.category} ${p.description}`).includes(query));
    refs.grid.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty-state">Nenhum item encontrado.</div>`;
  }

  function productCard(p) {
    return `<article class="product-card">
      <div class="product-visual" aria-hidden="true">${artwork(p.art, p.name)}</div>
      <div class="product-content">
        <div>
          <div class="product-meta"><span class="product-category">${esc(p.category)}</span><span class="price">${money(p.price)}</span></div>
          <h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>
        </div>
        <div class="card-actions">
          <span class="stock-note">${p.category === "Bebidas" ? "Gelado" : p.category === "Sucos" ? "Natural" : p.category === "Adicionais" ? "R$ 2 cada" : "Feito na hora"}</span>
          <button class="add-button" type="button" data-add-product="${esc(p.id)}"><i data-lucide="plus"></i><span>Adicionar</span></button>
        </div>
      </div>
    </article>`;
  }

  function addToCart(id) {
    const product = findProduct(id);
    const item = cart.find((line) => line.id === id);
    if (item) item.qty += 1; else cart.push({ id, qty: 1 });
    renderCart(); icons(); toast(`${product.name} adicionado.`);
  }

  function changeQty(id, action) {
    const item = cart.find((line) => line.id === id);
    if (!item) return;
    if (action === "increase") item.qty += 1;
    if (action === "decrease") item.qty -= 1;
    if (action === "remove" || item.qty <= 0) cart = cart.filter((line) => line.id !== id);
    renderCart(); icons();
  }

  function cartData() {
    const items = cart.map((line) => {
      const p = findProduct(line.id);
      return { productId: p.id, name: p.name, category: p.category, price: Number(p.price), cost: Number(p.cost), quantity: Number(line.qty) };
    });
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    const cost = items.reduce((n, i) => n + i.cost * i.quantity, 0);
    const deliveryFee = ui.mode === "entrega" ? Number(state.settings.deliveryFee) : 0;
    return { items, subtotal, cost, deliveryFee, total: subtotal + deliveryFee };
  }

  function renderCart() {
    const data = cartData();
    refs.cartItems.innerHTML = data.items.length ? data.items.map((i) => `<div class="cart-line">
      <div><strong>${esc(i.name)}</strong><small>${i.quantity} x ${money(i.price)} = ${money(i.price * i.quantity)}</small></div>
      <div class="quantity-control">
        <button type="button" data-cart-action="decrease" data-product-id="${esc(i.productId)}" aria-label="Diminuir"><i data-lucide="minus"></i></button>
        <strong>${i.quantity}</strong>
        <button type="button" data-cart-action="increase" data-product-id="${esc(i.productId)}" aria-label="Aumentar"><i data-lucide="plus"></i></button>
        <button type="button" data-cart-action="remove" data-product-id="${esc(i.productId)}" aria-label="Remover"><i data-lucide="x"></i></button>
      </div>
    </div>`).join("") : `<div class="empty-state">Carrinho vazio.</div>`;
    refs.cartTotals.innerHTML = `<div class="total-line"><span>Subtotal</span><strong>${money(data.subtotal)}</strong></div>
      <div class="total-line"><span>Entrega</span><strong>${money(data.deliveryFee)}</strong></div>
      <div class="total-line total"><span>Total</span><strong>${money(data.total)}</strong></div>`;
    $("#place-order").disabled = !data.items.length;
  }

  function syncDelivery() {
    const on = ui.mode === "entrega";
    refs.addressField.style.display = on ? "grid" : "none";
    $("#customer-address").required = on;
  }

  function placeOrder() {
    const data = cartData();
    if (!data.items.length) return toast("Adicione pelo menos um item.");
    if (!refs.orderForm.reportValidity()) return;
    const order = {
      id: newId("PED"), createdAt: new Date().toISOString(), status: "novo",
      customerName: $("#customer-name").value.trim(), customerPhone: $("#customer-phone").value.trim(),
      customerAddress: $("#customer-address").value.trim(), deliveryMode: ui.mode,
      paymentMethod: $("#payment-method").value, changeFor: $("#change-for").value.trim(), notes: $("#order-notes").value.trim(),
      ...data,
    };
    state.orders.unshift(order); save(); cart = []; refs.orderForm.reset(); ui.mode = "entrega";
    refs.deliveryMode.querySelector('[value="entrega"]').checked = true;
    render(); openWhatsApp(order); toast("Pedido registrado.");
  }

  function renderOrders() {
    const list = state.orders.filter((o) => ui.orderFilter === "todos" || o.status === ui.orderFilter);
    refs.orderBoard.innerHTML = statuses.map((status) => {
      const orders = list.filter((o) => o.status === status);
      return `<section class="order-column"><div class="order-column-header"><strong>${statusLabel[status]}</strong><span class="order-count">${orders.length}</span></div>
        <div class="order-list">${orders.length ? orders.map(orderCard).join("") : `<div class="empty-state">Sem pedidos.</div>`}</div></section>`;
    }).join("");
  }

  function orderCard(o) {
    const canMove = !["concluido", "cancelado"].includes(o.status);
    return `<article class="order-card"><header><div><strong>#${esc(o.id)}</strong><small>${dateTime(o.createdAt)}</small></div><span class="order-status">${statusLabel[o.status]}</span></header>
      <div><strong>${esc(o.customerName)}</strong><small>${esc(phoneView(o.customerPhone))} | ${o.deliveryMode === "entrega" ? "Entrega" : "Retirada"}</small></div>
      <div class="order-items">${o.items.map((i) => `<span>${i.quantity}x ${esc(i.name)}</span>`).join("")}</div>
      <div class="total-line total"><span>Total</span><strong>${money(o.total)}</strong></div><span class="payment-tag">${esc(o.paymentMethod)}</span>
      <div class="order-actions">
        ${canMove ? `<button class="mini-button" type="button" data-order-action="advance" data-order-id="${esc(o.id)}">Avancar</button><button class="mini-button" type="button" data-order-action="finish" data-order-id="${esc(o.id)}">Concluir</button>` : ""}
        <button class="mini-button" type="button" data-order-action="whatsapp" data-order-id="${esc(o.id)}">WhatsApp</button>
        ${canMove ? `<button class="mini-button" type="button" data-order-action="cancel" data-order-id="${esc(o.id)}">Cancelar</button>` : ""}
      </div></article>`;
  }

  function orderAction(id, action) {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;
    if (action === "whatsapp") return openWhatsApp(order);
    if (action === "cancel" && !confirm(`Cancelar pedido #${order.id}?`)) return;
    if (action === "advance") order.status = order.status === "novo" ? "preparo" : order.status === "preparo" ? (order.deliveryMode === "entrega" ? "entrega" : "concluido") : "concluido";
    if (action === "finish") order.status = "concluido";
    if (action === "cancel") order.status = "cancelado";
    save(); renderOrders(); renderFinance(); toast(`Pedido #${order.id} atualizado.`);
  }

  function renderFinance() {
    const day = today();
    const valid = state.orders.filter((o) => o.status !== "cancelado");
    const orders = valid.filter((o) => today(new Date(o.createdAt)) === day);
    const expenses = state.expenses.filter((e) => e.date === day);
    const revenue = sum(orders, "total"), cost = sum(orders, "cost"), out = sum(expenses, "amount");
    const profit = revenue - cost - out, avg = orders.length ? revenue / orders.length : 0;
    const target = Number(state.settings.dailyTarget || 0), pct = target ? Math.min(100, Math.round((revenue / target) * 100)) : 0;
    refs.metrics.innerHTML = [
      ["Faturamento hoje", money(revenue), `${orders.length} pedidos`],
      ["Lucro estimado", money(profit), `Custos ${money(cost)} | Saidas ${money(out)}`],
      ["Ticket medio", money(avg), "Pedidos validos"],
      ["Meta diaria", `${pct}%`, `${money(revenue)} de ${money(target)}`],
    ].map((m) => `<article class="metric-card"><span>${m[0]}</span><strong>${m[1]}</strong><small>${m[2]}</small></article>`).join("");
    renderBars(orders); renderCashflow(valid);
  }

  function renderBars(orders) {
    const byCat = {};
    orders.forEach((o) => o.items.forEach((i) => { byCat[i.category] = (byCat[i.category] || 0) + i.price * i.quantity; }));
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    refs.bars.innerHTML = rows.length ? rows.map(([cat, value]) => `<div class="bar-row"><header><span>${esc(cat)}</span><strong>${money(value)}</strong></header><div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div></div>`).join("") : `<div class="empty-state">Sem vendas hoje.</div>`;
  }

  function renderCashflow(orders) {
    const rows = [
      ...orders.map((o) => [o.createdAt, "Entrada", `#${o.id} | ${o.customerName}`, o.paymentMethod, o.total]),
      ...state.expenses.map((e) => [`${e.date}T12:00:00`, "Saida", e.description, e.category, -Math.abs(e.amount)]),
    ].sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 80);
    refs.cashflow.innerHTML = rows.length ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${dateTime(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${money(r[4])}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-state">Sem movimento registrado.</div>`;
  }

  function addExpense() {
    const amount = Number(refs.expenseAmount.value);
    if (!amount || amount <= 0 || !refs.expenseForm.reportValidity()) return;
    state.expenses.unshift({ id: newId("DSP"), date: refs.expenseDate.value || today(), category: refs.expenseCategory.value, description: refs.expenseDescription.value.trim(), amount });
    save(); refs.expenseDescription.value = ""; refs.expenseAmount.value = ""; renderFinance(); toast("Despesa lancada.");
  }

  function renderAdmin() {
    const rows = [...state.products].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    refs.productTable.innerHTML = `<table><thead><tr><th>Produto</th><th>Categoria</th><th>Preco</th><th>Custo</th><th>Margem</th><th>Status</th><th>Acoes</th></tr></thead><tbody>${rows.map((p) => {
      const margin = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
      return `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${money(p.cost)}</td><td>${margin}%</td><td>${p.active === false ? "Inativo" : "Ativo"}</td><td><span class="table-actions"><button class="mini-button" type="button" data-edit-product="${esc(p.id)}">Editar</button><button class="mini-button" type="button" data-delete-product="${esc(p.id)}">Remover</button></span></td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function saveProduct() {
    if (!refs.productForm.reportValidity()) return;
    const product = {
      id: refs.productId.value || newId("PRD"), name: refs.productName.value.trim(), category: refs.productCategory.value,
      price: Number(refs.productPrice.value), cost: Number(refs.productCost.value), art: refs.productArt.value,
      description: refs.productDescription.value.trim(), active: refs.productActive.checked,
    };
    const index = state.products.findIndex((p) => p.id === product.id);
    if (index >= 0) state.products[index] = product; else state.products.push(product);
    save(); resetProductForm(); render(); toast("Produto salvo.");
  }

  function editProduct(id) {
    const p = findProduct(id);
    refs.productId.value = p.id; refs.productName.value = p.name; refs.productCategory.value = p.category;
    refs.productPrice.value = p.price; refs.productCost.value = p.cost; refs.productArt.value = p.art;
    refs.productDescription.value = p.description; refs.productActive.checked = p.active !== false; refs.productName.focus();
  }

  function deleteProduct(id) {
    const p = findProduct(id);
    if (!confirm(`Remover ${p.name} do cardapio?`)) return;
    state.products = state.products.filter((item) => item.id !== id);
    cart = cart.filter((item) => item.id !== id);
    save(); resetProductForm(); render(); toast("Produto removido.");
  }

  function resetProductForm() {
    refs.productForm.reset(); refs.productId.value = ""; refs.productCategory.value = "Prensados";
    refs.productArt.value = "hotdog"; refs.productActive.checked = true;
  }

  function fillSettings() {
    refs.settingBusiness.value = state.settings.businessName; refs.settingPhone.value = state.settings.phone;
    refs.settingDelivery.value = state.settings.deliveryFee; refs.settingTarget.value = state.settings.dailyTarget;
    refs.settingPin.value = state.settings.adminPin || "1234"; refs.settingPix.value = state.settings.pixKey || "";
    refs.settingAddress.value = state.settings.address || ""; refs.settingOpen.checked = state.settings.open;
  }

  function saveSettings() {
    state.settings = {
      ...state.settings, businessName: refs.settingBusiness.value.trim(), phone: refs.settingPhone.value.trim(),
      deliveryFee: Number(refs.settingDelivery.value), dailyTarget: Number(refs.settingTarget.value),
      adminPin: refs.settingPin.value.trim() || "1234", pixKey: refs.settingPix.value.trim(),
      address: refs.settingAddress.value.trim(), open: refs.settingOpen.checked,
    };
    save(); render(); toast("Configuracoes salvas.");
  }

  function openWhatsApp(order) {
    window.open(`https://wa.me/${phoneDigits(state.settings.phone)}?text=${encodeURIComponent(waText(order))}`, "_blank", "noopener,noreferrer");
  }

  function waText(order) {
    const lines = [`*${state.settings.businessName}*`, `Pedido #${order.id}`, "", `Cliente: ${order.customerName}`, `Telefone: ${phoneView(order.customerPhone)}`, `Modo: ${order.deliveryMode === "entrega" ? "Entrega" : "Retirada"}`];
    if (order.deliveryMode === "entrega") lines.push(`Endereco: ${order.customerAddress}`);
    lines.push("", "*Itens*", ...order.items.map((i) => `${i.quantity}x ${i.name} - ${money(i.price * i.quantity)}`), "", `Subtotal: ${money(order.subtotal)}`, `Entrega: ${money(order.deliveryFee)}`, `Total: ${money(order.total)}`, `Pagamento: ${order.paymentMethod}`);
    if (order.changeFor) lines.push(`Troco: ${order.changeFor}`);
    if (state.settings.pixKey) lines.push(`Pix: ${state.settings.pixKey}`);
    if (order.notes) lines.push(`Obs: ${order.notes}`);
    return lines.join("\n");
  }

  function exportCsv() {
    const rows = [["data", "tipo", "descricao", "categoria", "valor", "status"]];
    state.orders.forEach((o) => rows.push([dateTime(o.createdAt), "pedido", `#${o.id} ${o.customerName}`, o.paymentMethod, num(o.total), o.status]));
    state.expenses.forEach((e) => rows.push([e.date, "despesa", e.description, e.category, num(-Math.abs(e.amount)), "lancada"]));
    download(rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n"), `financeiro-hotdog-vagner-${today()}.csv`, "text/csv;charset=utf-8");
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.settings || !Array.isArray(parsed.products)) throw new Error("Formato invalido");
        state = { settings: { ...defaults.settings, ...parsed.settings }, products: parsed.products, orders: parsed.orders || [], expenses: parsed.expenses || [] };
        cart = []; save(); fillSettings(); resetProductForm(); render(); toast("Backup restaurado.");
      } catch { toast("Backup invalido."); }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  function artwork(kind, label) {
    const sauce = kind === "drink" ? "#c81726" : kind === "juice" ? "#f05a28" : kind === "side" ? "#ffd66b" : "#d88726";
    if (kind === "drink") return `<svg viewBox="0 0 260 160" role="img" aria-label="${esc(label)}"><rect x="82" y="24" width="58" height="112" rx="13" fill="#c81726" stroke="#ffefc7" stroke-width="5"/><rect x="151" y="36" width="42" height="90" rx="11" fill="#2c9b4f" stroke="#ffefc7" stroke-width="5"/><circle cx="205" cy="48" r="13" fill="#f7b733"/><circle cx="211" cy="94" r="18" fill="#7d3cb5"/></svg>`;
    if (kind === "juice") return `<svg viewBox="0 0 260 160" role="img" aria-label="${esc(label)}"><rect x="78" y="26" width="62" height="104" rx="11" fill="#f5a623" stroke="#fff4ce" stroke-width="5"/><circle cx="168" cy="83" r="38" fill="#f05a28"/><circle cx="168" cy="83" r="25" fill="#ffc857"/><path d="M198 40c16 2 25 11 27 26-16-1-27-9-27-26Z" fill="#44b654"/></svg>`;
    if (kind === "side") return `<svg viewBox="0 0 260 160" role="img" aria-label="${esc(label)}"><path d="M70 64h120l-13 59H83z" fill="#d88726" stroke="#fff0c7" stroke-width="5"/><path d="M82 60c8-25 88-25 96 0 2 16-98 16-96 0Z" fill="${sauce}" stroke="#fff0c7" stroke-width="5"/></svg>`;
    return `<svg viewBox="0 0 320 190" role="img" aria-label="${esc(label)}"><ellipse cx="160" cy="151" rx="114" ry="18" fill="#060504" opacity=".38"/><path d="M45 91c16-49 208-56 230-7 12 27-13 53-83 63-80 11-157-13-147-56Z" fill="#d88726" stroke="#ffe0a1" stroke-width="7"/><path d="M83 104c58 23 141 22 181-3" fill="none" stroke="#c81726" stroke-width="12" stroke-linecap="round"/><path d="M87 93c19-14 36-15 52-3 18-16 39-15 59 0 17-13 35-14 55-2" fill="none" stroke="#ffe25c" stroke-width="7" stroke-linecap="round"/><path d="M92 115c48 12 100 15 154 4" fill="none" stroke="#44b654" stroke-width="8" stroke-linecap="round"/></svg>`;
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved ? { settings: { ...defaults.settings, ...saved.settings }, products: saved.products?.length ? saved.products : defaults.products, orders: saved.orders || [], expenses: saved.expenses || [] } : freshState();
    } catch { return freshState(); }
  }
  function freshState() { return JSON.parse(JSON.stringify(defaults)); }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function findProduct(id) { return state.products.find((p) => p.id === id); }
  function sum(list, key) { return list.reduce((n, item) => n + Number(item[key] || 0), 0); }
  function money(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
  function num(value) { return Number(value || 0).toFixed(2).replace(".", ","); }
  function today(date = new Date()) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function dateTime(value) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
  function phoneDigits(value) { const digits = String(value || "").replace(/\D/g, ""); return digits.startsWith("55") ? digits : `55${digits}`; }
  function phoneView(value) {
    const d = String(value || "").replace(/\D/g, "").replace(/^55/, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return value || "";
  }
  function newId(prefix) { return `${prefix}${Date.now().toString(36).slice(-5).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  function clean(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
  function $(selector) { return document.querySelector(selector); }
  function $$(selector) { return Array.from(document.querySelectorAll(selector)); }
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function toast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove("is-visible"), 2600);
  }
  function icons() { if (window.lucide) window.lucide.createIcons(); }
})();
