import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Crawl from './pages/Crawl';
import Settings from './pages/Settings';
import Sources from './pages/Sources';
import PDFUpload from './pages/PDFUpload';
import FAQs from './pages/FAQs';
import TextDocs from './pages/TextDocs';
import Leads from './pages/Leads';
import KnowledgeImprovement from './pages/KnowledgeImprovement';
import AdminTenants from './pages/AdminTenants';
import AdminLogin from './pages/AdminLogin';
import { clearSession } from './api';

const navItems = [
  { label: 'Overview', icon: '◧', path: '/' },
  { label: 'Sources', icon: '▦', path: '/sources' },
  { label: 'Crawl Jobs', icon: '↺', path: '/crawl' },
  { label: 'Knowledge Gaps', icon: '✦', path: '/knowledge' },
  { label: 'Leads', icon: '◑', path: '/leads' },
  { label: 'Settings', icon: '⚙', path: '/settings' },
];

const Layout = ({ children, gapCount }) => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => { document.title = 'EduChat AI'; }, []);

  const handleLogout = () => { clearSession(); navigate('/login'); };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">E</div>
          <div>
            <div className="b-name">EduChat AI</div>
            <div style={{fontSize:'10.5px',color:'var(--mute)'}}>Admin panel</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className={`nav-item${active ? ' active' : ''}`}>
                <span className="ic">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="u-ava">RK</div>
            <div style={{flex:1}}>
              <div className="u-name">Admin</div>
              <div className="u-role">Tenant admin</div>
            </div>
            <button onClick={handleLogout} style={{background:'none',border:'none',cursor:'pointer',color:'var(--mute)',fontSize:'12px'}} title="Logout">⏻</button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <div className="topbar">
          <h1>EduChat AI</h1>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const AdminLayout = ({ children }) => {
  const navigate = useNavigate();
  React.useEffect(() => { document.title = "System Admin Dashboard"; }, []);
  const handleLogout = () => { localStorage.removeItem('adminToken'); navigate('/admin/login'); };
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ width: '250px', background: '#000', color: '#fff', padding: '2rem', borderRight: '1px solid #333' }}>
        <h2 style={{ color: '#fff', marginTop: 0 }}>System Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
          <Link to="/admin/tenants" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: '500' }}>Tenant Management</Link>
          <button onClick={handleLogout} style={{ marginTop: 'auto', background: 'none', border: 'none', color: '#ff4444', textAlign: 'left', cursor: 'pointer', padding: 0 }}>Admin Logout</button>
        </nav>
      </div>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>{children}</div>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  return token ? <AdminLayout>{children}</AdminLayout> : <Navigate to="/admin/login" />;
};

const App = () => {
  return (
    <BrowserRouter basename="/dashboard">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Overview /></PrivateRoute>} />
        <Route path="/sources" element={<PrivateRoute><Sources /></PrivateRoute>} />
        <Route path="/sources/pdf" element={<PrivateRoute><PDFUpload /></PrivateRoute>} />
        <Route path="/sources/faqs/:sourceId" element={<PrivateRoute><FAQs /></PrivateRoute>} />
        <Route path="/sources/docs/:sourceId" element={<PrivateRoute><TextDocs /></PrivateRoute>} />
        <Route path="/crawl" element={<PrivateRoute><Crawl /></PrivateRoute>} />
        <Route path="/knowledge" element={<PrivateRoute><KnowledgeImprovement /></PrivateRoute>} />
        <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/tenants" element={<AdminRoute><AdminTenants /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;