import React, { useState, useEffect, useRef } from 'react';
import { chat } from './api';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';

export const Widget = ({ apiKey, apiBaseUrl }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        let sid = sessionStorage.getItem('chat_session_id');
        if (!sid) {
            sid = uuidv4();
            sessionStorage.setItem('chat_session_id', sid);
        }
        setSessionId(sid);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await chat(
                input,
                sessionId,
                window.location.href,
                document.title,
                apiKey,
                apiBaseUrl
            );
            
            const botMsg = { 
                role: 'assistant', 
                content: res.answer, 
                sources: res.sources 
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, fontFamily: 'sans-serif' }}>
            {isOpen ? (
                <div style={{ 
                    width: '350px', 
                    height: '500px', 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid #eaeaea'
                }}>
                    <div style={{ padding: '16px', backgroundColor: '#0070f3', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>AI Assistant</h3>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                    </div>
                    
                    <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#fafafa' }}>
                        {messages.length === 0 && (
                            <p style={{ textAlign: 'center', color: '#888', marginTop: 'auto', marginBottom: 'auto' }}>Ask me anything about this site!</p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                <div style={{
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    backgroundColor: m.role === 'user' ? '#0070f3' : '#fff',
                                    color: m.role === 'user' ? '#fff' : '#333',
                                    border: m.role === 'user' ? 'none' : '1px solid #eaeaea',
                                    boxShadow: m.role === 'user' ? 'none' : '0 2px 5px rgba(0,0,0,0.02)',
                                    lineHeight: '1.6',
                                    fontSize: '14px',
                                    wordBreak: 'break-word'
                                }}>
                                    {m.role === 'user' ? (
                                        m.content
                                    ) : (
                                        <ReactMarkdown
                                            components={{
                                                a: ({ href, children }) => (
                                                    <a href={href} target="_blank" rel="noopener noreferrer"
                                                       style={{ color: '#0070f3', textDecoration: 'underline' }}>
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
                                {m.sources && m.sources.length > 0 && (
                                    <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                                        Sources: {m.sources.map((s, idx) => {
                                            const label = s.section_title || s.title || `Source ${idx + 1}`;
                                            const fullTitle = s.section_path || label;
                                            return (
                                                <a key={idx} href={s.url} title={fullTitle} style={{ color: '#0070f3', marginRight: '8px' }}>
                                                    [{idx + 1}] {label}
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #eaeaea' }}>
                                <span style={{ color: '#888' }}>Thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    <div style={{ padding: '12px', borderTop: '1px solid #eaeaea', backgroundColor: '#fff', display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type your message..."
                            style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #eaeaea', outline: 'none' }}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading}
                            style={{ padding: '10px 16px', borderRadius: '20px', border: 'none', backgroundColor: '#0070f3', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Send
                        </button>
                    </div>
                </div>
            ) : (
                <button 
                    onClick={() => setIsOpen(true)}
                    style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '50%', 
                        backgroundColor: '#0070f3', 
                        color: '#fff', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,112,243,0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
            )}
        </div>
    );
};
