import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl, handleUnauthorized } from '../api';

const TYPE_LABELS = {
    website: 'Website',
    pdf: 'PDF',
    faq: 'FAQs',
    text: 'Text Document',
};

const STATUS_COLORS = {
    ready: '#00c853',
    indexing: '#ff9100',
    failed: '#ff4444',
};

const Sources = () => {
    const navigate = useNavigate();
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(null); // 'faq' | 'text' | null
    const [newName, setNewName] = useState('');

    const fetchSources = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/dashboard/sources'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setSources(await res.json());
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSources();
    }, []);

    const deleteSource = async (sourceId, name) => {
        if (!window.confirm(`Delete "${name}"? This will remove all indexed data.`)) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            fetchSources();
        }
    };

    const createSource = async (type) => {
        if (!newName.trim()) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/dashboard/sources'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ source_type: type, name: newName })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            const data = await res.json();
            setShowCreate(null);
            setNewName('');
            if (type === 'faq') {
                navigate(`/sources/faqs/${data.source_id}`);
            } else if (type === 'text') {
                navigate(`/sources/docs/${data.source_id}`);
            }
        }
    };

    if (loading) return <div>Loading...</div>;

    const sourcesByType = {};
    for (const s of sources) {
        const type = s.source_type || 'other';
        if (!sourcesByType[type]) sourcesByType[type] = [];
        sourcesByType[type].push(s);
    }

    const orderedTypes = ['website', 'pdf', 'faq', 'text'];

    return (
        <div>
            <h1>Knowledge Sources</h1>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => navigate('/crawl')}>
                    Add Website
                </button>
                <button className="btn" onClick={() => navigate('/sources/pdf')}>
                    Upload PDF
                </button>
                <button className="btn" onClick={() => { setShowCreate('faq'); setNewName(''); }}>
                    Add FAQs
                </button>
                <button className="btn" onClick={() => { setShowCreate('text'); setNewName(''); }}>
                    Add Text Document
                </button>
            </div>

            {showCreate && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3>Create {TYPE_LABELS[showCreate]} Source</h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '14px', color: '#666' }}>Source Name</label>
                            <input
                                className="input"
                                style={{ marginBottom: 0 }}
                                placeholder="e.g., School Policies"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createSource(showCreate)}
                                autoFocus
                            />
                        </div>
                        <button className="btn" onClick={() => createSource(showCreate)} disabled={!newName.trim()}>
                            Create & Manage
                        </button>
                        <button className="btn" style={{ background: '#666' }} onClick={() => setShowCreate(null)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {sources.length === 0 && (
                <div className="card" style={{ textAlign: 'center', color: '#666' }}>
                    <p>No knowledge sources yet. Add one to get started.</p>
                </div>
            )}

            {orderedTypes.map(type => {
                const items = sourcesByType[type] || [];
                if (items.length === 0) return null;
                return (
                    <div key={type} style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#555' }}>{TYPE_LABELS[type] || type}</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {items.map(source => (
                                <div key={source.source_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                            <strong>{source.name}</strong>
                                            <span style={{
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                background: '#eee',
                                                color: '#666',
                                                textTransform: 'uppercase',
                                                fontWeight: 600,
                                            }}>
                                                {TYPE_LABELS[source.source_type] || source.source_type}
                                            </span>
                                            <span style={{
                                                fontSize: '12px',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                background: STATUS_COLORS[source.status] + '22',
                                                color: STATUS_COLORS[source.status],
                                                fontWeight: 600,
                                                textTransform: 'capitalize',
                                            }}>
                                                {source.status}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '14px', color: '#666' }}>
                                            {source.chunk_count || 0} chunks indexed
                                            {source.last_indexed_at ? ` | Last indexed: ${new Date(source.last_indexed_at).toLocaleDateString()}` : ' | Not yet indexed'}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                                        {(source.source_type === 'faq') && (
                                            <button className="btn" onClick={() => navigate(`/sources/faqs/${source.source_id}`)}>
                                                Manage FAQs
                                            </button>
                                        )}
                                        {(source.source_type === 'text') && (
                                            <button className="btn" onClick={() => navigate(`/sources/docs/${source.source_id}`)}>
                                                Manage Docs
                                            </button>
                                        )}
                                        <button
                                            className="btn"
                                            style={{ background: '#ff4444' }}
                                            onClick={() => deleteSource(source.source_id, source.name)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Sources;
