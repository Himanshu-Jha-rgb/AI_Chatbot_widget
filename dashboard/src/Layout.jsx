import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { clearSession } from './api';

const navItems = [
  { label: 'Overview', icon: '◧', path: '/' },
  { label: 'Sources', icon: '▦', path: '/sources' },
  { label: 'Crawl Jobs', icon: '↺', path: '/crawl' },
  { label: 'Knowledge Gaps', icon: '✦', path: '/knowledge', badge: null },
  { label: 'Leads', icon: '◑', path: '/leads' },
  { label: 'Settings', icon: '⚙', path: '/settings' },
];

const Layout = ({ children, gapCount }) => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    document.title = 'EduChat AI';
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

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
          <div className="group">Dashboard</div>
          {navItems.slice(0, 3).map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const badge = item.path === '/knowledge' && gapCount > 0 ? gapCount : null;
            return (
              <Link key={item.path} to={item.path} className={`nav-item${active ? ' active' : ''}`}>
                <span className="ic">{item.icon}</span>
                {item.label}
                {badge !== null && <span className="badge">{badge > 99 ? '99+' : badge}</span>}
              </Link>
            );
          })}

          <div className="group">Engage</div>
          {navItems.slice(3, 5).map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className={`nav-item${active ? ' active' : ''}`}>
                <span className="ic">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          <div className="group">Configure</div>
          {navItems.slice(5).map(item => {
            const active = location.pathname.startsWith(item.path);
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
          <h1 id="pageTitle">EduChat AI</h1>
          <div className="search">
            <span style={{fontSize:'13px'}}>⌕</span>
            <input placeholder="Search..." />
          </div>
        </div>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;