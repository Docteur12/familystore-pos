import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './api/fetchInterceptor'; // doit s'installer avant tout appel API
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
