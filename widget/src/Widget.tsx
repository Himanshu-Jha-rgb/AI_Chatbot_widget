import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { chat, submitEnquiry, getWidgetConfig, submitFeedback } from './api';
import { WidgetProps, Message } from './types';
import { getPalette } from './utils/theme';
import { useHostTheme } from './hooks/useHostTheme';
import { useIsMobile } from './hooks/useIsMobile';
import { useStyleInjection } from './hooks/useStyleInjection';
import { TypingIndicator } from './components/TypingIndicator';
import { Header } from './components/Header';
import { FloatingButton } from './components/FloatingButton';
import { MessageList } from './components/MessageList';
import { InputArea } from './components/InputArea';

export const Widget = ({ apiKey, apiBaseUrl }: WidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useStyleInjection();
  const hostTheme = useHostTheme();
  const isMobile = useIsMobile();

  const accent = hostTheme.accent;
  const isDark = hostTheme.isDark;
  const font = hostTheme.font;

  const widgetVars = useMemo(() => ({
    '--widget-accent': accent,
    '--widget-font': font,
  }), [accent, font]) as React.CSSProperties;

  const palette = useMemo(() => getPalette(accent, isDark), [accent, isDark]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getWidgetConfig(apiKey, apiBaseUrl);
        if (config?.suggested_questions) setSuggestedQuestions(config.suggested_questions);
      } catch (err) {
        console.error("Failed to fetch widget config", err);
      }
    };
    fetchConfig();
  }, [apiKey, apiBaseUrl]);

  // Restore chat history on mount
  useEffect(() => {
    if (!apiKey) return;
    try {
      const stored = sessionStorage.getItem(`cw_history_${apiKey}`);
      if (stored) {
        const { messages: storedMessages, lastInteractionTime } = JSON.parse(stored);
        const isExpired = Date.now() - lastInteractionTime > 24 * 60 * 60 * 1000;
        if (!isExpired) {
          setMessages(storedMessages);
        }
      }
    } catch (e) {
      console.error("Failed to load chat history from sessionStorage", e);
    }
  }, [apiKey]);

  // Persist chat history on updates
  useEffect(() => {
    if (!apiKey) return;
    if (messages.length > 0) {
      try {
        const data = {
          messages,
          lastInteractionTime: Date.now()
        };
        sessionStorage.setItem(`cw_history_${apiKey}`, JSON.stringify(data));
      } catch (e) {
        console.error("Failed to save chat history to sessionStorage", e);
      }
    }
  }, [messages, apiKey]);

  useEffect(() => {
    // Scroll to bottom on updates
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const clearEnquiryForms = useCallback(() => {
    setMessages(prev => prev.map(m => {
      if (m.role === 'assistant' && m.showEnquiryForm && !m.enquirySubmitted) {
        return { ...m, showEnquiryForm: false };
      }
      return m;
    }));
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    clearEnquiryForms();

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await chat(text, window.location.href, document.title, apiKey, apiBaseUrl);
      const botMsg: Message = {
        role: 'assistant',
        messageId: res.message_id,
        content: res.answer,
        sources: res.sources,
        showEnquiryForm: res.show_enquiry_form || false,
        enquirySubmitted: false,
        feedback: null,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, apiBaseUrl, clearEnquiryForms]);

  const handleEnquirySubmit = useCallback(async (msgIndex: number, formData: { name: string; email: string; phone: string }) => {
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
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        message: contextText,
        session_id: getSessionId(),
      }, apiKey, apiBaseUrl);

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, enquirySubmitted: true } : m
      ));
    } catch (error) {
      console.error("Enquiry submit error:", error);
    }
  }, [messages, apiKey, apiBaseUrl]);

  const handleFeedback = useCallback(async (msgIndex: number, rating: 'like' | 'dislike') => {
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
        <>
          {/* Mobile backdrop overlay */}
          {isMobile && (
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 2147483646,
                animation: 'cwFadeIn 0.2s ease-out',
              }}
            />
          )}
          <div style={{
            width: isMobile ? '100vw' : '380px',
            height: isMobile ? '75dvh' : '560px',
            position: isMobile ? 'fixed' : 'relative',
            bottom: isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: isMobile ? '24px 24px 0 0' : '24px',
            overflow: 'hidden',
            background: palette.containerBg,
            backdropFilter: isMobile ? 'none' : 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: isMobile ? 'none' : 'blur(16px) saturate(180%)',
            border: isMobile ? 'none' : `1px solid ${palette.containerBorder}`,
            boxShadow: isMobile
              ? '0 -4px 24px rgba(0,0,0,0.15)'
              : isDark
                ? '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)'
                : '0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6)',
            animation: isMobile
              ? 'cwSlideUpMobile 0.3s cubic-bezier(0.16,1,0.3,1)'
              : 'cwFadeIn 0.3s cubic-bezier(0.16,1,0.3,1)',
            fontFamily: font,
            zIndex: 2147483647,
          }}>

            {/* Mobile drag handle */}
            {isMobile && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0 4px',
                background: palette.headerBg,
              }}>
                <div style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.4)',
                }} />
              </div>
            )}

            {/* Header */}
            <Header palette={palette} onClose={() => setIsOpen(false)} />

            {/* Messages area */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <MessageList
                messages={messages}
                suggestedQuestions={suggestedQuestions}
                accent={accent}
                isDark={isDark}
                palette={palette}
                onSend={handleSend}
                onFeedback={handleFeedback}
                onEnquirySubmit={handleEnquirySubmit}
              />

              {/* Typing indicator overlayed at the bottom of message list area */}
              {isLoading && (
                <div style={{ padding: '0 16px 12px', background: palette.msgAreaBg }}>
                  <TypingIndicator accent={accent} isDark={isDark} />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <InputArea
              isLoading={isLoading}
              accent={accent}
              font={font}
              isDark={isDark}
              palette={palette}
              onSend={handleSend}
            />
          </div>
        </>
      ) : (
        /* Floating Action Button */
        <FloatingButton
          accent={accent}
          palette={palette}
          onOpen={() => setIsOpen(true)}
          hasMessages={messages.length > 0}
        />
      )}
    </div>
  );
};