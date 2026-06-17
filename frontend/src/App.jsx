import { useEffect, useMemo, useState } from 'react';
import { LogOut, Plus, ShoppingCart, Trash2, WalletCards } from 'lucide-react';
import { api, clearToken, formatMoney, getToken, setToken } from './api.js';

const statusLabels = {
  novo: 'Novo',
  preparo: 'Em preparo',
  saiu_entrega: 'Saiu para entrega',
  concluido: 'Concluido',
  cancelado: 'Cancelado'
};

const paymentLabels = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartao',
  fiado: 'Fiado'
};

function makeWhatsAppMessage(settings, payload, total) {
  const lines = [
    `Ola, quero fazer um pedido no ${settings?.business_name || 'Hot Dog do Vagner'}:`,
    '',
    ...payload.items.map((item, index) => {
      const extras = item.extraNames?.length ? ` | Adicionais: ${item.extraNames.join(', ')}` : '';
      return `${index + 1}. ${item.quantity}x ${item.name}${extras}`;
    }),
    '',
    `Cliente: ${payload.customer.name}`,
    `Telefone: ${payload.customer.phone}`,
    `Entrega: ${payload.delivery_type === 'entrega' ? 'Entrega' : 'Retirada'}`,
    payload.delivery_type === 'entrega' ? `Endereco: ${payload.customer.address}` : '',
    payload.customer.reference ? `Referencia: ${payload.customer.reference}` : '',
    `Pagamento: ${paymentLabels[payload.payment_method]}`,
    payload.notes ? `Observacoes: ${payload.notes}` : '',
    `Total aproximado: ${formatMoney(total)}`
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
}

function Header({ view, setView, settings }) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Pedidos online</span>
        <h1>{settings?.business_name || 'Hot Dog do Vagner'}</h1>
      </div>
      <nav>
        <button className={view === 'menu' ? 'active' : ''} onClick={() => setView('menu')}>Cardapio</button>
        <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
      </nav>
    </header>
  );
}

function ProductCard({ product, extras, onAdd }) {
  const [selectedExtras, setSelectedExtras] = useState([]);

  function toggleExtra(id) {
    setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <article className="product-card">
      <div className="product-image">🌭</div>
      <div className="product-content">
        <div className="product-title-row">
          <h3>{product.name}</h3>
          <strong>{formatMoney(product.price)}</strong>
        </div>
        <p>{product.description}</p>
        {product.product_type === 'hotdog' && extras.length > 0 && (
          <div className="extras">
            <small>Adicionais</small>
            <div className="extra-grid">
              {extras.map((extra) => (
                <label key={extra.id}>
                  <input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                  {extra.name} +{formatMoney(extra.price)}
                </label>
              ))}
            </div>
          </div>
        )}
        <button className="btn-primary" onClick={() => onAdd(product, selectedExtras)}>Adicionar</button>
      </div>
    </article>
  );
}

function Cart({ cart, setCart, settings }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', reference: '' });
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const deliveryFee = deliveryType === 'entrega' ? Number(settings?.delivery_fee || 0) : 0;
  const total = subtotal + deliveryFee;

  function removeItem(key) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  function updateQty(key, quantity) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  async function sendOrder(event) {
    event.preventDefault();
    if (cart.length === 0) {
      setMessage('Adicione pelo menos um item ao pedido.');
      return;
    }

    const payload = {
      customer,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      notes,
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        extras: item.extras.map((extra) => extra.id),
        notes: ''
      }))
    };

    setLoading(true);
    setMessage('');
    try {
      const response = await api.post('/api/orders', payload);
      const whatsappPayload = {
        ...payload,
        items: cart.map((item) => ({
          ...item,
          extraNames: item.extras.map((extra) => extra.name)
        }))
      };
      const whatsapp = settings?.whatsapp || '5518991959898';
      const url = `https://wa.me/${whatsapp}?text=${makeWhatsAppMessage(settings, whatsappPayload, response.order.total)}`;
      setMessage(`Pedido #${response.order.id} criado com sucesso.`);
      setCart([]);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="cart-panel">
      <div className="cart-title"><ShoppingCart size={22} /> <h2>Meu pedido</h2></div>
      {cart.length === 0 ? <p className="muted">Seu carrinho esta vazio.</p> : (
        <div className="cart-items">
          {cart.map((item) => (
            <div className="cart-item" key={item.key}>
              <div>
                <strong>{item.name}</strong>
                {item.extras.length > 0 && <small>+ {item.extras.map((extra) => extra.name).join(', ')}</small>}
              </div>
              <div className="qty">
                <button onClick={() => updateQty(item.key, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQty(item.key, item.quantity + 1)}>+</button>
              </div>
              <button className="icon-btn" onClick={() => removeItem(item.key)}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="totals">
        <span>Subtotal</span><strong>{formatMoney(subtotal)}</strong>
        <span>Entrega</span><strong>{formatMoney(deliveryFee)}</strong>
        <span>Total</span><strong>{formatMoney(total)}</strong>
      </div>

      <form className="checkout" onSubmit={sendOrder}>
        <input placeholder="Nome do cliente" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
        <input placeholder="WhatsApp" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} required />
        <select value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
          <option value="entrega">Entrega</option>
          <option value="retirada">Retirada no balcao</option>
        </select>
        {deliveryType === 'entrega' && (
          <>
            <input placeholder="Endereco de entrega" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} required />
            <input placeholder="Ponto de referencia" value={customer.reference} onChange={(e) => setCustomer({ ...customer, reference: e.target.value })} />
          </>
        )}
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao">Cartao</option>
          <option value="fiado">Fiado</option>
        </select>
        <textarea placeholder="Observacoes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Finalizar pedido'}</button>
        {message && <p className="notice">{message}</p>}
      </form>
    </aside>
  );
}

function MenuPage({ settings }) {
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/public/menu')
      .then(setMenu)
      .catch(() => setMenu({ categories: [], products: [] }))
      .finally(() => setLoading(false));
  }, []);

  const extras = useMemo(() => menu.products.filter((product) => product.product_type === 'adicional'), [menu.products]);

  function addToCart(product, extraIds = []) {
    const selectedExtras = extras.filter((extra) => extraIds.includes(extra.id));
    const key = `${product.id}-${selectedExtras.map((extra) => extra.id).sort().join('-')}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, key, quantity: 1, extras: selectedExtras }];
    });
  }

  return (
    <main className="layout">
      <section className="menu-section">
        <div className="hero">
          <span>🔥 Hot dog prensado</span>
          <h2>Cardapio online com pedido direto no WhatsApp</h2>
          <p>Escolha o lanche, adicione extras, informe a entrega e acompanhe tudo pelo painel administrativo.</p>
        </div>
        {loading && <p className="muted">Carregando cardapio...</p>}
        {menu.categories.map((category) => (
          <section className="category" key={category.id}>
            <div className="section-title">
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
            <div className="product-grid">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} />
              ))}
            </div>
          </section>
        ))}
      </section>
      <Cart cart={cart} setCart={setCart} settings={settings} />
    </main>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@hotdog.com');
  const [password, setPassword] = useState('123456');
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    try {
      const response = await api.post('/api/auth/login', { email, password });
      setToken(response.token);
      onLogin(response.user);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="login-card">
      <h2>Acesso administrativo</h2>
      <p className="muted">Controle pedidos, produtos e financeiro.</p>
      <form onSubmit={submit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" />
        <button className="btn-primary">Entrar</button>
      </form>
      {message && <p className="notice error">{message}</p>}
    </div>
  );
}

function AdminPage() {
  const [logged, setLogged] = useState(Boolean(getToken()));
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expense, setExpense] = useState({ description: '', amount: '', category: 'Geral' });
  const [productForm, setProductForm] = useState({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
  const [message, setMessage] = useState('');

  async function loadAdmin() {
    try {
      const [orderData, productData, categoryData, summaryData] = await Promise.all([
        api.admin.get('/api/admin/orders'),
        api.admin.get('/api/admin/products'),
        api.admin.get('/api/admin/categories'),
        api.admin.get('/api/admin/finance/summary')
      ]);
      setOrders(orderData);
      setProducts(productData);
      setCategories(categoryData);
      setSummary(summaryData);
    } catch (error) {
      setMessage(error.message);
      if (error.message.toLowerCase().includes('sessao') || error.message.toLowerCase().includes('login')) {
        clearToken();
        setLogged(false);
      }
    }
  }

  useEffect(() => {
    if (logged) loadAdmin();
  }, [logged]);

  async function updateStatus(orderId, status) {
    await api.admin.patch(`/api/admin/orders/${orderId}/status`, { status, payment_status: status === 'concluido' ? 'pago' : undefined });
    loadAdmin();
  }

  async function saveExpense(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/finance/expenses', { ...expense, amount: Number(expense.amount) });
    setExpense({ description: '', amount: '', category: 'Geral' });
    loadAdmin();
  }

  async function saveProduct(event) {
    event.preventDefault();
    await api.admin.post('/api/admin/products', {
      ...productForm,
      category_id: Number(productForm.category_id),
      price: Number(productForm.price),
      sort_order: Number(productForm.sort_order || 0),
      is_active: true
    });
    setProductForm({ category_id: '', name: '', description: '', price: '', product_type: 'hotdog', sort_order: 0, is_active: true });
    loadAdmin();
  }

  if (!logged) return <Login onLogin={() => setLogged(true)} />;

  return (
    <main className="admin-page">
      <div className="admin-header">
        <div>
          <span className="eyebrow">Painel administrativo</span>
          <h2>Gestao do negocio</h2>
        </div>
        <button className="btn-secondary" onClick={() => { clearToken(); setLogged(false); }}><LogOut size={16} /> Sair</button>
      </div>

      {message && <p className="notice">{message}</p>}

      <section className="cards">
        <div className="metric"><span>Faturamento hoje</span><strong>{formatMoney(summary?.gross_today)}</strong></div>
        <div className="metric"><span>Recebido hoje</span><strong>{formatMoney(summary?.paid_today)}</strong></div>
        <div className="metric"><span>Pendente</span><strong>{formatMoney(summary?.pending_today)}</strong></div>
        <div className="metric"><span>Lucro liquido hoje</span><strong>{formatMoney(summary?.net_today)}</strong></div>
      </section>

      <section className="admin-grid">
        <div className="panel wide">
          <div className="panel-title">
            <h3>Pedidos recentes</h3>
            <button className="btn-secondary" onClick={loadAdmin}>Atualizar</button>
          </div>
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div>
                  <strong>#{order.id} - {order.customer_name}</strong>
                  <small>{order.customer_phone} | {order.delivery_type} | {order.payment_method}</small>
                  <small>{order.customer_address}</small>
                </div>
                <div className="order-items">
                  {order.items?.map((item) => <span key={item.id}>{item.quantity}x {item.name}</span>)}
                </div>
                <div className="order-actions">
                  <span className={`badge ${order.status}`}>{statusLabels[order.status]}</span>
                  <strong>{formatMoney(order.total)}</strong>
                  <button onClick={() => updateStatus(order.id, 'preparo')}>Preparar</button>
                  <button onClick={() => updateStatus(order.id, 'saiu_entrega')}>Entrega</button>
                  <button onClick={() => updateStatus(order.id, 'concluido')}>Concluir</button>
                  <button onClick={() => updateStatus(order.id, 'cancelado')}>Cancelar</button>
                </div>
              </article>
            ))}
            {orders.length === 0 && <p className="muted">Nenhum pedido encontrado.</p>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title"><h3><WalletCards size={18} /> Nova despesa</h3></div>
          <form onSubmit={saveExpense} className="stack-form">
            <input placeholder="Descricao" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required />
            <input placeholder="Valor" type="number" step="0.01" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} required />
            <input placeholder="Categoria" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} />
            <button className="btn-primary">Cadastrar saida</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title"><h3><Plus size={18} /> Novo produto</h3></div>
          <form onSubmit={saveProduct} className="stack-form">
            <select value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })} required>
              <option value="">Categoria</option>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
            <input placeholder="Nome do produto" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
            <textarea placeholder="Descricao" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            <input placeholder="Preco" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
            <select value={productForm.product_type} onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value })}>
              <option value="hotdog">Hot dog</option>
              <option value="suco">Suco</option>
              <option value="bebida">Bebida</option>
              <option value="adicional">Adicional</option>
            </select>
            <button className="btn-primary">Salvar produto</button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState(window.location.pathname.includes('admin') ? 'admin' : 'menu');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get('/api/public/settings').then(setSettings).catch(() => setSettings(null));
  }, []);

  return (
    <div>
      <Header view={view} setView={setView} settings={settings} />
      {view === 'admin' ? <AdminPage /> : <MenuPage settings={settings} />}
    </div>
  );
}
