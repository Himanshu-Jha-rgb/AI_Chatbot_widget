import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Overview = () => {
  const [stats, setStats] = useState(null);
  const [gapStats, setGapStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');

      const [statsRes, gapsRes] = await Promise.all([
        fetch(apiUrl('/tenants/stats'), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl('/dashboard/knowledge/gaps/stats'), {
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);

      if (handleUnauthorized(statsRes)) return;
      if (statsRes.ok) setStats(await statsRes.json());
      if (gapsRes.ok) setGapStats(await gapsRes.json());
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Dashboard</div>
          <div className="sh-desc">Overview of your chatbot's performance and knowledge base.</div>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: '18px' }}>
        <div className="kpi">
          <div className="k-label">Knowledge Sources</div>
          <div className="k-val">{stats?.knowledge_sources ?? '-'}</div>
          <div className="k-sub">websites, PDFs, FAQs, docs</div>
        </div>
        <div className="kpi">
          <div className="k-label">Pages Crawled</div>
          <div className="k-val">{stats?.pages_crawled ?? '-'}</div>
          <div className="k-sub">across all crawls</div>
        </div>
        <div className="kpi">
          <div className="k-label">Chunks Indexed</div>
          <div className="k-val">{stats?.chunks_indexed ?? '-'}</div>
          <div className="k-sub">searchable units</div>
        </div>
        <div className="kpi">
          <div className="k-label">Chat Queries</div>
          <div className="k-val">{stats?.queries_this_month ?? '-'}</div>
          <div className="k-sub">this month</div>
        </div>
        <div className="kpi">
          <div className="k-label">Unanswered</div>
          <div className="k-val" style={{ color: gapStats?.open > 0 ? 'var(--error)' : undefined }}>{gapStats?.open ?? 0}</div>
          <div className="k-sub">knowledge gaps</div>
        </div>
      </div>

      {gapStats && (
        <div className="card card-pad">
          <div className="card-h">Knowledge Health</div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span className="pill pill-danger" style={{ fontSize: '18px', padding: '4px 14px', fontWeight: 700 }}>{gapStats.open}</span>
              <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--body)' }}>unanswered questions</span>
            </div>
            <div>
              <span className="pill pill-ok" style={{ fontSize: '18px', padding: '4px 14px', fontWeight: 700 }}>{gapStats.resolved}</span>
              <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--body)' }}>resolved via FAQ</span>
            </div>
            <div>
              <span className="pill pill-neutral" style={{ fontSize: '18px', padding: '4px 14px', fontWeight: 700 }}>{gapStats.total}</span>
              <span style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--body)' }}>total gaps logged</span>
            </div>
          </div>
        </div>
      )}

      {gapStats?.top_gaps?.length > 0 && (
        <div className="card card-pad" style={{ marginTop: '18px' }}>
          <div className="card-h">Top unanswered questions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gapStats.top_gaps.slice(0, 5).map((g, i) => (
              <div key={g.gap_id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--mute)', minWidth: '24px' }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: '13px' }}>{g.query}</span>
                <span className="pill pill-warn">{g.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;