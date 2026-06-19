import React from 'react';
import { Palette } from '../utils/theme';

interface HeaderProps {
  palette: Palette;
  onClose: () => void;
}

export function Header({ palette, onClose }: HeaderProps) {
  return (
    <div style={{
      padding: '18px 20px',
      background: palette.headerBg,
      color: palette.headerText,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 6v1a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1c-1.5-1.5-3-3.5-3-6a7 7 0 0 1 7-7z" />
            <path d="M9 21h6" />
          </svg>
        </div>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}>AI Assistant</h3>
          <p style={{
            margin: 0,
            fontSize: '11px',
            opacity: 0.7,
            letterSpacing: '0.02em',
          }}>Online — ready to help</p>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Close chat"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          color: palette.headerText,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          transition: 'background 0.15s',
          lineHeight: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
