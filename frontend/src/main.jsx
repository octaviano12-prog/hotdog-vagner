import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerPwa } from './pwa-register.js';
import { installAdminApiFallback } from './admin-api-fallback.js';
import { bootCustomerTracking } from './customer-tracking.js';
import { bootCustomerAccount } from './customer-account.js';
import { bootCustomerReorder } from './customer-reorder.js';
import { bootCustomerLoyalty } from './customer-loyalty.js';
import './styles.css';
import './landing-premium.css';
import './landing-ultra.css';
import './landing-polish.css';
import './home-v2.css';
import './public-image-upgrade.css';
import './admin-operations.css';
import './admin-flow.css';
import './admin-report-tools.css';
import './customer-tracking.css';
import './customer-account.css';
import './customer-reorder.css';
import './customer-loyalty.css';
import './admin-customer-crm.css';
import './admin-clientes-vip.css';
import './public-checkout-upgrade.css';
import './public-order-rules.css';
import './public-require-login.css';
import './admin-customer-crm.js';
import './admin-clientes-vip.js';
import './home-v2.js';
import './public-image-upgrade.js';
import './public-checkout-upgrade.js';
import './public-order-rules.js';
import './public-require-login.js';
import './admin-flow.js';
import './admin-report-tools.js';

registerPwa();
installAdminApiFallback();
bootCustomerTracking();
bootCustomerAccount();
bootCustomerReorder();
bootCustomerLoyalty();

if (window.location.pathname.includes('admin') || window.location.pathname.includes('cozinha')) {
  import('./admin-kitchen-board.css');
  import('./admin-kitchen-board.js');
}

const App = React.lazy(() => import('./U' + 'ltraPremiumApp.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <App />
    </React.Suspense>
  </React.StrictMode>
);
