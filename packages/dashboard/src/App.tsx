import { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from './api';
import LoginPage from './pages/Login';
import CampaignsPage from './pages/Campaigns';
import CampaignDetailPage from './pages/CampaignDetail';
import TransactionsPage from './pages/Transactions';
import ApiKeysPage from './pages/ApiKeys';
import AuditLogPage from './pages/AuditLog';
import HealthPage from './pages/Health';

function Navbar() {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('token'); navigate('/login'); };
  return (
    <nav className="bg-midnight-900 text-white px-6 py-3 flex items-center gap-6">
      <Link to="/" className="font-bold text-lg">AetherDust</Link>
      <Link to="/campaigns" className="hover:text-midnight-50">Campaigns</Link>
      <Link to="/transactions" className="hover:text-midnight-50">Transactions</Link>
      <Link to="/api-keys" className="hover:text-midnight-50">API Keys</Link>
      <Link to="/audit-log" className="hover:text-midnight-50">Audit Log</Link>
      <Link to="/health" className="hover:text-midnight-50">Health</Link>
      <button onClick={logout} className="ml-auto text-sm bg-red-600 px-3 py-1 rounded hover:bg-red-700">Logout</button>
    </nav>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  return <><Navbar /><main className="p-6 max-w-7xl mx-auto">{children}</main></>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
      <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetailPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/api-keys" element={<ProtectedRoute><ApiKeysPage /></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
      <Route path="/health" element={<ProtectedRoute><HealthPage /></ProtectedRoute>} />
    </Routes>
  );
}
