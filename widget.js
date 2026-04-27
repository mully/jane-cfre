/**
 * Jane - CFRE Website Chat Widget
 * Embeddable JavaScript widget for CyFairRealEstate.com
 * 
 * Usage:
 * <script src="https://chat.cyfairrealestate.com/widget.js" async></script>
 * Or self-hosted: <script src="/path/to/widget.js" async></script>
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiUrl: 'https://jane-cfre.jim-787.workers.dev/api/chat',
    brandName: 'CY-FAIR Real Estate',
    assistantName: 'Jane',
    primaryColor: '#12122a',  // CFRE company blue
    position: 'right',
    autoOpen: false,
    ...window.CFREChatConfig
  };

  // State
  let chatOpen = false;
  let sessionId = generateSessionId();
  let currentFlow = 'welcome';
  let collectedData = {};

  // Create widget HTML structure
  function createWidget() {
    const container = document.createElement('div');
    container.id = 'cfre-jane-widget';
    container.innerHTML = `
      <style>
        #cfre-jane-widget {
          --jane-primary: ${CONFIG.primaryColor};
          --jane-bg: #ffffff;
          --jane-text: #333333;
          --jane-light: #f5f5f5;
          --jane-border: #e0e0e0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .jane-launcher {
          position: fixed;
          bottom: 20px;
          ${CONFIG.position}: 20px;
          width: 60px;
          height: 60px;
          background: var(--jane-primary);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          z-index: 9999;
        }
        
        .jane-launcher:hover {
          transform: scale(1.05);
        }
        
        .jane-launcher svg {
          width: 28px;
          height: 28px;
          fill: white;
        }
        
        .jane-chat {
          position: fixed;
          bottom: 90px;
          ${CONFIG.position}: 20px;
          width: 360px;
          max-width: calc(100vw - 40px);
          height: 500px;
          max-height: calc(100vh - 120px);
          background: var(--jane-bg);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9998;
          opacity: 0;
          visibility: hidden;
          transform: translateY(20px);
          transition: all 0.3s ease;
        }
        
        .jane-chat.open {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        
        .jane-header {
          background: var(--jane-primary);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .jane-avatar {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        
        .jane-title {
          flex: 1;
        }
        
        .jane-title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .jane-title p {
          margin: 2px 0 0;
          font-size: 12px;
          opacity: 0.9;
        }
        
        .jane-close {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 4px;
        }
        
        .jane-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .jane-message {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          animation: jane-fade-in 0.3s ease;
        }
        
        @keyframes jane-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .jane-message.bot {
          background: var(--jane-light);
          color: var(--jane-text);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        
        .jane-message.user {
          background: var(--jane-primary);
          color: white;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        
        .jane-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }
        
        .jane-button {
          background: white;
          border: 2px solid var(--jane-primary);
          color: var(--jane-primary);
          padding: 10px 16px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .jane-button:hover {
          background: var(--jane-primary);
          color: white;
        }
        
        .jane-input-area {
          padding: 16px 20px;
          border-top: 1px solid var(--jane-border);
          display: flex;
          gap: 8px;
        }
        
        .jane-input {
          flex: 1;
          border: 1px solid var(--jane-border);
          border-radius: 24px;
          padding: 12px 16px;
          font-size: 14px;
          outline: none;
        }
        
        .jane-input:focus {
          border-color: var(--jane-primary);
        }
        
        .jane-send {
          background: var(--jane-primary);
          border: none;
          color: white;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .jane-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .jane-typing {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          align-self: flex-start;
        }
        
        .jane-typing span {
          width: 8px;
          height: 8px;
          background: #999;
          border-radius: 50%;
          animation: jane-typing 1.4s infinite;
        }
        
        .jane-typing span:nth-child(2) { animation-delay: 0.2s; }
        .jane-typing span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes jane-typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        
        /* Mobile responsive */
        @media (max-width: 480px) {
          .jane-chat {
            width: 100%;
            max-width: 100%;
            height: 100%;
            max-height: 100%;
            bottom: 0;
            right: 0;
            left: 0;
            border-radius: 0;
          }
          
          .jane-chat.open + .jane-launcher {
            display: none;
          }
        }
      </style>
      
      <div class="jane-chat" id="jane-chat">
        <div class="jane-header">
          <div class="jane-avatar">🏠</div>
          <div class="jane-title">
            <h3>${CONFIG.assistantName}</h3>
            <p>${CONFIG.brandName}</p>
          </div>
          <button class="jane-close" onclick="janeToggle()">×</button>
        </div>
        <div class="jane-messages" id="jane-messages"></div>
        <div class="jane-input-area">
          <input type="text" class="jane-input" id="jane-input" 
                 placeholder="Type your message..." 
                 onkeypress="if(event.key==='Enter')janeSend()">
          <button class="jane-send" onclick="janeSend()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="jane-launcher" onclick="janeToggle()" id="jane-launcher">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Start conversation
    if (CONFIG.autoOpen) {
      setTimeout(janeToggle, 1000);
    }
    janeSendToAPI('', 'welcome');
  }

  // Toggle chat open/close
  window.janeToggle = function() {
    chatOpen = !chatOpen;
    const chat = document.getElementById('jane-chat');
    const launcher = document.getElementById('jane-launcher');
    
    if (chatOpen) {
      chat.classList.add('open');
      launcher.style.display = 'none';
      document.getElementById('jane-input')?.focus();
    } else {
      chat.classList.remove('open');
      launcher.style.display = 'flex';
    }
  };

  // Send message
  window.janeSend = async function() {
    const input = document.getElementById('jane-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Show user message
    addMessage(message, 'user');
    input.value = '';
    
    // Send to API
    await janeSendToAPI(message, currentFlow, collectedData);
  };

  // Send to API
  async function janeSendToAPI(message, flow, data = {}) {
    showTyping();
    
    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          flow,
          sessionId,
          leadData: data,
          collected: collectedData,
          timestamp: new Date().toISOString(),
          source: window.location?.href || 'unknown'
        })
      });
      
      const result = await response.json();
      hideTyping();
      
      // Update flow and collected data
      if (result.flow) currentFlow = result.flow;
      if (result.collected) collectedData = { ...collectedData, ...result.collected };
      
      // Display bot response
      addMessage(result.message, 'bot', result.buttons);
      
    } catch (error) {
      hideTyping();
      console.error('Jane API error:', error);
      addMessage('Sorry, I\'m having trouble connecting. Please try again or call us at (713) 446-1018.', 'bot');
    }
  }

  // Add message to chat
  function addMessage(text, sender, buttons = null) {
    const messages = document.getElementById('jane-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `jane-message ${sender}`;
    messageEl.textContent = text;
    messages.appendChild(messageEl);
    
    // Add buttons if provided
    if (buttons && buttons.length > 0) {
      const buttonsEl = document.createElement('div');
      buttonsEl.className = 'jane-buttons';
      
      buttons.forEach(btn => {
        const btnEl = document.createElement('button');
        btnEl.className = 'jane-button';
        btnEl.innerHTML = `${btn.icon || ''} ${btn.label}`;
        btnEl.onclick = () => handleButtonClick(btn.value, btn.label);
        buttonsEl.appendChild(btnEl);
      });
      
      messages.appendChild(buttonsEl);
    }
    
    messages.scrollTop = messages.scrollHeight;
  }

  // Handle button click
  async function handleButtonClick(value, label) {
    // Show as user message
    addMessage(label, 'user');
    
    // Map to flow
    const flowMap = {
      'buy': 'buy',
      'sell': 'sell',
      'value': 'value',
      'contact': 'contact',
      'welcome': 'welcome',
      'done': 'complete',
      'more': 'more-info'
    };
    
    const newFlow = flowMap[value] || value;
    await janeSendToAPI(label, newFlow, collectedData);
  }

  // Show typing indicator
  function showTyping() {
    const messages = document.getElementById('jane-messages');
    const typing = document.createElement('div');
    typing.className = 'jane-typing';
    typing.id = 'jane-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  // Hide typing indicator
  function hideTyping() {
    const typing = document.getElementById('jane-typing');
    if (typing) typing.remove();
  }

  // Generate session ID
  function generateSessionId() {
    return 'jane_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
