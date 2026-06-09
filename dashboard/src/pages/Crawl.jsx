import React, { useState, useEffect } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Crawl = () => {
    const [seedUrl, setSeedUrl] = useState('');
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [history, setHistory] = useState([]);

    const fetchHistory = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/dashboard/crawl/history'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            const data = await res.json();
            setHistory(Array.isArray(data) ? data : []);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleCrawl = async () => {
        if (!seedUrl) return;
        const token = localStorage.getItem('token');
        const res = await fetch(apiUrl('/dashboard/crawl'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ seed_url: seedUrl })
        });
        if (handleUnauthorized(res)) return;
        if (res.ok) {
            const data = await res.json();
            setJobId(data.job_id);
            setSeedUrl('');
        }
    };

    useEffect(() => {
        let interval;
        if (jobId) {
            interval = setInterval(async () => {
                const token = localStorage.getItem('token');
                const res = await fetch(apiUrl(`/dashboard/crawl/${jobId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (handleUnauthorized(res)) {
                    clearInterval(interval);
                    return;
                }
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

    const formatDate = (dt) => {
        if (!dt) return '-';
        return new Date(dt).toLocaleString();
    };

    return (
        <div>
            <h1>Crawl Jobs</h1>
            <div className="card">
                <h3>Start a new crawl</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input 
                        className="input" 
                        style={{ marginBottom: 0 }}
                        placeholder="https://example.com" 
                        value={seedUrl} 
                        onChange={e => setSeedUrl(e.target.value)} 
                    />
                    <button className="btn" onClick={handleCrawl}>Start Crawl</button>
                </div>
            </div>

            {jobStatus && (
                <div className="card">
                    <h3>Current Job Status</h3>
                    <p><strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{jobStatus.status}</span></p>
                    <p><strong>Seed URL:</strong> {jobStatus.seed_url}</p>
                    <p><strong>Pages Found:</strong> {jobStatus.pages_found}</p>
                    <p><strong>Chunks Created:</strong> {jobStatus.chunks_created}</p>
                    {jobStatus.embedding_errors > 0 && (
                        <p><strong>Embedding Errors:</strong> {jobStatus.embedding_errors}</p>
                    )}
                    {jobStatus.error && (
                        <p style={{ color: '#dc3545' }}><strong>Error:</strong> {jobStatus.error}</p>
                    )}
                    <p><strong>Started:</strong> {formatDate(jobStatus.started_at)}</p>
                    <p><strong>Finished:</strong> {formatDate(jobStatus.finished_at)}</p>
                </div>
            )}

            {history.length > 0 && (
                <div className="card">
                    <h3>Crawl History</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eaeaea', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Seed URL</th>
                                <th style={{ padding: '8px' }}>Status</th>
                                <th style={{ padding: '8px' }}>Pages</th>
                                <th style={{ padding: '8px' }}>Chunks</th>
                                <th style={{ padding: '8px' }}>Started</th>
                                <th style={{ padding: '8px' }}>Finished</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((job, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.seed_url}</td>
                                    <td style={{ padding: '8px', textTransform: 'capitalize' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: job.status === 'done' ? '#d4edda' : job.status === 'failed' ? '#f8d7da' : '#fff3cd',
                                            color: job.status === 'done' ? '#155724' : job.status === 'failed' ? '#721c24' : '#856404',
                                            fontSize: '12px'
                                        }}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px' }}>{job.pages_found}</td>
                                    <td style={{ padding: '8px' }}>{job.chunks_created}</td>
                                    <td style={{ padding: '8px', fontSize: '12px' }}>{formatDate(job.started_at)}</td>
                                    <td style={{ padding: '8px', fontSize: '12px' }}>{formatDate(job.finished_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Crawl;
