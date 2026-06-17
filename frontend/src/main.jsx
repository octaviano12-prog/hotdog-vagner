import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerPwa } from './pwa-register.js';
import './styles.css';
import './landing-premium.css';
import './landing-ultra.css';
import './landing-polish.css';
import './admin-operations.css';

registerPwa();

const App = React.lazy(() => import('./U' + 'ltraPremiumApp.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <App />
    </React.Suspense>
  </React.StrictMode>
);
