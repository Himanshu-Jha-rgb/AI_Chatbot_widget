import React, { useState, useEffect } from 'react';
import { apiUrl } from '../api';

const Crawl = () => {
    const [seedUrl, setSeedUrl] = useState('');
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);

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
                if (res.ok) {
                    const data = await res.json();
                    setJobStatus(data);
                    if (data.status === 'done' || data.status === 'failed') {
                        clearInterval(interval);
                    }
                }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [jobId]);

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
                </div>
            )}
        </div>
    );
};

export default Crawl;
