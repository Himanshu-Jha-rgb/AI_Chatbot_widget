import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('/dashboard/leads'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (handleUnauthorized(res)) return;
      if (res.ok) {
        setLeads(await res.json());
      }
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const avatarColors = ['#d8ccf1', '#ffefcf', '#d4edda', '#f7d4d6', '#d3e5ff', '#aaffec'];
  const avatarTextColors = ['#4c2889', '#ab570a', '#155724', '#c50000', '#0761d1', '#29bc9b'];

  if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

  return (
    <div>
      <div className="sec-head">
        <div>
          <div className="sh-title">Leads</div>
          <div className="sh-desc">Enquiry form submissions from website visitors.</div>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="e-icon">◑</div>
            <div className="e-title">No leads yet</div>
            <div className="e-desc">Leads appear here when visitors submit the enquiry form in the chat widget.</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Message</th><th>Date</th></tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => {
                  const colorIdx = i % avatarColors.length;
                  return (
                    <tr key={lead.lead_id || i}>
                      <td>
                        <div className="cell-main">
                          <div className="ava-sm" style={{ background: avatarColors[colorIdx], color: avatarTextColors[colorIdx] }}>
                            {getInitials(lead.name)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{lead.name}</span>
                        </div>
                      </td>
                      <td className="cell-sub">{lead.email}</td>
                      <td className="cell-sub">{lead.phone || '-'}</td>
                      <td className="cell-sub" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.message || '-'}
                      </td>
                      <td className="cell-sub">{new Date(lead.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;