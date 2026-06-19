import React, { useState } from 'react';
import { Palette } from '../utils/theme';

interface InputAreaProps {
  isLoading: boolean;
  accent: string;
  font: string;
  isDark: boolean;
  palette: Palette;
  onSend: (text: string) => void;
}

export function InputArea({
  isLoading,
  accent,
  font,
  isDark,
  palette,
  onSend,
}: InputAreaProps) {
  const [input, setInput] = useState('');

  const handleSendClick = () => {
    if (isLoading || !input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div style={{
      padding: '12px 14px',
      borderTop: `1px solid ${palette.divider}`,
      backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        style={{
          flex: 1,
          padding: '11px 16px',
          borderRadius: '24px',
          border: `1px solid ${palette.inputBorder}`,
          backgroundColor: palette.inputBg,
          outline: 'none',
          fontSize: '14px',
          color: palette.inputText,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          fontFamily: font,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = `${accent}60`;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}12`;
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = palette.inputBorder;
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      <button
        onClick={handleSendClick}
        disabled={isLoading || !input.trim()}
        aria-label="Send message"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: accent,
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.15s, transform 0.1s, background-color 0.15s',
          opacity: isLoading || !input.trim() ? 0.45 : 1,
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!isLoading && input.trim()) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = isLoading || !input.trim() ? '0.45' : '1'; }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
