import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

const AdminTenants = () => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleAdminUnauthorized = (response) => {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('adminToken');
            navigate('/admin/login');
            return true;
        }
        return false;
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('adminToken');
            if (!token) {
                navigate('/admin/login');
                return;
            }
            
            const response = await fetch(apiUrl('/admin/tenants'), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (handleAdminUnauthorized(response)) return;

            if (!response.ok) {
                throw new Error('Failed to fetch tenants');
            }

            const data = await response.json();
            setTenants(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (tenantId) => {
        if (!window.confirm('Are you sure you want to delete this tenant? This will delete all their data.')) return;

        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch(apiUrl(`/admin/tenants/${tenantId}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (handleAdminUnauthorized(response)) return;

            if (!response.ok) {
                throw new Error('Failed to delete tenant');
            }

            setTenants(tenants.filter(t => t.tenant_id !== tenantId));
        } catch (err) {
            alert('Error deleting tenant: ' + err.message);
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading tenants...</div>;
    if (error) return <div style={{ padding: '40px', color: 'var(--error)', textAlign: 'center' }}>{error}</div>;

    return (
        <div>
            <div className="sec-head">
                <div>
                    <div className="sh-title">System Admin: Tenants</div>
                    <div className="sh-desc">Manage all registered tenants in the system.</div>
                </div>
            </div>

            <div className="card">
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Plan</th>
                                <th>Created At</th>
                                <th>Tenant ID</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.tenant_id}>
                                    <td style={{ fontWeight: 500 }}>{tenant.domain}</td>
                                    <td>
                                        <span className={`pill ${tenant.plan === 'pro' ? 'pill-ok' : ''}`}>
                                            {tenant.plan || 'free'}
                                        </span>
                                    </td>
                                    <td className="cell-sub">
                                        {new Date(tenant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="cell-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                                        {tenant.tenant_id.substring(0, 8)}...
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button 
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDelete(tenant.tenant_id)}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {tenants.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="empty-state" style={{ padding: '40px' }}>
                                        No tenants found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminTenants;
