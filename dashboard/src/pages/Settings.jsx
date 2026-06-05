import React, { useEffect, useState } from 'react';
import { API_BASE_URL, apiUrl, handleUnauthorized } from '../api';

const Settings = () => {
    const [me, setMe] = useState(null);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [saving, setSaving] = useState(false);

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
            const data = await res.json();
            setMe(data);
            if (data.webhook_url) setWebhookUrl(data.webhook_url);
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

    const updateWebhook = async () => {
        setSaving(true);
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/tenants/webhook'), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ webhook_url: webhookUrl })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            alert("Webhook saved successfully");
        } else {
            alert("Failed to save webhook");
        }
        setSaving(false);
    };

    if (!me) return <div>Loading...</div>;

    const snippet = `<script src="${API_BASE_URL}/static/widget.js" data-api-key="${me.api_key}"></script>`;

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

            <div className="card">
                <h3>Lead Form Webhook (Make.com / Zapier)</h3>
                <p>Paste your Make.com or Zapier webhook URL here. We will POST lead data here when an enquiry form is submitted.</p>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input 
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://hook.us1.make.com/..."
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button className="btn" onClick={updateWebhook} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Webhook'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
