import React, { useEffect, useState } from 'react';
import { apiUrl, handleUnauthorized } from '../api';

const Leads = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeads = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(apiUrl('/dashboard/leads'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (handleUnauthorized(res)) return;
            if (res.ok) {
                setLeads(await res.json());
            }
            setLoading(false);
        };
        fetchLeads();
    }, []);

    return (
        <div>
            <h1>Leads</h1>
            <p style={{ color: '#666', marginTop: '-0.5rem' }}>
                Enquiry form submissions from website visitors.
            </p>

            {loading ? (
                <p>Loading...</p>
            ) : leads.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                    No leads yet. Leads appear here when visitors submit the enquiry form through the chat widget.
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eaeaea', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px' }}>Name</th>
                                <th style={{ padding: '10px 12px' }}>Email</th>
                                <th style={{ padding: '10px 12px' }}>Phone</th>
                                <th style={{ padding: '10px 12px' }}>Message</th>
                                <th style={{ padding: '10px 12px' }}>Date/Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.map((lead) => (
                                <tr key={lead.lead_id} style={{ borderBottom: '1px solid #eaeaea' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{lead.name}</td>
                                    <td style={{ padding: '10px 12px' }}>{lead.email}</td>
                                    <td style={{ padding: '10px 12px', color: lead.phone ? 'inherit' : '#aaa' }}>
                                        {lead.phone || '—'}
                                    </td>
                                    <td style={{ padding: '10px 12px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word', color: lead.message ? '#333' : '#aaa' }}>
                                        {lead.message || '—'}
                                    </td>
                                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#666', fontSize: '13px' }}>
                                        {new Date(lead.created_at).toLocaleString('en-IN', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Leads;
