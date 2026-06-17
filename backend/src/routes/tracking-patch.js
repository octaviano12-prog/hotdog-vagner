const baseExpress = require('express');
const { query } = require('../config/db');

function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function publicOrderCode(order) {
  return order.public_code || `HD${String(order.id).padStart(4, '0')}`;
}

async function handleTrackOrder(req, res) {
  const code = String(req.params.code || '').trim().toUpperCase();
  const phone = onlyDigits(req.query.phone || '');

  if (!code) return res.status(400).json({ message: 'Informe o codigo do pedido.' });
  if (phone.length < 4) return res.status(400).json({ message: 'Informe pelo menos os 4 ultimos digitos do WhatsApp.' });

  const numericId = Number(code.replace(/\D/g, '')) || 0;
  const orders = await query(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address, c.reference AS customer_reference
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE UPPER(o.public_code) = ? OR o.id = ?
     ORDER BY o.id DESC
     LIMIT 1`,
    [code, numericId]
  );

  const order = orders[0];
  if (!order) return res.status(404).json({ message: 'Pedido nao encontrado.' });

  const savedPhone = onlyDigits(order.customer_phone || '');
  const informedLast = phone.slice(-4);
  const phoneOk = savedPhone.endsWith(informedLast) || savedPhone.endsWith(phone) || phone.endsWith(savedPhone);
  if (!phoneOk) return res.status(404).json({ message: 'Pedido nao encontrado para este WhatsApp.' });

  const items = await query(
    `SELECT id, parent_item_id, item_type, name, quantity, unit_price, total_price, notes
     FROM order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [order.id]
  );

  return res.json({
    order: {
      id: order.id,
      public_code: publicOrderCode(order),
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      delivery_type: order.delivery_type,
      subtotal: order.subtotal,
      delivery_fee: order.delivery_fee,
      total: order.total,
      estimated_minutes: order.estimated_minutes,
      created_at: order.created_at,
      accepted_at: order.accepted_at,
      dispatched_at: order.dispatched_at,
      completed_at: order.completed_at,
      canceled_at: order.canceled_at,
      cancellation_reason: order.cancellation_reason,
      customer_name: order.customer_name,
      customer_address: order.delivery_type === 'entrega' ? order.customer_address : '',
      customer_reference: order.delivery_type === 'entrega' ? order.customer_reference : '',
      delivery_neighborhood: order.delivery_neighborhood || '',
      items
    }
  });
}

function registerTrackingRoutes(app) {
  app.get('/api/public/orders/:code', (req, res, next) => {
    Promise.resolve(handleTrackOrder(req, res)).catch(next);
  });
}

function wrappedExpress(...args) {
  const app = baseExpress(...args);
  let registered = false;

  function ensureTrackingRoutes() {
    if (registered) return;
    registerTrackingRoutes(app);
    registered = true;
  }

  const originalGet = app.get.bind(app);
  app.get = function patchedGet(route, ...handlers) {
    if (route === '*' || route === '/api/health') ensureTrackingRoutes();
    return originalGet(route, ...handlers);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function patchedListen(...listenArgs) {
    ensureTrackingRoutes();
    return originalListen(...listenArgs);
  };

  return app;
}

Object.setPrototypeOf(wrappedExpress, baseExpress);
Object.assign(wrappedExpress, baseExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
