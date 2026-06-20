import { useEffect } from 'react';

export function useStyleInjection(): void {
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
      @keyframes cwCursorBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);
}
