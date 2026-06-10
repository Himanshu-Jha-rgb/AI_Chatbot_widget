import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [domain, setDomain] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        document.title = isRegister ? "Register - EduChat AI" : "Login - EduChat AI";
    }, [isRegister]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'var(--canvas-soft)',
        }}>
            <div style={{ width: '100%', maxWidth: '380px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--ink)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '20px',
                        marginBottom: '16px',
                    }}>E</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '4px' }}>
                        {isRegister ? 'Create account' : 'Welcome back'}
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--body)' }}>
                        {isRegister ? 'Set up your chatbot dashboard' : 'Sign in to your dashboard'}
                    </p>
                </div>

                <div className="card card-pad">
                    {error && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--r-sm)',
                            background: 'var(--error-soft)',
                            color: 'var(--error-deep)',
                            fontSize: '13px',
                            marginBottom: '14px',
                        }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="field">
                            <label>Domain</label>
                            <input
                                className="inp"
                                type="text"
                                placeholder="example.com"
                                value={domain}
                                onChange={e => setDomain(e.target.value)}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Password</label>
                            <input
                                className="inp"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '40px' }} disabled={loading}>
                            {loading ? 'Signing in...' : isRegister ? 'Create Account' : 'Sign In'}
                        </button>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--body)' }}>
                        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--link)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            onClick={() => { setIsRegister(!isRegister); setError(''); }}
                        >
                            {isRegister ? 'Sign in' : 'Register'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;