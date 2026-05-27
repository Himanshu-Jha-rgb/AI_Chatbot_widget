import React from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from './Widget';

const init = () => {

    const devRoot = document.getElementById('root');
    if (devRoot) {
        const root = createRoot(devRoot);
        root.render(<Widget apiKey="sk_live_MglQoDyAC0gO2gNornqkZxdzavW4qw14vAlQljcR6JQ" apiBaseUrl="http://localhost:8000" />);
        return;
    }
    

    let scriptTag = document.currentScript;
    if (!scriptTag) {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            if (scripts[i].src.includes('widget.js')) {
                scriptTag = scripts[i];
                break;
            }
        }
    }
    
    const apiKey = scriptTag?.getAttribute('data-api-key');
    const apiBaseUrl = scriptTag?.getAttribute('data-api-base-url') || (
        scriptTag?.src ? new URL(scriptTag.src).origin : undefined
    );

    if (!apiKey) {
        console.error('ChatWidget: data-api-key attribute is missing on the script tag.');
        return;
    }

    const container = document.createElement('div');
    container.id = 'chat-widget-container';
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<Widget apiKey={apiKey} apiBaseUrl={apiBaseUrl} />);
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
} else {
    window.addEventListener('DOMContentLoaded', init);
}
