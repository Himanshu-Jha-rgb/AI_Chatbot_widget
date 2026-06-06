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

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading tenants...</div>;
    if (error) return <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>{error}</div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '2rem', fontWeight: '600', color: '#111' }}>System Admin: Tenants</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>Manage all registered tenants in the system.</p>
            
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                            <th style={{ padding: '1rem', fontWeight: '600' }}>Domain</th>
                            <th style={{ padding: '1rem', fontWeight: '600' }}>Plan</th>
                            <th style={{ padding: '1rem', fontWeight: '600' }}>Created At</th>
                            <th style={{ padding: '1rem', fontWeight: '600' }}>Tenant ID</th>
                            <th style={{ padding: '1rem', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map(tenant => (
                            <tr key={tenant.tenant_id} style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s' }} 
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fdfdfd'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <td style={{ padding: '1rem', fontWeight: '500' }}>{tenant.domain}</td>
                                <td style={{ padding: '1rem' }}>
                                    <span style={{ 
                                        padding: '0.25rem 0.5rem', 
                                        borderRadius: '999px', 
                                        fontSize: '0.85rem',
                                        background: tenant.plan === 'pro' ? '#e0e7ff' : '#f3f4f6',
                                        color: tenant.plan === 'pro' ? '#3730a3' : '#374151',
                                        fontWeight: '500'
                                    }}>
                                        {tenant.plan || 'free'}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', color: '#666', fontSize: '0.9rem' }}>
                                    {new Date(tenant.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '1rem', color: '#888', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                    {tenant.tenant_id.substring(0, 8)}...
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => handleDelete(tenant.tenant_id)}
                                        style={{ 
                                            background: '#fee2e2', 
                                            color: '#ef4444', 
                                            border: 'none', 
                                            padding: '0.5rem 1rem', 
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: '500',
                                            fontSize: '0.9rem',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
                                    No tenants found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminTenants;
