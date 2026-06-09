import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { chat, submitEnquiry, getWidgetConfig, submitFeedback } from './api';
import ReactMarkdown from 'react-markdown';

const ACCENT_FALLBACK = '#4F46E5';

function luminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function parseRgb(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
}

function useHostTheme() {
    const [theme, setTheme] = useState({
        accent: ACCENT_FALLBACK,
        font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        isDark: false,
    });

    useEffect(() => {
        try {
            const bodyStyles = window.getComputedStyle(document.body);
            const docEl = document.documentElement;
            const docStyles = window.getComputedStyle(docEl);

            const font = bodyStyles.fontFamily || docStyles.fontFamily || theme.font;

            let accent = ACCENT_FALLBACK;
            const varNames = ['--primary', '--accent', '--main-color', '--brand-color', '--color-primary', '--theme-color'];
            for (const name of varNames) {
                const val = docStyles.getPropertyValue(name).trim() || bodyStyles.getPropertyValue(name).trim();
                if (val && (val.startsWith('#') || val.startsWith('rgb'))) {
                    accent = val;
                    break;
                }
            }

            let isDark = false;
            const bgRaw = bodyStyles.backgroundColor || docStyles.backgroundColor;
            const rgb = parseRgb(bgRaw);
            if (rgb && bgRaw !== 'rgba(0, 0, 0, 0)' && bgRaw !== 'transparent') {
                isDark = luminance(rgb[0], rgb[1], rgb[2]) < 0.4;
            }

            setTheme({ accent, font, isDark });
        } catch (_) {
            // Host environment blocked access — use defaults
        }
    }, []);

    return theme;
}

function useStyleInjection() {
    useEffect(() => {
        const id = 'cw-injected-styles';
        if (document.getElementById(id)) return;

        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            @keyframes cwBounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
                30% { transform: translateY(-5px); opacity: 1; }
            }
            @keyframes cwPulse {
                0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
                50% { transform: scale(1.05); box-shadow: 0 6px 28px rgba(0,0,0,0.22); }
            }
            @keyframes cwFadeIn {
                from { opacity: 0; transform: translateY(8px) scale(0.97); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes cwSlideUp {
                from { opacity: 0; transform: translateY(16px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes cwSlideUpMobile {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            .cw-typing-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                display: inline-block;
                animation: cwBounce 1.2s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }, []);
}

function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
    );
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const handler = () => setIsMobile(window.innerWidth <= breakpoint);
        mq.addEventListener('change', handler);
        window.addEventListener('resize', handler);
        handler();
        return () => {
            mq.removeEventListener('change', handler);
            window.removeEventListener('resize', handler);
        };
    }, [breakpoint]);
    return isMobile;
}

function TypingIndicator({ accent, isDark }) {
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

export const Widget = ({ apiKey, apiBaseUrl }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    const [themeName, setThemeName] = useState('default');
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const messagesEndRef = useRef(null);

    useStyleInjection();
    const hostTheme = useHostTheme();
    const isMobile = useIsMobile();

    const themes = {
        default: { headerBg: '#0070f3', primary: '#0070f3', headerText: '#fff' },
        nialabs: { headerBg: '#0f203a', primary: '#0d6efd', headerText: '#fff' },
    };
    const currentTheme = themes[themeName] || themes.default;

    const accent = hostTheme.accent;
    const isDark = hostTheme.isDark;
    const font = hostTheme.font;

    const widgetVars = useMemo(() => ({
        '--widget-accent': accent,
        '--widget-font': font,
    }), [accent, font]);

    const palette = useMemo(() => ({
        containerBg: isDark ? 'rgba(18,18,24,0.95)' : 'rgba(255,255,255,0.88)',
        containerBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        headerBg: isDark
            ? `linear-gradient(135deg, ${accent}, ${accent}BB)`
            : `linear-gradient(135deg, ${accent}, ${accent}DD)`,
        headerText: '#fff',
        msgAreaBg: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
        userBubbleBg: accent,
        userBubbleText: '#fff',
        assistantBubbleBg: isDark ? 'rgba(255,255,255,0.12)' : '#fff',
        assistantBubbleText: isDark ? '#f0f0f0' : '#1a1a2e',
        assistantBubbleBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        inputBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
        inputBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
        inputText: isDark ? '#e8e8e8' : '#1a1a2e',
        inputPlaceholder: isDark ? 'rgba(255,255,255,0.5)' : '#999',
        subtleText: isDark ? 'rgba(255,255,255,0.6)' : '#888',
        divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        fabShadow: `${accent}55`,
    }), [accent, isDark]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const config = await getWidgetConfig(apiKey, apiBaseUrl);
                if (config?.theme) setThemeName(config.theme);
                if (config?.suggested_questions) setSuggestedQuestions(config.suggested_questions);
            } catch (err) {
                console.error("Failed to fetch widget config", err);
            }
        };
        fetchConfig();
    }, [apiKey, apiBaseUrl]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const clearEnquiryForms = useCallback(() => {
        setMessages(prev => prev.map(m => {
            if (m.role === 'assistant' && m.showEnquiryForm && !m.enquirySubmitted) {
                return { ...m, showEnquiryForm: false };
            }
            return m;
        }));
    }, []);

    const handleSend = useCallback(async (text) => {
        const queryText = text || input.trim();
        if (!queryText) return;

        clearEnquiryForms();

        const userMsg = { role: 'user', content: queryText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await chat(queryText, window.location.href, document.title, apiKey, apiBaseUrl);
            const botMsg = {
                role: 'assistant',
                messageId: res.message_id,
                content: res.answer,
                sources: res.sources,
                showEnquiryForm: res.show_enquiry_form || false,
                enquirySubmitted: false,
                feedback: null,
            };
            setMessages(prev => [...prev, botMsg]);
            setFormData({ name: '', email: '', phone: '' });
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, apiKey, apiBaseUrl, clearEnquiryForms]);

    const handleEnquirySubmit = useCallback(async (msgIndex) => {
        const { name, email, phone } = formData;
        if (!name.trim() || !email.trim()) return;

        const getSessionId = () => {
            const match = document.cookie.match(/(?:^|;\s*)chat_session_id=([^;]*)/);
            return match ? decodeURIComponent(match[1]) : '';
        };

        const contextMessages = messages.slice(Math.max(0, msgIndex - 5), msgIndex + 1);
        const contextText = contextMessages
            .map(m => `${m.role === 'user' ? 'Visitor' : 'Bot'}: ${m.content}`)
            .join('\n');

        try {
            await submitEnquiry({
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                message: contextText,
                session_id: getSessionId(),
            }, apiKey, apiBaseUrl);

            setMessages(prev => prev.map((m, i) =>
                i === msgIndex ? { ...m, enquirySubmitted: true } : m
            ));
        } catch (error) {
            console.error("Enquiry submit error:", error);
        }
    }, [formData, messages, apiKey, apiBaseUrl]);

    const handleFeedback = useCallback(async (msgIndex, rating) => {
        const msg = messages[msgIndex];
        if (!msg || !msg.messageId || msg.feedback === rating) return;

        const getSessionId = () => {
            const match = document.cookie.match(/(?:^|;\s*)chat_session_id=([^;]*)/);
            return match ? decodeURIComponent(match[1]) : '';
        };

        try {
            await submitFeedback(msg.messageId, getSessionId(), rating, apiKey, apiBaseUrl);
            setMessages(prev => prev.map((m, i) =>
                i === msgIndex ? { ...m, feedback: rating } : m
            ));
        } catch (error) {
            console.error("Feedback error:", error);
        }
    }, [messages, apiKey, apiBaseUrl]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <div
            className="cw-widget-root"
            style={{
                position: 'fixed',
                bottom: isMobile ? 0 : '24px',
                right: isMobile ? 0 : '24px',
                zIndex: 2147483647,
                fontFamily: font,
                ...widgetVars,
            }}
        >
            {isOpen ? (
                <div style={{
                    width: isMobile ? '100vw' : '380px',
                    height: isMobile ? '100dvh' : '560px',
                    position: isMobile ? 'fixed' : 'relative',
                    bottom: isMobile ? 0 : undefined,
                    right: isMobile ? 0 : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: isMobile ? 0 : '24px',
                    overflow: 'hidden',
                    background: palette.containerBg,
                    backdropFilter: isMobile ? 'none' : 'blur(16px) saturate(180%)',
                    WebkitBackdropFilter: isMobile ? 'none' : 'blur(16px) saturate(180%)',
                    border: isMobile ? 'none' : `1px solid ${palette.containerBorder}`,
                    boxShadow: isMobile
                        ? 'none'
                        : isDark
                            ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)'
                            : '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6)',
                    animation: isMobile
                        ? 'cwSlideUpMobile 0.3s cubic-bezier(0.16,1,0.3,1)'
                        : 'cwFadeIn 0.3s cubic-bezier(0.16,1,0.3,1)',
                    fontFamily: font,
                }}>

                    {/* Header */}
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
                            onClick={() => setIsOpen(false)}
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

                    {/* Messages area */}
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
                                            onClick={() => handleSend(q)}
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
                                            onClick={() => handleFeedback(i, 'like')}
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
                                            onClick={() => handleFeedback(i, 'dislike')}
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
                                            onClick={() => handleEnquirySubmit(i)}
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

                        {/* Typing indicator */}
                        {isLoading && (
                            <TypingIndicator accent={accent} isDark={isDark} />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
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
                            onClick={() => handleSend()}
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
                </div>
            ) : (
                /* Floating Action Button */
                <button
                    onClick={() => setIsOpen(true)}
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
                        animation: messages.length === 0 ? 'cwPulse 3s ease-in-out 2' : 'none',
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
            )}
        </div>
    );
};
