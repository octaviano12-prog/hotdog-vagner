const originalExpress = require('express');
const { registerPremiumRoutes } = require('./premium');

function wrappedExpress(...args) {
  const app = originalExpress(...args);
  let premiumRegistered = false;

  function ensurePremiumRoutes() {
    if (premiumRegistered) return;
    registerPremiumRoutes(app);
    premiumRegistered = true;
  }

  const originalUse = app.use.bind(app);
  app.use = function patchedUse(...useArgs) {
    const isStaticMiddleware = useArgs.some((arg) => typeof arg === 'function' && ['serveStatic', 'staticMiddleware'].includes(arg.name));
    if (isStaticMiddleware) ensurePremiumRoutes();
    return originalUse(...useArgs);
  };

  const originalGet = app.get.bind(app);
  app.get = function patchedGet(route, ...handlers) {
    if (route === '*') ensurePremiumRoutes();
    return originalGet(route, ...handlers);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function patchedListen(...listenArgs) {
    ensurePremiumRoutes();
    return originalListen(...listenArgs);
  };

  return app;
}

Object.setPrototypeOf(wrappedExpress, originalExpress);
Object.assign(wrappedExpress, originalExpress);
require.cache[require.resolve('express')].exports = wrappedExpress;
