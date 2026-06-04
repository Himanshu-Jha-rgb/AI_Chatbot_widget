import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl, handleUnauthorized } from '../api';

const PDFUpload = () => {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [name, setName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleUpload = async () => {
        if (!file || !name.trim()) return;

        setUploading(true);
        setError('');
        setResult(null);

        const token = localStorage.getItem('token');
        const form = new FormData();
        form.append('file', file);
        form.append('name', name.trim());

        try {
            const res = await fetch(apiUrl('/dashboard/sources/pdf/upload'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: form,
            });

            if (handleUnauthorized(res)) return;

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                setFile(null);
                setName('');
            } else {
                const err = await res.json();
                setError(err.detail || 'Upload failed');
            }
        } catch (e) {
            setError('Upload failed: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <button className="btn" style={{ background: '#666' }} onClick={() => navigate('/sources')}>
                    &larr; Back
                </button>
                <h1 style={{ margin: 0 }}>Upload PDF</h1>
            </div>

            <div className="card">
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Source Name</label>
                    <input
                        className="input"
                        placeholder="e.g., School Brochure 2025"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>PDF File</label>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={e => setFile(e.target.files[0])}
                        style={{ marginBottom: '0.5rem' }}
                    />
                    {file && (
                        <div style={{ fontSize: '14px', color: '#666' }}>
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                    )}
                </div>

                <button
                    className="btn"
                    onClick={handleUpload}
                    disabled={!file || !name.trim() || uploading}
                >
                    {uploading ? 'Uploading & Indexing...' : 'Upload & Index'}
                </button>

                {error && (
                    <div style={{ marginTop: '1rem', color: '#ff4444', background: '#ffeeee', padding: '0.75rem', borderRadius: '4px' }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div style={{ marginTop: '1rem', background: '#e8f5e9', padding: '1rem', borderRadius: '4px' }}>
                        <p style={{ margin: 0, fontWeight: 500 }}>PDF uploaded and indexing started!</p>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '14px', color: '#555' }}>
                            Source: {result.name} | Status: {result.status}
                        </p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '14px', color: '#555' }}>
                            Indexing runs in the background. Check back in a minute to see indexed chunks.
                        </p>
                        <button
                            className="btn"
                            style={{ marginTop: '0.75rem' }}
                            onClick={() => navigate('/sources')}
                        >
                            View All Sources
                        </button>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Supported PDFs</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8 }}>
                    <li>Text-based PDFs (not scanned images)</li>
                    <li>Maximum file size: depends on server configuration</li>
                    <li>Text is extracted page by page and formatted as markdown</li>
                    <li>After upload, the PDF content goes through the same chunking and embedding pipeline as website content</li>
                </ul>
            </div>
        </div>
    );
};

export default PDFUpload;
