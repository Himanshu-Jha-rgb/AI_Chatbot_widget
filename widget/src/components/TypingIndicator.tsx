import React from 'react';

interface TypingIndicatorProps {
  accent: string;
  isDark: boolean;
}

export function TypingIndicator({ accent, isDark }: TypingIndicatorProps) {
  return (
    <div style={{
      alignSelf: 'flex-start',
      maxWidth: '85%',
      animation: 'cwFadeIn 0.25s ease-out',
    }}>
      <div style={{
        padding: '12px 18px',
        borderRadius: '18px 18px 18px 4px',
        background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="cw-typing-dot"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.8)' : accent,
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
