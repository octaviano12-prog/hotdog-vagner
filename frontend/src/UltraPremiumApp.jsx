import { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Flame,
  Gift,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Utensils,
  WalletCards,
  X,
  Zap
} from 'lucide-react';
import PremiumApp from './PremiumApp.jsx';
import { api, formatMoney } from './api.js';
import { BRAND_NAME, productMedia, productMediaPosition } from './product-media.js';

const paymentLabels = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartao',
  fiado: 'Fiado'
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function productKind(product = {}) {
  const name = normalizeText(`${product.name || ''} ${product.description || ''}`);
  if (product.product_type === 'hotdog') return 'hotdog';
  if (product.product_type === 'bebida') {
    if (name.includes('2 litro')) return 'bottle large';
    if (name.includes('1 litro')) return 'bottle';
    return 'can';
  }
  if (product.product_type === 'suco') {
    if (name.includes('jarra')) return 'juice pitcher';
    if (name.includes('detox')) return 'juice green';
    if (name.includes('vitamina')) return 'juice creamy';
    return 'juice';
  }
  if (name.includes('bacon')) return 'extra bacon';
  if (name.includes('calabresa')) return 'extra sausage';
  if (name.includes('salsicha')) return 'extra hotdog-extra';
  if (name.includes('carne')) return 'extra meat';
  if (name.includes('frango')) return 'extra chicken';
  if (name.includes('cheddar')) return 'extra cheddar';
  if (name.includes('catupiry')) return 'extra cream';
  return 'extra cheese';
}

function productBadge(product = {}) {
  if (product.product_type === 'hotdog') return 'Hot dog prensado';
  if (product.product_type === 'suco') return 'Suco natural';
  if (product.product_type === 'bebida') return 'Bebida gelada';
  return 'Adicional';
}

function makeWhatsAppMessage(settings, payload, total, order) {
  const lines = [
    `Novo pedido - ${settings?.business_name || BRAND_NAME}`,
    order?.public_code ? `Codigo: ${order.public_code}` : order?.id ? `Pedido: #${order.id}` : '',
    '',
    ...payload.items.map((item, index) => {
      const extras = item.extraNames?.length ? ` | Adicionais: ${item.extraNames.join(', ')}` : '';
      return `${index + 1}. ${item.quantity}x ${item.name}${extras}`;
    }),
    '',
    `Cliente: ${payload.customer.name}`,
    `Telefone: ${payload.customer.phone}`,
    `Entrega: ${payload.delivery_type === 'entrega' ? 'Entrega' : 'Retirada no balcao'}`,
    payload.delivery_type === 'entrega' ? `Endereco: ${payload.customer.address}` : '',
    payload.customer.neighborhood ? `Bairro: ${payload.customer.neighborhood}` : '',
    payload.customer.reference ? `Referencia: ${payload.customer.reference}` : '',
    `Pagamento: ${paymentLabels[payload.payment_method] || payload.payment_method}`,
    payload.notes ? `Observacoes: ${payload.notes}` : '',
    `Total: ${formatMoney(total)}`
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
}

function FoodVisual({ product, hero = false }) {
  const kind = productKind(product);
  return (
    <div className={`food-visual ${kind} ${hero ? 'hero-food' : ''}`} aria-hidden="true">
      <span className="shine" />
      <span className="steam one" />
      <span className="steam two" />
      <span className="plate" />
      <span className="bread top" />
      <span className="bread bottom" />
      <span className="sausage" />
      <span className="mustard" />
      <span className="ketchup" />
      <span className="salad" />
      <span className="cup" />
      <span className="liquid" />
      <span className="ice a" />
      <span className="ice b" />
      <span className="fruit" />
      <span className="can-body" />
      <span className="can-top" />
      <span className="can-label" />
      <span className="bottle-body" />
      <span className="bottle-label" />
      <span className="extra-piece" />
    </div>
  );
}

function Header({ settings }) {
  return (
    <header className="ultra-header">
      <button className="ultra-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <span><Flame size={24} /></span>
        <div>
          <small>Pedidos online</small>
          <strong>{settings?.business_name || BRAND_NAME}</strong>
        </div>
      </button>
      <nav>
        <button onClick={() => { window.location.href = '/pedir'; }}><ShoppingCart size={16} /> Cardápio</button>
        <button className="admin" onClick={() => { window.history.pushState({}, '', '/admin'); window.location.reload(); }}><ShieldCheck size={16} /> Painel Admin</button>
      </nav>
    </header>
  );
}

function ProductCard({ product, extras, onAdd, featured = false }) {
  const [selectedExtras, setSelectedExtras] = useState([]);
  const allowedExtras = product.product_type === 'hotdog' ? extras : [];

  function toggleExtra(id) {
    setSelectedExtras((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submitAdd() {
    onAdd(product, selectedExtras);
    setSelectedExtras([]);
  }

  return (
    <article className={`ultra-product-card ${featured ? 'featured' : ''} ${productMediaPosition(product)}`}>
      <div className="product-photo-wrap">
        {featured && <span className="most-ordered">Mais pedido</span>}
        <img className="catalog-product-photo" src={productMedia(product)} alt={product.name} loading="lazy" />
      </div>
      <div className="product-info">
        <small>{productBadge(product)}</small>
        <h3>{product.name}</h3>
        <strong className="product-price">{formatMoney(product.price)}</strong>
        <p>{product.description || 'Preparado com ingredientes selecionados.'}</p>

        {allowedExtras.length > 0 && (
          <div className="ultra-extras">
            <span>Adicionais para turbinar</span>
            <div>
              {allowedExtras.slice(0, 5).map((extra) => (
                <label key={extra.id} className={selectedExtras.includes(extra.id) ? 'checked' : ''}>
                  <input type="checkbox" checked={selectedExtras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} />
                  <b>{extra.name}</b>
                  <em>+ {formatMoney(extra.price)}</em>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="product-bottom-row">
          <span>{allowedExtras.length ? `Escolha ate ${Math.min(allowedExtras.length, 5)} adicionais` : 'Pronto para adicionar'}</span>
          <b>{formatMoney(product.price)}</b>
        </div>
        <button className="ultra-add" onClick={submitAdd}>Adicionar ao pedido <span>+</span></button>
      </div>
    </article>
  );
}

function CartPanel({ cart, setCart, settings, pulse }) {
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
  const [deliveryType, setDeliveryType] = useState('entrega');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastWhatsappUrl, setLastWhatsappUrl] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const deliveryFee = deliveryType === 'entrega' ? Number(settings?.delivery_fee || 0) : 0;
  const total = subtotal + deliveryFee;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const minimumOrder = Number(settings?.minimum_order_amount || 0);
  const needsMinimum = minimumOrder > 0 && subtotal > 0 && subtotal < minimumOrder;

  function removeItem(key) {
    setCart((current) => current.filter((item) => item.key !== key));
  }

  function updateQty(key, quantity) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  async function sendOrder(event) {
    event.preventDefault();
    if (cart.length === 0) return setMessage('Adicione pelo menos um item ao pedido.');
    if (needsMinimum) return setMessage(`Pedido minimo para entrega: ${formatMoney(minimumOrder)}.`);

    const payload = {
      customer,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      notes,
      items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity, extras: item.extras.map((extra) => extra.id), notes: '' }))
    };

    setLoading(true);
    setMessage('');
    setLastWhatsappUrl('');
    try {
      const response = await api.post('/api/orders', payload);
      const whatsappPayload = { ...payload, items: cart.map((item) => ({ ...item, extraNames: item.extras.map((extra) => extra.name) })) };
      setMessage(`Pedido ${response.order.public_code || `#${response.order.id}`} enviado para o painel.`);
      setCart([]);
      setCustomer({ name: '', phone: '', address: '', reference: '', neighborhood: '' });
      setNotes('');

      const canOpenWhatsApp = settings?.allow_whatsapp_redirect !== 0 && settings?.allow_whatsapp_redirect !== false;
      if (canOpenWhatsApp) {
        const whatsapp = settings?.whatsapp || '5518991959898';
        const url = `https://wa.me/${whatsapp}?text=${makeWhatsAppMessage(settings, whatsappPayload, response.order.total, response.order)}`;
        setLastWhatsappUrl(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside id="pedido" className={`ultra-cart ${pulse ? 'pulse' : ''}`}>
      <div className="cart-head">
        <div>
          <span><ShoppingCart size={21} /></span>
          <h2>Seu pedido</h2>
        </div>
        <b>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</b>
      </div>

      {message && message.includes('enviado') && (
        <div className="cart-success-card">
          <CheckCircle2 size={28} />
          <div>
            <strong>Pedido recebido!</strong>
            <p>{message} A cozinha ja consegue acompanhar no painel administrativo.</p>
            {lastWhatsappUrl && <a href={lastWhatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Abrir WhatsApp</a>}
          </div>
          <button type="button" onClick={() => setMessage('')}><X size={18} /></button>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="empty-cart">
          <ShoppingCart size={54} />
          <strong>Monte seu pedido</strong>
          <p>Adicione lanches, bebidas, sucos e adicionais para ver o resumo aqui.</p>
          <button type="button" onClick={() => document.getElementById('cardapio')?.scrollIntoView({ behavior: 'smooth' })}>Ver cardapio</button>
        </div>
      ) : (
        <div className="cart-list">
          {cart.map((item) => (
            <div className="cart-line" key={item.key}>
              <div>
                <strong>{item.name}</strong>
                {item.extras.length > 0 && <small>+ {item.extras.map((extra) => extra.name).join(', ')}</small>}
                <em>{formatMoney(Number(item.price) + item.extras.reduce((sum, extra) => sum + Number(extra.price), 0))}</em>
              </div>
              <div className="cart-controls">
                <button type="button" onClick={() => updateQty(item.key, item.quantity - 1)}><Minus size={13} /></button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateQty(item.key, item.quantity + 1)}><Plus size={13} /></button>
                <button type="button" className="remove" onClick={() => removeItem(item.key)}><X size={13} /></button>
              </div>
            </div>
          ))}
          <button type="button" className="clear-cart" onClick={() => setCart([])}>Limpar pedido</button>
        </div>
      )}

      <div className="cart-total-box">
        <span>Subtotal <b>{formatMoney(subtotal)}</b></span>
        <span>Entrega <b>{formatMoney(deliveryFee)}</b></span>
        {needsMinimum && <span className="minimum-alert">Faltam <b>{formatMoney(minimumOrder - subtotal)}</b> para o pedido minimo</span>}
        <strong>Total <b>{formatMoney(total)}</b></strong>
      </div>

      <form className="checkout-form" onSubmit={sendOrder}>
        <h3>Dados para entrega</h3>
        <div className="choice-row">
          <button type="button" className={deliveryType === 'entrega' ? 'active' : ''} onClick={() => setDeliveryType('entrega')}><Truck size={15} /> Entrega</button>
          <button type="button" className={deliveryType === 'retirada' ? 'active' : ''} onClick={() => setDeliveryType('retirada')}><Utensils size={15} /> Retirada</button>
        </div>
        <input placeholder="Nome do cliente" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
        <input placeholder="WhatsApp" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} required />
        {deliveryType === 'entrega' && (
          <>
            <input placeholder="Endereco de entrega" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} required />
            <input placeholder="Bairro" value={customer.neighborhood} onChange={(e) => setCustomer({ ...customer, neighborhood: e.target.value })} />
            <input placeholder="Ponto de referencia" value={customer.reference} onChange={(e) => setCustomer({ ...customer, reference: e.target.value })} />
          </>
        )}
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">PIX</option>
          <option value="cartao">Cartao</option>
          <option value="fiado">Fiado</option>
        </select>
        {paymentMethod === 'pix' && <p className="payment-tip">O pedido entra no painel e o pagamento PIX pode ser confirmado no caixa.</p>}
        <textarea placeholder="Observacoes do pedido" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="send-order" disabled={loading}>{loading ? 'Enviando...' : 'Enviar pedido'}</button>
        {message && !message.includes('enviado') && <p className="cart-message">{message}</p>}
      </form>

      <div className="secure-note"><Lock size={16} /> Pedido salvo automaticamente no painel administrativo.</div>
    </aside>
  );
}

function MobileCartBar({ cart, settings }) {
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * (Number(item.price) + item.extras.reduce((extraSum, extra) => extraSum + Number(extra.price), 0)), 0);
  const total = subtotal + Number(settings?.delivery_fee || 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (!count) return null;

  return (
    <button className="mobile-cart-bar" onClick={() => document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth' })}>
      <span>{count} {count === 1 ? 'item' : 'itens'}</span>
      <strong>Ver pedido • {formatMoney(total)}</strong>
    </button>
  );
}

function WorkflowSection() {
  const steps = [
    { icon: <ShoppingCart size={22} />, title: 'Cliente monta o pedido', text: 'Escolhe hot dog, bebidas, sucos e adicionais direto na pagina.' },
    { icon: <Zap size={22} />, title: 'Pedido cai no painel', text: 'O admin recebe tudo organizado: cliente, endereco, itens e pagamento.' },
    { icon: <Bike size={22} />, title: 'Preparo e entrega', text: 'O pedido passa por novo, preparo, saiu para entrega e concluido.' },
    { icon: <WalletCards size={22} />, title: 'Financeiro atualizado', text: 'Pedidos pagos alimentam o caixa e os relatorios do dia.' }
  ];

  return (
    <section className="workflow-section">
      <div className="section-heading"><span>Como funciona</span><h2>Pedido online com gestao de verdade</h2></div>
      <div className="workflow-grid">
        {steps.map((step, index) => (
          <article key={step.title}>
            <b>0{index + 1}</b>
            <span>{step.icon}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComboShowcase({ products, onAddCombo }) {
  if (products.length < 2) return null;
  const comboTotal = products.reduce((sum, product) => sum + Number(product.price), 0);
  return (
    <section className="combo-showcase">
      <div>
        <span><Gift size={16} /> Sugestao da noite</span>
        <h2>Combo rapido para matar a fome</h2>
        <p>{products.map((product) => product.name).join(' + ')} por {formatMoney(comboTotal)}.</p>
      </div>
      <div className="combo-products">
        {products.map((product) => <FoodVisual key={product.id} product={product} />)}
      </div>
      <button type="button" onClick={onAddCombo}>Adicionar combo <ChevronRight size={18} /></button>
    </section>
  );
}

function PremiumLanding({ settings }) {
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartPulse, setCartPulse] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/api/public/menu')
      .then(setMenu)
      .catch(() => setMenu({ categories: [], products: [] }))
      .finally(() => setLoading(false));
  }, []);

  const extras = useMemo(() => menu.products.filter((product) => product.product_type === 'adicional'), [menu.products]);
  const featuredProducts = useMemo(() => menu.products.filter((product) => product.product_type !== 'adicional').slice(0, 3), [menu.products]);
  const comboProducts = useMemo(() => {
    const hotdog = menu.products.find((product) => product.product_type === 'hotdog');
    const drink = menu.products.find((product) => product.product_type === 'bebida');
    const juice = menu.products.find((product) => product.product_type === 'suco');
    return [hotdog, drink || juice].filter(Boolean);
  }, [menu.products]);
  const filteredCategories = useMemo(() => {
    const query = normalizeText(searchTerm.trim());
    if (!query) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => normalizeText(`${product.name} ${product.description || ''} ${category.name}`).includes(query))
      }))
      .filter((category) => category.products.length > 0);
  }, [menu.categories, searchTerm]);

  function addToCart(product, extraIds = []) {
    if (window.location.pathname === '/') {
      localStorage.setItem('hotdog_pending_cart', JSON.stringify([{ productId: product.id, extraIds }]));
      window.location.href = '/pedir';
      return;
    }
    const selectedExtras = extras.filter((extra) => extraIds.includes(extra.id));
    const key = `${product.id}-${selectedExtras.map((extra) => extra.id).sort().join('-')}`;
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, key, quantity: 1, extras: selectedExtras }];
    });
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 700);
  }

  function addComboToCart() {
    comboProducts.forEach((product) => addToCart(product, []));
    document.getElementById('pedido')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="ultra-page">
      <Header settings={settings} />

      <main>
        <section className="ultra-hero">
          <div className="hero-copy">
            <div className="hero-badge-row">
              <span className="hero-pill"><Sparkles size={15} /> Hot dog prensado premium</span>
              <span className="mini-rating"><Star size={15} fill="currentColor" /> Feito na hora</span>
            </div>
            <h1>O hot dog que você ama, <em>no capricho</em> que você merece.</h1>
            <p>Pães macios, salsichas selecionadas e combinações irresistíveis. Peça agora e receba com rapidez e qualidade.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => { window.location.href = '/pedir'; }}>Fazer pedido agora <ChevronRight size={18} /></button>
              <button className="hero-secondary" onClick={() => { window.location.href = '/pedir'; }}><ShoppingCart size={17} /> Ver cardápio</button>
            </div>
            <div className="hero-metrics">
              <span><Clock size={19} /><b>Previsao</b><strong>{settings?.estimated_delivery_minutes || 35} min</strong></span>
              <span><Truck size={19} /><b>Entrega</b><strong>{formatMoney(settings?.delivery_fee || 0)}</strong></span>
              <span><MessageCircle size={19} /><b>WhatsApp</b><strong>{settings?.phone || settings?.whatsapp || '(18) 99195-9898'}</strong></span>
            </div>
          </div>
          <div className="hero-art">
            <img className="catalog-hero-photo" src="/images/catalog-products-premium.png" alt="Hot dog prensado artesanal" />
            <div className="smart-queue">
              <strong><Zap size={17} /> Fila inteligente</strong>
              <div><i /> <i /> <i /> <i /></div>
              <small>novo → preparo → entrega → concluido</small>
            </div>
          </div>
        </section>

        <section className="feature-row">
          <article><ShoppingCart size={25} /><div><strong>Cardapio digital</strong><span>Produtos, adicionais, bebidas e sucos.</span></div><ChevronRight size={18} /></article>
          <article><Zap size={25} /><div><strong>Pedido automatizado</strong><span>Sai do site e aparece no admin.</span></div><ChevronRight size={18} /></article>
          <article><WalletCards size={25} /><div><strong>Gestao financeira</strong><span>Caixa, despesas, vendas e relatorios.</span></div><ChevronRight size={18} /></article>
        </section>

        <WorkflowSection />

        {featuredProducts.length > 0 && (
          <section className="ultra-section">
            <div className="section-heading"><span>Mais pedidos</span><h2>Destaques da casa</h2></div>
            <div className="highlight-grid">
              {featuredProducts.map((product, index) => (
                <button key={product.id} className="highlight-card" onClick={() => addToCart(product, [])}>
                  <img className={`catalog-highlight-photo ${productMediaPosition(product)}`} src={productMedia(product)} alt={product.name} loading="lazy" />
                  <div>
                    <strong>{product.name}</strong>
                    <b>{formatMoney(product.price)}</b>
                    {index === 0 && <span><Star size={13} fill="currentColor" /> Mais vendido</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <ComboShowcase products={comboProducts} onAddCombo={addComboToCart} />

        <section id="cardapio" className="menu-zone">
          <div className="menu-main">
            <div className="section-heading big"><span>Monte seu pedido</span><h2>Cardapio completo</h2><p>Escolha os itens, adicione extras e finalize sem perder nenhuma informacao do cliente.</p></div>
            <div className="menu-toolbar">
              <label className="menu-search">
                <Search size={18} />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar hot dog, suco, bebida ou adicional" />
                {searchTerm && <button type="button" onClick={() => setSearchTerm('')}><X size={16} /></button>}
              </label>
              <div className="category-tabs">
                {menu.categories.map((category) => (
                  <button key={category.id} onClick={() => document.getElementById(`categoria-${category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{category.name}</button>
                ))}
              </div>
            </div>
            {loading && <p className="menu-message">Carregando cardapio...</p>}
            {!loading && menu.categories.length === 0 && <p className="menu-message">Nenhum produto ativo encontrado no cardapio.</p>}
            {!loading && menu.categories.length > 0 && filteredCategories.length === 0 && <p className="menu-message">Nenhum item encontrado para sua busca.</p>}
            {filteredCategories.map((category) => (
              <section id={`categoria-${category.id}`} className="menu-category" key={category.id}>
                <div className="category-title"><h3>{category.name}</h3><span>{category.description}</span></div>
                <div className="ultra-product-grid">
                  {category.products.map((product, index) => (
                    <ProductCard key={product.id} product={product} extras={extras} onAdd={addToCart} featured={index === 0 && product.product_type === 'hotdog'} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <CartPanel cart={cart} setCart={setCart} settings={settings} pulse={cartPulse} />
        </section>

        <section className="trust-strip">
          <span><Lock size={18} /> Pedido seguro</span>
          <span><CreditCard size={18} /> Pagamento na entrega</span>
          <span><MessageCircle size={18} /> Atendimento via WhatsApp</span>
          <span><MapPin size={18} /> Entrega rapida</span>
          <span><Heart size={18} fill="currentColor" /> Feito com qualidade</span>
        </section>
      </main>

      <a className="float-contact" href={`https://wa.me/${settings?.whatsapp || '5518991959898'}`} target="_blank" rel="noreferrer" aria-label="Chamar no WhatsApp"><MessageCircle size={25} /></a>
      <MobileCartBar cart={cart} settings={settings} />
    </div>
  );
}

export default function UltraPremiumApp() {
  const [settings, setSettings] = useState(null);
  const isAdminRoute = window.location.pathname.includes('admin');

  useEffect(() => {
    if (!isAdminRoute) {
      api.get('/api/public/settings').then(setSettings).catch(() => setSettings(null));
    }
  }, [isAdminRoute]);

  if (isAdminRoute) return <PremiumApp />;
  return <PremiumLanding settings={settings} />;
}
