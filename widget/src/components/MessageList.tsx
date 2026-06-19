import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Palette } from '../utils/theme';
import { EnquiryForm } from './EnquiryForm';

interface MessageListProps {
  messages: Message[];
  suggestedQuestions: string[];
  accent: string;
  isDark: boolean;
  palette: Palette;
  onSend: (text: string) => void;
  onFeedback: (msgIndex: number, rating: 'like' | 'dislike') => void;
  onEnquirySubmit: (msgIndex: number, formData: { name: string; email: string; phone: string }) => void;
}

export function MessageList({
  messages,
  suggestedQuestions,
  accent,
  isDark,
  palette,
  onSend,
  onFeedback,
  onEnquirySubmit,
}: MessageListProps) {
  return (
    <div style={{
      flex: 1,
      padding: '16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      backgroundColor: palette.msgAreaBg,
    }}>
      {/* Empty state — suggested questions */}
      {messages.length === 0 && suggestedQuestions.length > 0 && (
        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <p style={{
            textAlign: 'center',
            color: palette.subtleText,
            fontSize: '12px',
            marginBottom: '10px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>Suggested</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSend(q)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : `${accent}30`}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : `${accent}08`,
                  color: isDark ? '#fff' : accent,
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  lineHeight: '1.4',
                  fontWeight: 500,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.14)' : `${accent}18`;
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.3)' : `${accent}50`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : `${accent}08`;
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.2)' : `${accent}30`;
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no suggestions */}
      {messages.length === 0 && suggestedQuestions.length === 0 && (
        <div style={{
          marginTop: 'auto',
          marginBottom: 'auto',
          textAlign: 'center',
          padding: '0 20px',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: `${accent}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p style={{
            color: palette.subtleText,
            fontSize: '14px',
            margin: 0,
            lineHeight: '1.5',
          }}>Ask me anything about this site!</p>
        </div>
      )}

      {/* Message list */}
      {messages.map((m, i) => (
        <div
          key={i}
          style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            animation: 'cwSlideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div style={{
            padding: '10px 14px',
            borderRadius: m.role === 'user'
              ? '18px 18px 4px 18px'
              : '18px 18px 18px 4px',
            backgroundColor: m.role === 'user'
              ? palette.userBubbleBg
              : palette.assistantBubbleBg,
            color: m.role === 'user'
              ? palette.userBubbleText
              : palette.assistantBubbleText,
            border: m.role === 'user'
              ? 'none'
              : `1px solid ${palette.assistantBubbleBorder}`,
            boxShadow: m.role === 'user'
              ? `0 2px 10px ${accent}25`
              : isDark
                ? '0 1px 3px rgba(0,0,0,0.2)'
                : '0 1px 4px rgba(0,0,0,0.04)',
            lineHeight: '1.6',
            fontSize: '14px',
            wordBreak: 'break-word',
          }}>
            {m.role === 'user' ? (
              m.content
            ) : (
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: accent, textDecoration: 'underline', textUnderlineOffset: '2px' }}
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ fontWeight: 600 }}>{children}</strong>
                  ),
                  p: ({ children }) => (
                    <p style={{ margin: '4px 0', lineHeight: '1.6' }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ margin: '2px 0' }}>{children}</li>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            )}
          </div>

          {/* Sources */}
          {m.sources && m.sources.length > 0 && (
            <div style={{
              fontSize: '11px',
              marginTop: '6px',
              color: palette.subtleText,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}>
              {m.sources.map((s, idx) => {
                const label = s.section_title || s.title || `Source ${idx + 1}`;
                const fullTitle = s.section_path || label;
                return (
                  <a
                    key={idx}
                    href={s.url}
                    title={fullTitle}
                    style={{
                      color: isDark ? '#fff' : accent,
                      opacity: 0.75,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
                  >
                    [{idx + 1}] {label}
                  </a>
                );
              })}
            </div>
          )}

          {/* Feedback buttons */}
          {m.role === 'assistant' && m.messageId && (
            <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
              <button
                onClick={() => onFeedback(i, 'like')}
                aria-label="Helpful"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 5px',
                  fontSize: '13px',
                  opacity: m.feedback === 'like' ? 1 : 0.35,
                  color: m.feedback === 'like' ? '#22c55e' : palette.subtleText,
                  transition: 'opacity 0.15s, color 0.15s',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => { if (!m.feedback) e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { if (!m.feedback) e.currentTarget.style.opacity = '0.35'; }}
              >&#128077;</button>
              <button
                onClick={() => onFeedback(i, 'dislike')}
                aria-label="Not helpful"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 5px',
                  fontSize: '13px',
                  opacity: m.feedback === 'dislike' ? 1 : 0.35,
                  color: m.feedback === 'dislike' ? '#ef4444' : palette.subtleText,
                  transition: 'opacity 0.15s, color 0.15s',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => { if (!m.feedback) e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { if (!m.feedback) e.currentTarget.style.opacity = '0.35'; }}
              >&#128078;</button>
            </div>
          )}

          {/* Enquiry form */}
          {m.showEnquiryForm && !m.enquirySubmitted && (
            <EnquiryForm
              accent={accent}
              palette={palette}
              onSubmit={(formData) => onEnquirySubmit(i, formData)}
            />
          )}

          {/* Enquiry submitted confirmation */}
          {m.showEnquiryForm && m.enquirySubmitted && (
            <div style={{
              marginTop: '8px',
              fontSize: '13px',
              color: '#22c55e',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Thanks! We'll get back to you soon.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
