import React, { useState, useEffect } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Crawl = () => {
  const [seedUrl, setSeedUrl] = useState('');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [crawlError, setCrawlError] = useState('');

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/dashboard/crawl/history'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (handleUnauthorized(res)) return;
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch crawl history:', err);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleCrawl = async () => {
    if (!seedUrl || isStarting) return;
    setIsStarting(true);
    setCrawlError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(apiUrl('/dashboard/crawl'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ seed_url: seedUrl })
      });
      if (handleUnauthorized(res)) return;
      const data = await res.json();
      if (!res.ok) { setCrawlError(data.detail || 'Failed to start crawl'); return; }
      setJobId(data.job_id);
      setJobStatus(null);
      setSeedUrl('');
      fetchHistory();
    } catch (err) {
      setCrawlError('Network error — is the server reachable?');
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl(`/dashboard/crawl/${jobId}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) { clearInterval(interval); return; }
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
          if (data.status === 'done' || data.status === 'failed') {
            clearInterval(interval);
            fetchHistory();
          }
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [jobId]);

  const formatDate = (dt) => dt ? new Date(dt).toLocaleString() : '-';

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Website Crawl</div>
          <div className="sh-desc">Crawl a website to index its content for the chatbot's knowledge base.</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '18px' }}>
        <div className="card-h" style={{ marginBottom: '10px' }}>Start a new crawl</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            className="inp"
            style={{ marginBottom: 0, flex: 1 }}
            placeholder="https://example.com"
            value={seedUrl}
            onChange={e => { setSeedUrl(e.target.value); setCrawlError(''); }}
          />
          <button
            className="btn btn-primary"
            onClick={handleCrawl}
            disabled={isStarting || !seedUrl.trim()}
          >
            {isStarting ? 'Starting...' : 'Start Crawl'}
          </button>
        </div>
        {crawlError && <p style={{ color: 'var(--error)', marginTop: '10px', fontSize: '13px' }}>{crawlError}</p>}
      </div>

      {jobStatus && (
        <div className="card card-pad" style={{ marginBottom: '18px' }}>
          <div className="card-h">Current job</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            <div><strong>Status:</strong> <span className={`pill ${jobStatus.status === 'done' ? 'pill-ok' : jobStatus.status === 'failed' ? 'pill-danger' : 'pill-warn'}`} style={{ textTransform: 'capitalize' }}>{jobStatus.status}</span></div>
            <div><strong>Seed URL:</strong> {jobStatus.seed_url}</div>
            <div><strong>Pages found:</strong> {jobStatus.pages_found}</div>
            <div><strong>Chunks created:</strong> {jobStatus.chunks_created}</div>
            <div><strong>Started:</strong> {formatDate(jobStatus.started_at)}</div>
            <div><strong>Finished:</strong> {formatDate(jobStatus.finished_at)}</div>
          </div>
          {jobStatus.error && <p style={{ color: 'var(--error)', marginTop: '8px', fontSize: '13px' }}>Error: {jobStatus.error}</p>}
        </div>
      )}

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="card-h" style={{ marginBottom: 0 }}>Crawl History</div>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">
            <div className="e-icon">↺</div>
            <div className="e-title">No past crawls</div>
            <div className="e-desc">Start a crawl above to index your website content.</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Seed URL</th><th>Status</th><th>Pages</th><th>Chunks</th><th>Started</th><th>Finished</th></tr>
              </thead>
              <tbody>
                {history.map((job, i) => (
                  <tr key={i}>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.seed_url}</td>
                    <td>
                      <span className={`pill ${job.status === 'done' ? 'pill-ok' : job.status === 'failed' || job.status === 'purged' ? 'pill-danger' : 'pill-warn'}`} style={{ textTransform: 'capitalize' }}>
                        {job.status}
                      </span>
                    </td>
                    <td>{job.pages_found}</td>
                    <td>{job.chunks_created}</td>
                    <td className="cell-sub">{formatDate(job.started_at)}</td>
                    <td className="cell-sub">{formatDate(job.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Crawl;