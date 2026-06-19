import React, { useState } from 'react';
import { Palette } from '../utils/theme';

interface EnquiryFormProps {
  accent: string;
  palette: Palette;
  onSubmit: (data: { name: string; email: string; phone: string }) => void;
}

export function EnquiryForm({ accent, palette, onSubmit }: EnquiryFormProps) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const handleFormSubmit = () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    onSubmit(formData);
  };

  return (
    <div style={{
      marginTop: '10px',
      borderTop: `1px solid ${palette.divider}`,
      paddingTop: '10px',
      animation: 'cwSlideUp 0.2s ease-out',
    }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: palette.subtleText, fontWeight: 500 }}>
        Leave your details and we'll get back to you:
      </p>
      <input
        type="text"
        placeholder="Your Name *"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        style={{
          width: '100%',
          padding: '9px 12px',
          marginBottom: '6px',
          borderRadius: '10px',
          border: `1px solid ${palette.inputBorder}`,
          backgroundColor: palette.inputBg,
          outline: 'none',
          fontSize: '13px',
          boxSizing: 'border-box',
          color: palette.inputText,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = accent}
        onBlur={e => e.currentTarget.style.borderColor = palette.inputBorder}
      />
      <input
        type="email"
        placeholder="Your Email *"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        style={{
          width: '100%',
          padding: '9px 12px',
          marginBottom: '6px',
          borderRadius: '10px',
          border: `1px solid ${palette.inputBorder}`,
          backgroundColor: palette.inputBg,
          outline: 'none',
          fontSize: '13px',
          boxSizing: 'border-box',
          color: palette.inputText,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = accent}
        onBlur={e => e.currentTarget.style.borderColor = palette.inputBorder}
      />
      <input
        type="tel"
        placeholder="Phone (optional)"
        value={formData.phone}
        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        style={{
          width: '100%',
          padding: '9px 12px',
          marginBottom: '8px',
          borderRadius: '10px',
          border: `1px solid ${palette.inputBorder}`,
          backgroundColor: palette.inputBg,
          outline: 'none',
          fontSize: '13px',
          boxSizing: 'border-box',
          color: palette.inputText,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.currentTarget.style.borderColor = accent}
        onBlur={e => e.currentTarget.style.borderColor = palette.inputBorder}
      />
      <button
        onClick={handleFormSubmit}
        disabled={!formData.name.trim() || !formData.email.trim()}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: accent,
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '13px',
          opacity: formData.name.trim() && formData.email.trim() ? 1 : 0.5,
          transition: 'opacity 0.15s, transform 0.1s',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        Submit
      </button>
    </div>
  );
}
