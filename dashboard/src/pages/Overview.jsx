import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Overview = () => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl('/tenants/stats'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleUnauthorized(res)) return;
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        };
        fetchStats();
    }, []);

    return (
        <div>
            <h1>Overview</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
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
