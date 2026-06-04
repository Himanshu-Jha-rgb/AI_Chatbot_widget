import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Crawl from './pages/Crawl';
import Settings from './pages/Settings';
import Sources from './pages/Sources';
import PDFUpload from './pages/PDFUpload';
import FAQs from './pages/FAQs';
import TextDocs from './pages/TextDocs';
import Leads from './pages/Leads';
import { clearSession } from './api';

const Layout = ({ children }) => {
    const navigate = useNavigate();
    const handleLogout = () => {
        clearSession();
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <div style={{ width: '250px', background: '#111', color: '#fff', padding: '2rem' }}>
                <h2 style={{ color: '#fff', marginTop: 0 }}>Dashboard</h2>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '2rem' }}>
                    <Link to="/" style={{ color: '#aaa', textDecoration: 'none' }}>Overview</Link>
                    <Link to="/sources" style={{ color: '#aaa', textDecoration: 'none' }}>Knowledge Sources</Link>
                    <Link to="/leads" style={{ color: '#aaa', textDecoration: 'none' }}>Leads</Link>
                    <Link to="/crawl" style={{ color: '#aaa', textDecoration: 'none' }}>Website Crawl</Link>
                    <Link to="/settings" style={{ color: '#aaa', textDecoration: 'none' }}>Settings</Link>
                    <button onClick={handleLogout} style={{ marginTop: 'auto', background: 'none', border: 'none', color: '#ff4444', textAlign: 'left', cursor: 'pointer', padding: 0 }}>Logout</button>
                </nav>
            </div>
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<PrivateRoute><Overview /></PrivateRoute>} />
                <Route path="/sources" element={<PrivateRoute><Sources /></PrivateRoute>} />
                <Route path="/sources/pdf" element={<PrivateRoute><PDFUpload /></PrivateRoute>} />
                <Route path="/sources/faqs/:sourceId" element={<PrivateRoute><FAQs /></PrivateRoute>} />
                <Route path="/sources/docs/:sourceId" element={<PrivateRoute><TextDocs /></PrivateRoute>} />
                <Route path="/crawl" element={<PrivateRoute><Crawl /></PrivateRoute>} />
                <Route path="/leads" element={<PrivateRoute><Leads /></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
