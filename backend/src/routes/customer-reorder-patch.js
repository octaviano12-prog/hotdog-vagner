const baseExpress = require('express');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function customerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Cliente nao autenticado.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(401).json({ message: 'Token de cliente invalido.' });
    req.customer = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Sessao expirada. Entre novamente.' });
  }
}

async function repeatOrder(req, res) {
  const code = String(req.params.code || '').trim().toUpperCase();
  const numericId = Number(code.replace(/\D/g, '')) || 0;

  const oldOrders = await query(
    `SELECT * FROM orders
     WHERE customer_id = ? AND (UPPER(public_code) = ? OR id = ?)
     ORDER BY id DESC
     LIMIT 1`,
    [req.customer.id, code, numericId]
  );
  const oldOrder = oldOrders[0];
  if (!oldOrder) return res.status(404).json({ message: 'Pedido nao encontrado neste cadastro.' });
  if (oldOrder.status === 'cancelado') return res.status(400).json({ message: 'Nao e possivel repetir pedido cancelado.' });

  const oldItems = await query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [oldOrder.id]);
  if (oldItems.length === 0) return res.status(400).json({ message: 'Pedido antigo sem itens para repetir.' });

  const created = await transaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO orders
       (customer_id, status, payment_status, payment_method, delivery_type, subtotal, delivery_fee, total, change_for, notes, order_source, delivery_neighborhood, estimated_minutes)
       VALUES (?, 'novo', 'pendente', ?, ?, ?, ?, ?, ?, ?, 'site', ?, ?)`,
      [
        req.customer.id,
        oldOrder.payment_method || 'dinheiro',
        oldOrder.delivery_type || 'entrega',
        money(oldOrder.subtotal),
        money(oldOrder.delivery_fee),
        money(oldOrder.total),
        oldOrder.change_for || null,
        `Repeticao do pedido ${oldOrder.public_code || `#${oldOrder.id}`}`,
        oldOrder.delivery_neighborhood || '',
        Number(oldOrder.estimated_minutes || 35)
      ]
    );

    const newOrderId = result.insertId;
    const publicCode = `HD${String(newOrderId).padStart(4, '0')}`;
    await connection.execute('UPDATE orders SET public_code = ? WHERE id = ?', [publicCode, newOrderId]);

    const parentMap = new Map();
    for (const item of oldItems.filter((row) => row.item_type === 'produto')) {
      const [itemResult] = await connection.execute(
        `INSERT INTO order_items (order_id, product_id, parent_item_id, item_type, name, quantity, unit_price, total_price, notes)
         VALUES (?, ?, NULL, 'produto', ?, ?, ?, ?, ?)`,
        [newOrderId, item.product_id || null, item.name, item.quantity, money(item.unit_price), money(item.total_price), item.notes || '']
      );
      parentMap.set(item.id, itemResult.insertId);
    }

    for (const item of oldItems.filter((row) => row.item_type === 'adicional')) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, parent_item_id, item_type, name, quantity, unit_price, total_price, notes)
         VALUES (?, ?, ?, 'adicional', ?, ?, ?, ?, ?)`,
        [newOrderId, item.product_id || null, parentMap.get(item.parent_item_id) || null, item.name, item.quantity, money(item.unit_price), money(item.total_price), item.notes || '']
      );
    }

    return { id: newOrderId, public_code: publicCode, total: oldOrder.total };
  });

  return res.status(201).json({ message: 'Pedido repetido com sucesso.', order: created });
}

function registerReorderRoutes(app) {
  app.post('/api/customer/orders/:code/reorder', customerAuth, (req, res, next) => {
    Promise.resolve(repeatOrder(req, res)).catch(next);
  });
}

function wrappedExpress(...args) {
  const app = baseExpress(...args);
  let registered = false;

  function ensureRoutes() {
    if (registered) return;
    registerReorderRoutes(app);
    registered = true;
  }

  const originalUse = app.use.bind(app);
  app.use = function patchedUse(...useArgs) {
    const isStaticMiddleware = useArgs.some((arg) => typeof arg === 'function' && ['serveStatic', 'staticMiddleware'].includes(arg.name));
    if (isStaticMiddleware) ensureRoutes();
    return originalUse(...useArgs);
  };

  const originalGet = app.get.bind(app);
  app.get = function patchedGet(route, ...handlers) {
    if (route === '*' || route === '/api/health') ensureRoutes();
    return originalGet(route, ...handlers);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function patchedListen(...listenArgs) {
    ensureRoutes();
    return originalListen(...listenArgs);
  };

  return app;
}

Object.setPrototypeOf(wrappedExpress, baseExpress);
Object.assign(wrappedExpress, baseExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
