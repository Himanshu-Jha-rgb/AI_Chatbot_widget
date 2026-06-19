import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl, handleUnauthorized } from '../api';

const TYPE_LABELS = {
  website: 'Website',
  pdf: 'PDF',
  faq: 'FAQs',
  text: 'Text Document',
};

const TYPE_ICONS = {
  website: { bg: '#d3e5ff', color: '#0761d1', label: 'URL' },
  pdf: { bg: '#f7d4d6', color: '#c50000', label: 'PDF' },
  faq: { bg: '#ffefcf', color: '#ab570a', label: 'FAQ' },
  text: { bg: '#d8ccf1', color: '#4c2889', label: 'DOC' },
};

const DeleteModal = ({ source, onConfirm, onCancel }) => {
  const [confirmName, setConfirmName] = useState('');
  const displayName = source.source_type === 'website' ? source.config?.seed_url : source.name;
  const matchName = source.source_type === 'website' ? source.config?.seed_url : source.name;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">Delete Source</div>
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '12px' }}>
          This will permanently delete <strong>{displayName}</strong> and all its indexed data. This action cannot be undone.
        </p>
        <div className="field">
          <label>Type <strong>{matchName}</strong> to confirm</label>
          <input
            className="inp"
            placeholder={matchName}
            value={confirmName}
            onChange={e => setConfirmName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={confirmName !== matchName}
            onClick={() => onConfirm(source)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const Sources = () => {
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(null);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSources = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl('/dashboard/sources'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (handleUnauthorized(res)) return;
    if (res.ok) setSources(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSources(); }, []);

  useEffect(() => {
    const hasIndexing = sources.some(s => s.status === 'indexing');
    if (!hasIndexing) return;
    const interval = setInterval(fetchSources, 3000);
    return () => clearInterval(interval);
  }, [sources]);

  const handleDelete = async (source) => {
    setDeleting(true);
    const token = localStorage.getItem('token');
    const isCrawl = source.source_type === 'website';
    const url = isCrawl
      ? apiUrl(`/dashboard/sources/crawl/${source.config?.job_id || source.source_id.replace('crawl_', '')}`)
      : apiUrl(`/dashboard/sources/${source.source_id}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (handleUnauthorized(res)) return;
    if (res.ok) {
      setDeleteTarget(null);
      fetchSources();
    }
    setDeleting(false);
  };

  const createSource = async (type) => {
    if (!newName.trim()) return;
    const token = localStorage.getItem('token');
    const res = await fetch(apiUrl('/dashboard/sources'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source_type: type, name: newName })
    });
    if (handleUnauthorized(res)) return;
    if (res.ok) {
      const data = await res.json();
      setShowCreate(null);
      setNewName('');
      if (type === 'faq') navigate(`/sources/faqs/${data.source_id}`);
      else if (type === 'text') navigate(`/sources/docs/${data.source_id}`);
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  const sourcesByType = {};
  for (const s of sources) {
    const type = s.source_type || 'other';
    if (!sourcesByType[type]) sourcesByType[type] = [];
    sourcesByType[type].push(s);
  }

  const orderedTypes = ['website', 'pdf', 'faq', 'text'];

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Knowledge Sources</div>
          <div className="sh-desc">The content your bot answers from. Add new, re-crawl, or remove old.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => navigate('/crawl')}>+ Website</button>
        <button className="btn" onClick={() => navigate('/sources/pdf')}>Upload PDF</button>
        <button className="btn" onClick={() => { setShowCreate('faq'); setNewName(''); }}>+ FAQs</button>
        <button className="btn" onClick={() => { setShowCreate('text'); setNewName(''); }}>+ Text Document</button>
      </div>

      {showCreate && (
        <div className="card card-pad" style={{ marginBottom: '14px' }}>
          <div className="card-h">Create {TYPE_LABELS[showCreate]} Source</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Source Name</label>
              <input className="inp" placeholder="e.g., School Policies" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createSource(showCreate)} autoFocus />
            </div>
            <button className="btn btn-primary" onClick={() => createSource(showCreate)} disabled={!newName.trim()}>Create</button>
            <button className="btn" onClick={() => setShowCreate(null)}>Cancel</button>
          </div>
        </div>
      )}

      {sources.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="e-icon">▦</div>
            <div className="e-title">No knowledge sources yet</div>
            <div className="e-desc">Crawl a website, upload a PDF, or add FAQs to get started.</div>
          </div>
        </div>
      )}

      {orderedTypes.map(type => {
        const items = sourcesByType[type] || [];
        if (items.length === 0) return null;
        const icon = TYPE_ICONS[type] || { bg: '#eee', color: '#666', label: '???' };
        return (
          <div key={type} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: '8px', padding: '0 2px' }}>
              {TYPE_LABELS[type] || type} · {items.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map(source => {
                const isWebsite = source.source_type === 'website';
                const chunkCount = source.chunk_count || 0;
                return (
                  <div key={source.source_id} className="src-row">
                    <div className="s-icon" style={{ background: icon.bg, color: icon.color }}>{icon.label}</div>
                    <div className="s-meta">
                      <div className="s-name" title={isWebsite ? source.config?.seed_url : source.name}>
                        {isWebsite ? source.config?.seed_url || source.name : source.name}
                      </div>
                      <div className="s-sub">
                        {chunkCount} chunks indexed
                        {source.last_indexed_at ? ` · last indexed ${new Date(source.last_indexed_at).toLocaleDateString()}` : ''}
                        {isWebsite && source.config?.pages_found ? ` · ${source.config.pages_found} pages` : ''}
                      </div>
                    </div>
                    <span className={`pill ${source.status === 'ready' ? 'pill-ok' : source.status === 'indexing' ? 'pill-warn' : source.status === 'failed' ? 'pill-danger' : 'pill-ok'}`} style={{ flexShrink: 0 }}>
                      {source.status === 'indexing' ? 'Indexing...' : source.status === 'failed' ? 'Failed' : 'Ready'}
                    </span>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(source)} style={{ marginLeft: '8px' }}>
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {deleteTarget && (
        <DeleteModal
          source={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default Sources;
