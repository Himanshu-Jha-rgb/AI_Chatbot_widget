import React, { useEffect, useState } from 'react';
import { API_BASE_URL, apiUrl, handleUnauthorized } from '../api';

const Settings = () => {
    const [me, setMe] = useState(null);
    const [manualQuestions, setManualQuestions] = useState([]);
    const [autoQuestions, setAutoQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
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
            setManualQuestions(data.suggested_questions_manual || []);
            setAutoQuestions(data.suggested_questions_auto || []);
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

    const addQuestion = () => {
        const q = newQuestion.trim();
        if (!q || manualQuestions.includes(q)) return;
        setManualQuestions([...manualQuestions, q]);
        setNewQuestion('');
    };

    const removeQuestion = (index) => {
        setManualQuestions(manualQuestions.filter((_, i) => i !== index));
    };

    const saveQuestions = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl('/tenants/suggested-questions'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ questions: manualQuestions })
            });
            if (handleUnauthorized(res)) return;
            if (res.ok) {
                alert('Suggested questions saved!');
            }
        } finally {
            setSaving(false);
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

            <div className="card">
                <h3>Suggested Questions (Empty Chat)</h3>
                <p style={{ color: '#666', fontSize: '14px', marginBottom: '1rem' }}>
                    These questions appear as clickable chips when a visitor opens the chat widget with no messages yet.
                    If you add manual questions, they will be shown instead of auto-generated ones.
                </p>

                {autoQuestions.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '14px', color: '#888', margin: '0 0 8px 0' }}>Auto-generated (from content):</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {autoQuestions.map((q, i) => (
                                <span key={i} style={{ padding: '4px 10px', borderRadius: '6px', background: '#f0f0f0', fontSize: '13px', color: '#555' }}>{q}</span>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '14px', margin: '0 0 8px 0' }}>Manual questions:</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <input
                            className="input"
                            style={{ marginBottom: 0, flex: 1 }}
                            placeholder="Type a suggested question..."
                            value={newQuestion}
                            onChange={e => setNewQuestion(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && addQuestion()}
                        />
                        <button className="btn" onClick={addQuestion}>Add</button>
                    </div>

                    {manualQuestions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {manualQuestions.map((q, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f8f9fa', borderRadius: '6px', fontSize: '14px' }}>
                                    <span>{q}</span>
                                    <button
                                        onClick={() => removeQuestion(i)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: '16px', padding: '0 4px' }}
                                    >&times;</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#aaa', fontSize: '13px', fontStyle: 'italic' }}>No manual questions added yet.</p>
                    )}
                </div>

                <button className="btn" onClick={saveQuestions} disabled={saving} style={{ marginTop: '0.5rem' }}>
                    {saving ? 'Saving...' : 'Save Questions'}
                </button>
            </div>
        </div>
    );
};

export default Settings;
