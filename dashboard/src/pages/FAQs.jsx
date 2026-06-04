import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl, handleUnauthorized } from '../api';

const FAQs = () => {
    const { sourceId } = useParams();
    const navigate = useNavigate();
    const [source, setSource] = useState(null);
    const [faqs, setFaqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editQuestion, setEditQuestion] = useState('');
    const [editAnswer, setEditAnswer] = useState('');
    const [indexing, setIndexing] = useState(false);

    const fetchData = async () => {
        const token = localStorage.getItem('token');

        const [sourceRes, faqsRes] = await Promise.all([
            fetch(apiUrl(`/dashboard/sources/${sourceId}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(apiUrl(`/dashboard/sources/${sourceId}/faqs`), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
        ]);

        if (handleUnauthorized(sourceRes) || handleUnauthorized(faqsRes)) return;

        if (sourceRes.ok) {
            const s = await sourceRes.json();
            if (s.source_type !== 'faq') {
                navigate('/sources');
                return;
            }
            setSource(s);
        }
        if (faqsRes.ok) {
            setFaqs(await faqsRes.json());
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [sourceId]);

    const addFaq = async () => {
        if (!newQuestion.trim() || !newAnswer.trim()) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/faqs`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question: newQuestion, answer: newAnswer })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setNewQuestion('');
            setNewAnswer('');
            fetchData();
        }
    };

    const updateFaq = async (faqId) => {
        if (!editQuestion.trim() || !editAnswer.trim()) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/faqs/${faqId}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question: editQuestion, answer: editAnswer })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            setEditingId(null);
            fetchData();
        }
    };

    const deleteFaq = async (faqId) => {
        if (!window.confirm('Delete this FAQ?')) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/faqs/${faqId}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            fetchData();
        }
    };

    const indexFaqs = async () => {
        setIndexing(true);
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/sources/${sourceId}/faqs/index`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            // Poll for indexing completion
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
                <h1 style={{ margin: 0 }}>{source?.name || 'FAQs'}</h1>
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
                    {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''} | {source.chunk_count || 0} chunks indexed
                    {source.last_indexed_at ? ` | Last indexed: ${new Date(source.last_indexed_at).toLocaleString()}` : ''}
                </div>
            )}

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3>Add FAQ</h3>
                <input
                    className="input"
                    placeholder="Question"
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                />
                <textarea
                    className="input"
                    placeholder="Answer"
                    value={newAnswer}
                    onChange={e => setNewAnswer(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" onClick={addFaq} disabled={!newQuestion.trim() || !newAnswer.trim()}>
                        Add FAQ
                    </button>
                    <button
                        className="btn"
                        onClick={indexFaqs}
                        disabled={indexing || faqs.length === 0}
                        style={{ background: faqs.length > 0 ? '#0070f3' : '#999' }}
                    >
                        {indexing ? 'Indexing...' : 'Index All FAQs'}
                    </button>
                </div>
            </div>

            {faqs.length === 0 && (
                <div className="card" style={{ textAlign: 'center', color: '#666' }}>
                    <p>No FAQs yet. Add your first Q&A pair above.</p>
                </div>
            )}

            {faqs.map(faq => (
                <div key={faq.faq_id} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    {editingId === faq.faq_id ? (
                        <div>
                            <input
                                className="input"
                                value={editQuestion}
                                onChange={e => setEditQuestion(e.target.value)}
                                placeholder="Question"
                            />
                            <textarea
                                className="input"
                                value={editAnswer}
                                onChange={e => setEditAnswer(e.target.value)}
                                rows={3}
                                style={{ resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn" onClick={() => updateFaq(faq.faq_id)} disabled={!editQuestion.trim() || !editAnswer.trim()}>
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
                                    <p style={{ fontWeight: 600, margin: '0 0 0.25rem' }}>Q: {faq.question}</p>
                                    <p style={{ margin: 0, color: '#555', whiteSpace: 'pre-wrap' }}>A: {faq.answer}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexShrink: 0 }}>
                                    <button
                                        className="btn"
                                        style={{ background: '#ff9100' }}
                                        onClick={() => {
                                            setEditingId(faq.faq_id);
                                            setEditQuestion(faq.question);
                                            setEditAnswer(faq.answer);
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ background: '#ff4444' }}
                                        onClick={() => deleteFaq(faq.faq_id)}
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

export default FAQs;
