import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { chat, submitEnquiry, getWidgetConfig, submitFeedback, apiClient } from './api';
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
import {
  SESSION_EXPIRY_MS,
  HISTORY_STORAGE_KEY_PREFIX,
  WIDGET_WIDTH,
  WIDGET_HEIGHT,
  MOBILE_WIDGET_HEIGHT,
  DRAG_HANDLE_WIDTH,
  DRAG_HANDLE_HEIGHT,
  SCROLL_INTO_VIEW_DELAY
} from './utils/constants';

export const Widget = ({ apiKey, apiBaseUrl }: WidgetProps) => {
  apiClient.init(apiKey, apiBaseUrl);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!apiKey) return [];
    try {
      const stored = sessionStorage.getItem(`${HISTORY_STORAGE_KEY_PREFIX}${apiKey}`);
      if (stored) {
        const { messages: storedMessages, lastInteractionTime } = JSON.parse(stored);
        const isExpired = Date.now() - lastInteractionTime > SESSION_EXPIRY_MS;
        if (!isExpired) {
          return storedMessages;
        }
      }
    } catch (e) {
      console.error("Failed to load chat history from sessionStorage", e);
    }
    return [];
  });
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
        const config = await getWidgetConfig();
        if (config?.suggested_questions) setSuggestedQuestions(config.suggested_questions);
      } catch (err) {
        console.error("Failed to fetch widget config", err);
      }
    };
    fetchConfig();
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
        sessionStorage.setItem(`${HISTORY_STORAGE_KEY_PREFIX}${apiKey}`, JSON.stringify(data));
      } catch (e) {
        console.error("Failed to save chat history to sessionStorage", e);
      }
    }
  }, [messages, apiKey]);

  useEffect(() => {
    // Scroll to bottom on updates
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, SCROLL_INTO_VIEW_DELAY);
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
      const res = await chat(text, window.location.href, document.title);
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
  }, [clearEnquiryForms]);

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
      });

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, enquirySubmitted: true } : m
      ));
    } catch (error) {
      console.error("Enquiry submit error:", error);
    }
  }, [messages]);

  const handleFeedback = useCallback(async (msgIndex: number, rating: 'like' | 'dislike') => {
    const msg = messages[msgIndex];
    if (!msg || !msg.messageId || msg.feedback === rating) return;

    const getSessionId = () => {
      const match = document.cookie.match(/(?:^|;\s*)chat_session_id=([^;]*)/);
      return match ? decodeURIComponent(match[1]) : '';
    };

    try {
      await submitFeedback(msg.messageId, getSessionId(), rating);
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, feedback: rating } : m
      ));
    } catch (error) {
      console.error("Feedback error:", error);
    }
  }, [messages]);

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
          <div 
            className="flex flex-col overflow-hidden z-[2147483647]"
            style={{
              width: isMobile ? '100vw' : WIDGET_WIDTH,
              height: isMobile ? MOBILE_WIDGET_HEIGHT : WIDGET_HEIGHT,
              position: isMobile ? 'fixed' : 'relative',
              bottom: isMobile ? 0 : undefined,
              right: isMobile ? 0 : undefined,
              borderRadius: isMobile ? '24px 24px 0 0' : '24px',
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
            }}
          >

            {/* Mobile drag handle */}
            {isMobile && (
              <div 
                className="flex justify-center pt-3 pb-1"
                style={{ background: palette.headerBg }}
              >
                <div 
                  className="rounded"
                  style={{
                    width: DRAG_HANDLE_WIDTH,
                    height: DRAG_HANDLE_HEIGHT,
                    background: 'rgba(255,255,255,0.4)',
                  }} 
                />
              </div>
            )}

            {/* Header */}
            <Header palette={palette} onClose={() => setIsOpen(false)} />

            {/* Messages area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
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
                <div className="px-4 pb-3" style={{ background: palette.msgAreaBg }}>
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