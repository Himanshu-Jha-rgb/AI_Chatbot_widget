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
            <div className="sec-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn" onClick={() => navigate('/sources')}>&larr; Back</button>
                    <div>
                        <div className="sh-title">Upload PDF</div>
                    </div>
                </div>
            </div>

            <div className="card card-pad" style={{ marginBottom: '18px' }}>
                <div className="field">
                    <label>Source Name</label>
                    <input
                        className="inp"
                        placeholder="e.g., School Brochure 2025"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>

                <div className="field">
                    <label>PDF File</label>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={e => setFile(e.target.files[0])}
                    />
                    {file && (
                        <div style={{ fontSize: '13px', color: 'var(--body)', marginTop: '6px' }}>
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                    )}
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={!file || !name.trim() || uploading}
                >
                    {uploading ? 'Uploading & Indexing...' : 'Upload & Index'}
                </button>

                {error && (
                    <div style={{ marginTop: '12px', color: 'var(--error)', background: 'var(--error-soft)', padding: '10px 14px', borderRadius: 'var(--r-sm)', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                {result && (
                    <div style={{ marginTop: '12px', background: 'var(--link-bg-soft)', padding: '14px', borderRadius: 'var(--r-sm)' }}>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: '14px' }}>PDF uploaded and indexing started!</p>
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--body)' }}>
                            Source: {result.name} | Status: {result.status}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--body)' }}>
                            Indexing runs in the background. Check back in a minute to see indexed chunks.
                        </p>
                        <button
                            className="btn"
                            style={{ marginTop: '10px' }}
                            onClick={() => navigate('/sources')}
                        >
                            View All Sources
                        </button>
                    </div>
                )}
            </div>

            <div className="card card-pad">
                <div className="card-h">Supported PDFs</div>
                <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8, fontSize: '13px', color: 'var(--body)' }}>
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
