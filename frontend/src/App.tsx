import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Caisse from './pages/Caisse';
import Stocks from './pages/Stocks';
import Depenses from './pages/Depenses';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/caisse"    element={<Caisse />} />
        <Route path="/stocks"    element={<Stocks />} />
        <Route path="/depenses"  element={<Depenses />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
