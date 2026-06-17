const baseExpress = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function customerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function requireCustomerForOrder(req, res, next) {
  const token = customerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Para fazer pedido, entre ou cadastre-se primeiro.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'customer' || !decoded.id) {
      return res.status(401).json({ message: 'Sessao de cliente invalida. Entre novamente.' });
    }

    const rows = await query('SELECT * FROM customers WHERE id = ? LIMIT 1', [decoded.id]);
    const customer = rows[0];
    if (!customer) {
      return res.status(401).json({ message: 'Cadastro nao encontrado. Entre novamente.' });
    }

    req.customer = decoded;
    req.body = {
      ...(req.body || {}),
      customer: {
        ...(req.body?.customer || {}),
        name: customer.name || req.body?.customer?.name || '',
        phone: customer.phone || req.body?.customer?.phone || '',
        address: customer.address || req.body?.customer?.address || '',
        reference: customer.reference || req.body?.customer?.reference || ''
      }
    };

    return next();
  } catch {
    return res.status(401).json({ message: 'Sessao expirada. Entre novamente para finalizar o pedido.' });
  }
}

function wrappedExpress(...args) {
  const app = baseExpress(...args);
  const originalPost = app.post.bind(app);

  app.post = function patchedPost(route, ...handlers) {
    if (route === '/api/orders') {
      return originalPost(route, (req, res, next) => Promise.resolve(requireCustomerForOrder(req, res, next)).catch(next), ...handlers);
    }
    return originalPost(route, ...handlers);
  };

  return app;
}

Object.setPrototypeOf(wrappedExpress, baseExpress);
Object.assign(wrappedExpress, baseExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
