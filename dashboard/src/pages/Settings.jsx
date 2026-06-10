import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Settings = () => {
  const [me, setMe] = useState(null);
  const [manualQuestions, setManualQuestions] = useState([]);
  const [autoQuestions, setAutoQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchMe(); }, []);

  const fetchMe = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl('/tenants/me'), {
      headers: { Authorization: `Bearer ${token}` }
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
    if (!window.confirm('Are you sure? This will invalidate your current API key and break existing widget installations.')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl('/tenants/rotate_key'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ questions: manualQuestions })
      });
      if (handleUnauthorized(res)) return;
      if (res.ok) alert('Suggested questions saved!');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1700);
  };

  if (!me) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  const widgetUrl = window.location.origin;
  const snippet = `<script src="${widgetUrl}/static/widget.js" data-api-key="${me.api_key}"></script>`;

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Settings</div>
          <div className="sh-desc">API keys, installation, and suggested questions.</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '14px' }}>
        <div className="card-h">API Key</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <code style={{ background: 'var(--canvas-soft-2)', padding: '8px 12px', borderRadius: 'var(--r-sm)', flex: 1, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.api_key}</code>
          <button className="btn btn-sm btn-danger" onClick={rotateKey}>Rotate Key</button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '14px' }}>
        <div className="card-h">Installation</div>
        <div className="card-desc">Add this code snippet just before the closing <code>&lt;/body&gt;</code> tag of your website:</div>
        <div className="code" style={{ marginTop: '10px' }}>
          <button className="copy-btn" onClick={() => copyToClipboard(snippet)}>{copied ? 'Copied!' : 'Copy'}</button>
          <code style={{ color: '#CFE9DE', whiteSpace: 'pre-wrap' }}>{snippet}</code>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '14px' }}>
        <div className="card-h">Domain</div>
        <p style={{ fontSize: '13px' }}>Your registered domain: <strong>{me.domain}</strong></p>
        <p style={{ fontSize: '12.5px', color: 'var(--body)', marginTop: '4px' }}>Only requests originating from this domain will be accepted by your API key.</p>
      </div>

      <div className="card card-pad">
        <div className="card-h">Suggested Questions</div>
        <div className="card-desc">These appear as clickable chips when a visitor opens the chat widget with no messages yet.</div>

        {autoQuestions.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--mute)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.03em' }}>Auto-generated from content:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {autoQuestions.map((q, i) => (
                <span key={i} className="pill pill-neutral" style={{ padding: '4px 10px', fontSize: '12px' }}>{q}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--mute)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.03em' }}>Manual questions:</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              className="inp"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Type a suggested question..."
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
            />
            <button className="btn" onClick={addQuestion}>Add</button>
          </div>

          {manualQuestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {manualQuestions.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--canvas-soft)', borderRadius: 'var(--r-sm)', fontSize: '13px' }}>
                  <span>{q}</span>
                  <button onClick={() => removeQuestion(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '15px', padding: '0 4px' }}>&times;</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--mute)', fontSize: '12px', fontStyle: 'italic' }}>No manual questions added yet.</p>
          )}
        </div>

        <button className="btn btn-primary" onClick={saveQuestions} disabled={saving}>
          {saving ? 'Saving...' : 'Save Questions'}
        </button>
      </div>
    </div>
  );
};

export default Settings;