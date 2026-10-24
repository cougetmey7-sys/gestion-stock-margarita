import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { LicenseProvider } from './license.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LicenseProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LicenseProvider>
    </BrowserRouter>
  </React.StrictMode>
);
