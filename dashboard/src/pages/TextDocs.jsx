import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl, handleUnauthorized } from '../api';

const TextDocs = () => {
    const { sourceId } = useParams();
    const navigate = useNavigate();
    const [source, setSource] = useState(null);
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [indexing, setIndexing] = useState(false);

    const fetchData = async () => {
        const token = localStorage.getItem('token');

        const [sourceRes, docsRes] = await Promise.all([
            fetch(apiUrl(`/dashboard/sources/${sourceId}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(apiUrl(`/dashboard/sources/${sourceId}/docs`), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
        ]);

        if (handleUnauthorized(sourceRes) || handleUnauthorized(docsRes)) return;

        if (sourceRes.ok) {
            const s = await sourceRes.json();
            if (s.source_type !== 'text') {
                navigate('/sources');
                return;
            }
            setSource(s);
        }
        if (docsRes.ok) {
            setDocs(await docsRes.json());
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [sourceId]);

    const addDoc = async () => {
        if (!newTitle.trim() || !newBody.trim()) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/docs`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: newTitle, body: newBody })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setNewTitle('');
            setNewBody('');
            fetchData();
        }
    };

    const updateDoc = async (docId) => {
        if (!editTitle.trim() || !editBody.trim()) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/docs/${docId}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: editTitle, body: editBody })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setEditingId(null);
            fetchData();
        }
    };

    const deleteDoc = async (docId) => {
        if (!window.confirm('Delete this document? This will also remove its indexed chunks.')) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/docs/${docId}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            fetchData();
        }
    };

    const indexDocs = async () => {
        setIndexing(true);
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/docs/index`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            const poll = setInterval(async () => {
                const sr = await fetch(apiUrl(`/dashboard/sources/${sourceId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (sr.ok) {
                    const s = await sr.json();
                    setSource(s);
                    if (s.status !== 'indexing') {
                        clearInterval(poll);
                        setIndexing(false);
                        fetchData();
                    }
                }
            }, 2000);
        } else {
            setIndexing(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button className="btn" style={{ background: '#666' }} onClick={() => navigate('/sources')}>
                    &larr; Back
                </button>
                <h1 style={{ margin: 0 }}>{source?.name || 'Text Documents'}</h1>
                {source && (
                    <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: source.status === 'ready' ? '#00c85322' : source.status === 'indexing' ? '#ff910022' : '#ff444422',
                        color: source.status === 'ready' ? '#00c853' : source.status === 'indexing' ? '#ff9100' : '#ff4444',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                    }}>
                        {source.status}
                    </span>
                )}
            </div>

            {source && (
                <div style={{ marginBottom: '1rem', color: '#666', fontSize: '14px' }}>
                    {docs.length} document{docs.length !== 1 ? 's' : ''} | {source.chunk_count || 0} chunks indexed
                    {source.last_indexed_at ? ` | Last indexed: ${new Date(source.last_indexed_at).toLocaleString()}` : ''}
                </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3>Add Document</h3>
                <input
                    className="input"
                    placeholder="Document title"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                />
                <textarea
                    className="input"
                    placeholder="Document body (supports markdown formatting with ## headings)"
                    value={newBody}
                    onChange={e => setNewBody(e.target.value)}
                    rows={8}
                    style={{ resize: 'vertical', fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" onClick={addDoc} disabled={!newTitle.trim() || !newBody.trim()}>
                        Add Document
                    </button>
                    <button
                        className="btn"
                        onClick={indexDocs}
                        disabled={indexing || docs.length === 0}
                        style={{ background: docs.length > 0 ? '#0070f3' : '#999' }}
                    >
                        {indexing ? 'Indexing...' : 'Index All Documents'}
                    </button>
                </div>
            </div>

            {docs.length === 0 && (
                <div className="card" style={{ textAlign: 'center', color: '#666' }}>
                    <p>No documents yet. Add your first document above.</p>
                </div>
            )}

            {docs.map(doc => (
                <div key={doc.doc_id} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    {editingId === doc.doc_id ? (
                        <div>
                            <input
                                className="input"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                placeholder="Title"
                            />
                            <textarea
                                className="input"
                                value={editBody}
                                onChange={e => setEditBody(e.target.value)}
                                rows={8}
                                style={{ resize: 'vertical', fontFamily: 'monospace' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => updateDoc(doc.doc_id)} disabled={!editTitle.trim() || !editBody.trim()}>
                                    Save
                                </button>
                                <button className="btn" style={{ background: '#666' }} onClick={() => setEditingId(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, margin: '0 0 0.5rem', fontSize: '16px' }}>{doc.title}</p>
                                    <p style={{ margin: 0, color: '#555', whiteSpace: 'pre-wrap', fontSize: '14px', maxHeight: '120px', overflow: 'hidden' }}>
                                        {doc.body.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexShrink: 0 }}>
                                    <button
                                        className="btn"
                                        style={{ background: '#ff9100' }}
                                        onClick={() => {
                                            setEditingId(doc.doc_id);
                                            setEditTitle(doc.title);
                                            setEditBody(doc.body);
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ background: '#ff4444' }}
                                        onClick={() => deleteDoc(doc.doc_id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default TextDocs;
