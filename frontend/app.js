const products = [
  { id: 1, name: 'Hot Dog Simples', price: 18, category: 'Hot Dog', desc: 'Pao prensado, salsicha, molho da casa, batata palha, ketchup, maionese, mostarda, alface e vinagrete.' },
  { id: 2, name: 'Hot Dog Especial', price: 22, category: 'Hot Dog', desc: 'Pao prensado, salsicha, bacon, milho, queijo, alface e vinagrete.' },
  { id: 3, name: 'Hot Dog Completo', price: 28, category: 'Hot Dog', desc: 'Duas salsichas, molho especial, queijo, bacon, calabresa, pure e vinagrete.' },
  { id: 4, name: 'Suco Natural 500 ml', price: 8, category: 'Bebidas', desc: 'Laranja, morango, maracuja, abacaxi, acerola, uva ou limao.' }
];

const cart = [];
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function renderMenu() {
  const menu = document.querySelector('#menu');
  menu.innerHTML = products.map(item => `
    <article class="card">
      <span>${item.category}</span>
      <h3>${item.name}</h3>
      <p>${item.desc}</p>
      <strong>${money(item.price)}</strong>
      <button onclick="addToCart(${item.id})">Adicionar</button>
    </article>
  `).join('');
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  const current = cart.find(item => item.id === id);
  if (current) current.qty += 1;
  else cart.push({ ...product, qty: 1 });
  renderCart();
}

function renderCart() {
  const list = document.querySelector('#cart');
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  list.innerHTML = cart.map(item => `<li>${item.qty}x ${item.name} - ${money(item.price * item.qty)}</li>`).join('');
  document.querySelector('#total').textContent = money(total);
}

function sendWhatsApp() {
  const name = document.querySelector('#customer').value || 'Cliente';
  const address = document.querySelector('#address').value || 'Retirada no balcao';
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const lines = cart.map(item => `${item.qty}x ${item.name} - ${money(item.price * item.qty)}`).join('\n');
  const text = `Pedido HotDog Vagner\nCliente: ${name}\nEndereco: ${address}\n\n${lines}\n\nTotal: ${money(total)}`;
  window.open(`https://wa.me/5518991959898?text=${encodeURIComponent(text)}`, '_blank');
}

renderMenu();
renderCart();
window.addToCart = addToCart;
window.sendWhatsApp = sendWhatsApp;
