import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Overview = () => {
    const [stats, setStats] = useState(null);
    const [sourceCount, setSourceCount] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');

            const [statsRes, sourcesRes] = await Promise.all([
                fetch(apiUrl('/tenants/stats'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(apiUrl('/dashboard/sources'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
            ]);

            if (handleUnauthorized(statsRes)) return;
            if (statsRes.ok) {
                setStats(await statsRes.json());
            }
            if (sourcesRes.ok) {
                const sources = await sourcesRes.json();
                setSourceCount(sources.length);
            }
        };
        fetchData();
    }, []);

    return (
        <div>
            <h1>Overview</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                <div className="card">
                    <h3>Knowledge Sources</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{sourceCount ?? '-'}</p>
                </div>
                <div className="card">
                    <h3>Pages Crawled</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats?.pages_crawled ?? '-'}</p>
                </div>
                <div className="card">
                    <h3>Chunks Indexed</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats?.chunks_indexed ?? '-'}</p>
                </div>
                <div className="card">
                    <h3>Chat Queries</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{stats?.queries_this_month ?? '-'}</p>
                </div>
            </div>
        </div>
    );
};

export default Overview;
