import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

const AdminLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        document.title = "System Admin Login";
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(apiUrl('/admin/login'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('adminToken', data.access_token);
            navigate('/admin/tenants');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#000' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', background: '#111', color: '#fff', border: '1px solid #333' }}>
                <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '1.75rem', fontWeight: '600' }}>System Admin Login</h1>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '4px' }}>{error}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Admin Username</label>
                        <input
                            className="input"
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', margin: 0 }}
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Password</label>
                        <input
                            className="input"
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', margin: 0 }}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button className="btn" type="submit" disabled={loading} style={{ background: '#a855f7', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem' }}>
                        {loading ? 'Logging in...' : 'Enter Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
