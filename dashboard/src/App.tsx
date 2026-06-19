import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Overview from './pages/Overview';
import Sources from './pages/Sources';
import PDFUpload from './pages/PDFUpload';
import FAQs from './pages/FAQs';
import TextDocs from './pages/TextDocs';
import Crawl from './pages/Crawl';
import KnowledgeImprovement from './pages/KnowledgeImprovement';
import Leads from './pages/Leads';
import Settings from './pages/Settings';
import AdminLogin from './pages/AdminLogin';
import AdminTenants from './pages/AdminTenants';

// System Admin Layout Component
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Users, LogOut } from 'lucide-react';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/" /> : <>{children}</>;
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();

  React.useEffect(() => {
    document.title = "System Admin Dashboard";
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 px-6 py-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-500/20">
            <Shield size={20} />
          </div>
          <div>
            <span className="font-bold text-white text-md leading-tight block">System Admin</span>
            <span className="text-xs text-purple-400 font-semibold uppercase tracking-wider">Control Panel</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <Link 
            to="/admin/tenants" 
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-purple-950/40 text-purple-400 hover:bg-purple-950/60"
          >
            <Users size={18} />
            <span>Tenant Management</span>
          </Link>
        </nav>

        <div className="border-t border-slate-800 pt-5">
          <button 
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
          >
            <LogOut size={18} />
            <span>Admin Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-8">
          <h1 className="text-xl font-bold text-white tracking-tight">System Admin Panel</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-7xl animate-fadeIn">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('adminToken');
  return token ? <AdminLayout>{children}</AdminLayout> : <Navigate to="/admin/login" />;
};

const AdminGuestRoute = ({ children }: { children: React.ReactNode }) => {
  const adminToken = localStorage.getItem('adminToken');
  return adminToken ? <Navigate to="/admin/tenants" /> : <>{children}</>;
};

const App = () => {
  return (
    <StoreProvider>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/" element={<PrivateRoute><Overview /></PrivateRoute>} />
          <Route path="/sources" element={<PrivateRoute><Sources /></PrivateRoute>} />
          <Route path="/sources/pdf" element={<PrivateRoute><PDFUpload /></PrivateRoute>} />
          <Route path="/sources/faqs/:sourceId" element={<PrivateRoute><FAQs /></PrivateRoute>} />
          <Route path="/sources/docs/:sourceId" element={<PrivateRoute><TextDocs /></PrivateRoute>} />
          <Route path="/crawl" element={<PrivateRoute><Crawl /></PrivateRoute>} />
          <Route path="/knowledge" element={<PrivateRoute><KnowledgeImprovement /></PrivateRoute>} />
          <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/admin/login" element={<AdminGuestRoute><AdminLogin /></AdminGuestRoute>} />
          <Route path="/admin/tenants" element={<AdminRoute><AdminTenants /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
};

export default App;