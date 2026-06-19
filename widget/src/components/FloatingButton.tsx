import React from 'react';
import { Palette } from '../utils/theme';

interface FloatingButtonProps {
  accent: string;
  palette: Palette;
  onOpen: () => void;
  hasMessages: boolean;
}

export function FloatingButton({ accent, palette, onOpen, hasMessages }: FloatingButtonProps) {
  return (
    <button
      onClick={onOpen}
      aria-label="Open chat"
      style={{
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
        color: '#fff',
        border: 'none',
        boxShadow: `0 4px 20px ${palette.fabShadow}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease',
        animation: !hasMessages ? 'cwPulse 3s ease-in-out 2' : 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = `0 6px 28px ${palette.fabShadow}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = `0 4px 20px ${palette.fabShadow}`;
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
