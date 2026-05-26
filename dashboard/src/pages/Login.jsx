import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [domain, setDomain] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const endpoint = isRegister ? '/tenants/register' : '/tenants/login';
        
        try {
            const res = await fetch(apiUrl(endpoint), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.detail || 'Authentication failed');
            
            localStorage.setItem('token', data.access_token);
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2>{isRegister ? 'Register' : 'Login'}</h2>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div>
                        <label>Domain</label>
                        <input className="input" type="text" value={domain} onChange={e => setDomain(e.target.value)} required />
                    </div>
                    <div>
                        <label>Password</label>
                        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn" style={{ width: '100%' }}>
                        {isRegister ? 'Sign Up' : 'Sign In'}
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '1rem' }}>
                    {isRegister ? 'Already have an account? ' : 'Need an account? '}
                    <button style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }} onClick={() => setIsRegister(!isRegister)}>
                        {isRegister ? 'Login' : 'Register'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Login;
