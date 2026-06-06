import React, { useEffect, useState } from 'react';
import { API_BASE_URL, apiUrl, handleUnauthorized } from '../api';

const Settings = () => {
    const [me, setMe] = useState(null);

    useEffect(() => {
        fetchMe();
    }, []);

    const fetchMe = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/tenants/me'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setMe(await res.json());
        }
    };

    const rotateKey = async () => {
        if (!window.confirm("Are you sure? This will invalidate your current API key and break existing widget installations.")) return;
        
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/tenants/rotate_key'), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            const data = await res.json();
            setMe({ ...me, api_key: data.api_key });
        }
    };

    if (!me) return <div>Loading...</div>;

    const widgetUrl = window.location.origin;
    const snippet = `<script src="${widgetUrl}/static/widget.js" data-api-key="${me.api_key}"></script>`;

    return (
        <div>
            <h1>Settings</h1>
            <div className="card">
                <h3>API Key</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    <code style={{ background: '#eee', padding: '0.5rem', borderRadius: '4px', flex: 1 }}>{me.api_key}</code>
                    <button className="btn" onClick={rotateKey} style={{ background: '#ff4444' }}>Rotate Key</button>
                </div>
            </div>

            <div className="card">
                <h3>Installation</h3>
                <p>Add this code snippet to the <code>&lt;head&gt;</code> or just before the closing <code>&lt;/body&gt;</code> tag of your website:</p>
                <div style={{ position: 'relative' }}>
                    <pre style={{ background: '#111', color: '#fff', padding: '1rem', borderRadius: '4px', overflowX: 'auto' }}>
                        <code>{snippet}</code>
                    </pre>
                    <button 
                        onClick={() => navigator.clipboard.writeText(snippet)}
                        className="btn" 
                        style={{ position: 'absolute', top: '10px', right: '10px', padding: '0.25rem 0.5rem', fontSize: '12px' }}
                    >
                        Copy
                    </button>
                </div>
            </div>
            
            <div className="card">
                <h3>Domain</h3>
                <p>Your registered domain: <strong>{me.domain}</strong></p>
                <p style={{ color: '#666', fontSize: '14px' }}>Only requests originating from this domain will be accepted by your API key.</p>
            </div>
        </div>
    );
};

export default Settings;
