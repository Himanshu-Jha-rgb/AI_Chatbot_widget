import React, { useEffect, useState, useCallback } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const STATUS_COLORS = { open: 'pill-warn', resolved: 'pill-ok', dismissed: 'pill-neutral' };

const KnowledgeImprovement = () => {
  const [gaps, setGaps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [sources, setSources] = useState([]);
  const [resolving, setResolving] = useState(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', source_id: '' });

  const fetchGaps = useCallback(async () => {
    const token = localStorage.getItem('token');
    const [gapsRes, statsRes, sourcesRes] = await Promise.all([
      fetch(apiUrl(`/dashboard/knowledge/gaps?status=${filter}`), {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(apiUrl('/dashboard/knowledge/gaps/stats'), {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(apiUrl('/dashboard/sources'), {
        headers: { Authorization: `Bearer ${token}` }
      }),
    ]);
    if (handleUnauthorized(gapsRes)) return;
    if (gapsRes.ok) setGaps(await gapsRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    if (sourcesRes.ok) setSources(await sourcesRes.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchGaps(); }, [fetchGaps]);

  const resolveGap = async (gapId, action) => {
    const token = localStorage.getItem('token');
    const body = { action };

    if (action === 'create_faq') {
      if (!faqForm.question.trim() || !faqForm.answer.trim() || !faqForm.source_id) return;
      body.faq_question = faqForm.question;
      body.faq_answer = faqForm.answer;
      body.source_id = faqForm.source_id;
    }

    setResolving(gapId);
    const res = await fetch(apiUrl(`/dashboard/knowledge/gaps/${gapId}/resolve`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setResolving(null);

    if (res.ok) {
      setFaqForm({ question: '', answer: '', source_id: '' });
      fetchGaps();
    }
  };

  const startResolve = (gap) => {
    setFaqForm(prev => ({ ...prev, question: gap.query }));
    setResolving(gap.gap_id);
  };

  const cancelResolve = () => {
    setResolving(null);
    setFaqForm({ question: '', answer: '', source_id: '' });
  };

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Knowledge Improvement</div>
          <div className="sh-desc">Queries the bot couldn't answer — grouped by similarity. Add FAQs to fill gaps.</div>
        </div>
        <div className="seg">
          {['open', 'resolved', 'all'].map(s => (
            <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
              {s === 'open' ? 'Unresolved' : s === 'resolved' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid g4" style={{ marginBottom: '18px' }}>
          <div className="kpi">
            <div className="k-label">Unresolved gaps</div>
            <div className="k-val" style={{ color: 'var(--error)' }}>{stats.open}</div>
          </div>
          <div className="kpi">
            <div className="k-label">Resolved</div>
            <div className="k-val" style={{ color: 'var(--teal-deep)' }}>{stats.resolved}</div>
          </div>
          <div className="kpi">
            <div className="k-label">Total recorded</div>
            <div className="k-val">{stats.total}</div>
          </div>
          <div className="kpi">
            <div className="k-label">Top gap asked</div>
            <div className="k-val" style={{ fontSize: '20px' }}>
              {stats.top_gaps?.[0]?.count || 0}
            </div>
            <div className="k-sub">times</div>
          </div>
        </div>
      )}

      {/* Top gaps list */}
      {stats?.top_gaps?.length > 0 && filter === 'open' && (
        <div className="card card-pad" style={{ marginBottom: '18px' }}>
          <div className="card-h">Most asked unanswered questions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stats.top_gaps.slice(0, 5).map((g, i) => (
              <div key={g.gap_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--hairline)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 600, minWidth: '20px' }}>#{i + 1}</span>
                  <span style={{ fontSize: '13px' }}>{g.query}</span>
                </div>
                <span className="pill pill-warn" style={{ flexShrink: 0 }}>{g.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All gaps */}
      <div className="card">
        {gaps.length === 0 ? (
          <div className="empty-state">
            <div className="e-icon">✦</div>
            <div className="e-title">No knowledge gaps</div>
            <div className="e-desc">
              {filter === 'open' ? 'All questions are being answered. Gaps appear here when the bot doesn\'t have information.' :
               filter === 'resolved' ? 'No resolved gaps yet.' : 'No gaps found.'}
            </div>
          </div>
        ) : (
          <div>
            {gaps.map(gap => (
              <div key={gap.gap_id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, fontSize: '13.5px' }}>{gap.query}</span>
                        <span className={`pill ${STATUS_COLORS[gap.status] || 'pill-neutral'}`}>{gap.status}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--mute)' }}>
                        <span>Asked <strong>{gap.count}</strong> times</span>
                        {gap.url && <span>on {new URL(gap.url).hostname}</span>}
                        <span>Last: {new Date(gap.last_seen).toLocaleDateString()}</span>
                      </div>

                      {/* Similar existing FAQs */}
                      {gap.similar_faqs?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--teal-deep)', marginBottom: '4px', letterSpacing: '.03em', textTransform: 'uppercase' }}>
                            Similar content found in FAQs:
                          </div>
                          {gap.similar_faqs.map(sf => (
                            <div key={sf.faq_id} style={{ padding: '6px 10px', background: 'var(--canvas-soft)', borderRadius: 'var(--r-sm)', marginBottom: '4px', fontSize: '12px' }}>
                              <div style={{ fontWeight: 500 }}>{sf.question}</div>
                              <div style={{ color: 'var(--body)', fontSize: '11.5px', marginTop: '2px' }}>{sf.answer?.substring(0, 120)}{sf.answer?.length > 120 ? '...' : ''}</div>
                              <div style={{ fontSize: '10px', color: 'var(--teal-deep)', marginTop: '2px' }}>{Math.round(sf.similarity * 100)}% match</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {gap.status === 'open' && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => startResolve(gap)}>
                            + Answer
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => resolveGap(gap.gap_id, 'dismiss')}>
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resolve form */}
                  {resolving === gap.gap_id && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--canvas-soft)', borderRadius: 'var(--r-sm)', border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Add FAQ answer</div>
                      <div className="field">
                        <label>Question</label>
                        <input className="inp" value={faqForm.question} onChange={e => setFaqForm(p => ({ ...p, question: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label>Answer</label>
                        <textarea className="ta" value={faqForm.answer} onChange={e => setFaqForm(p => ({ ...p, answer: e.target.value }))} rows={3} />
                      </div>
                      <div className="field">
                        <label>FAQ Source</label>
                        <select className="sel" value={faqForm.source_id} onChange={e => setFaqForm(p => ({ ...p, source_id: e.target.value }))}>
                          <option value="">Select a source...</option>
                          {sources.filter(s => s.source_type === 'faq').map(s => (
                            <option key={s.source_id} value={s.source_id}>{s.name}</option>
                          ))}
                        </select>
                        <div className="hint">Select an existing FAQ source or create one in Sources first.</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => resolveGap(gap.gap_id, 'create_faq')}
                          disabled={!faqForm.question.trim() || !faqForm.answer.trim() || !faqForm.source_id}
                        >
                          Create & Index FAQ
                        </button>
                        <button className="btn" onClick={cancelResolve}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeImprovement;