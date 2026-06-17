function createOrderCode(orderId) {
  return `HD${String(orderId).padStart(5, '0')}`;
}

module.exports = { createOrderCode };
