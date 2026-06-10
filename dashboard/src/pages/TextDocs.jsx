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

    if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

    return (
        <div>
            <div className="sec-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn" onClick={() => navigate('/sources')}>&larr; Back</button>
                    <div>
                        <div className="sh-title">{source?.name || 'Text Documents'}</div>
                        {source && (
                            <span className={`pill ${source.status === 'ready' ? 'pill-ok' : source.status === 'indexing' ? 'pill-warn' : 'pill-danger'}`}>
                                {source.status}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {source && (
                <div style={{ fontSize: '13px', color: 'var(--body)', marginBottom: '16px' }}>
                    {docs.length} document{docs.length !== 1 ? 's' : ''} | {source.chunk_count || 0} chunks indexed
                    {source.last_indexed_at ? ` | Last indexed: ${new Date(source.last_indexed_at).toLocaleDateString()}` : ''}
                </div>
            )}

            <div className="card card-pad" style={{ marginBottom: '18px' }}>
                <div className="card-h">Add Document</div>
                <div className="field">
                    <label>Document Title</label>
                    <input
                        className="inp"
                        placeholder="Document title"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                    />
                </div>
                <div className="field">
                    <label>Document Body</label>
                    <textarea
                        className="inp"
                        placeholder="Document body (supports markdown formatting with ## headings)"
                        value={newBody}
                        onChange={e => setNewBody(e.target.value)}
                        rows={8}
                        style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={addDoc} disabled={!newTitle.trim() || !newBody.trim()}>
                        Add Document
                    </button>
                    <button
                        className="btn"
                        onClick={indexDocs}
                        disabled={indexing || docs.length === 0}
                    >
                        {indexing ? 'Indexing...' : 'Index All Documents'}
                    </button>
                </div>
            </div>

            {docs.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="e-icon">▦</div>
                        <div className="e-title">No documents yet</div>
                        <div className="e-desc">Add your first document above.</div>
                    </div>
                </div>
            )}

            {docs.map(doc => (
                <div key={doc.doc_id} className="card card-pad" style={{ marginBottom: '8px' }}>
                    {editingId === doc.doc_id ? (
                        <div>
                            <div className="field">
                                <input
                                    className="inp"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    placeholder="Title"
                                />
                            </div>
                            <div className="field">
                                <textarea
                                    className="inp"
                                    value={editBody}
                                    onChange={e => setEditBody(e.target.value)}
                                    rows={8}
                                    style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                                    placeholder="Document body"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-primary" onClick={() => updateDoc(doc.doc_id)} disabled={!editTitle.trim() || !editBody.trim()}>
                                    Save
                                </button>
                                <button className="btn" onClick={() => setEditingId(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>{doc.title}</div>
                            <div style={{ fontSize: '13px', color: 'var(--body)', whiteSpace: 'pre-wrap', maxHeight: '100px', overflow: 'hidden' }}>
                                {doc.body.length > 500 ? doc.body.slice(0, 500) + '...' : doc.body}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button
                                    className="btn btn-sm"
                                    onClick={() => {
                                        setEditingId(doc.doc_id);
                                        setEditTitle(doc.title);
                                        setEditBody(doc.body);
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteDoc(doc.doc_id)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default TextDocs;
