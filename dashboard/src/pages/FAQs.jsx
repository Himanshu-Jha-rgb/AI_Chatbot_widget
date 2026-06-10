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
                        <div className="sh-title">{source?.name || 'FAQs'}</div>
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
                    {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''} | {source.chunk_count || 0} chunks indexed
                    {source.last_indexed_at ? ` | Last indexed: ${new Date(source.last_indexed_at).toLocaleDateString()}` : ''}
                </div>
            )}

            <div className="card card-pad" style={{ marginBottom: '18px' }}>
                <div className="card-h">Add FAQ</div>
                <div className="field">
                    <label>Question</label>
                    <input
                        className="inp"
                        placeholder="Enter the question"
                        value={newQuestion}
                        onChange={e => setNewQuestion(e.target.value)}
                    />
                </div>
                <div className="field">
                    <label>Answer</label>
                    <textarea
                        className="inp"
                        placeholder="Enter the answer"
                        value={newAnswer}
                        onChange={e => setNewAnswer(e.target.value)}
                        rows={3}
                        style={{ resize: 'vertical' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={addFaq} disabled={!newQuestion.trim() || !newAnswer.trim()}>
                        Add FAQ
                    </button>
                    <button
                        className="btn"
                        onClick={indexFaqs}
                        disabled={indexing || faqs.length === 0}
                    >
                        {indexing ? 'Indexing...' : 'Index All FAQs'}
                    </button>
                </div>
            </div>

            {faqs.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="e-icon">✦</div>
                        <div className="e-title">No FAQs yet</div>
                        <div className="e-desc">Add your first Q&A pair above.</div>
                    </div>
                </div>
            )}

            {faqs.map(faq => (
                <div key={faq.faq_id} className="card card-pad" style={{ marginBottom: '8px' }}>
                    {editingId === faq.faq_id ? (
                        <div>
                            <div className="field">
                                <input
                                    className="inp"
                                    value={editQuestion}
                                    onChange={e => setEditQuestion(e.target.value)}
                                    placeholder="Question"
                                />
                            </div>
                            <div className="field">
                                <textarea
                                    className="inp"
                                    value={editAnswer}
                                    onChange={e => setEditAnswer(e.target.value)}
                                    rows={3}
                                    style={{ resize: 'vertical' }}
                                    placeholder="Answer"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-primary" onClick={() => updateFaq(faq.faq_id)} disabled={!editQuestion.trim() || !editAnswer.trim()}>
                                    Save
                                </button>
                                <button className="btn" onClick={() => setEditingId(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="faq-q">Q: {faq.question}</div>
                            <div className="faq-a">A: {faq.answer}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button
                                    className="btn btn-sm"
                                    onClick={() => {
                                        setEditingId(faq.faq_id);
                                        setEditQuestion(faq.question);
                                        setEditAnswer(faq.answer);
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => deleteFaq(faq.faq_id)}
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

export default FAQs;
