/**
 * Jane - CFRE Website Chatbot Worker
 * Cloudflare Worker for handling chat leads and Q&A
 * 
 * Required Environment Variables:
 * - SIERRA_API_KEY
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 * - ASSISTANT_NAME (optional, defaults to Jane)
 * - BRAND_NAME (optional, defaults to CY-FAIR Real Estate)
 */

const SIERRA_BASE_URL = 'https://api.sierrainteractivedev.com';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route: /api/chat - Main chat endpoint
      if (path === '/api/chat' && request.method === 'POST') {
        return await handleChat(request, env);
      }

      // Route: /api/lead - Direct lead creation
      if (path === '/api/lead' && request.method === 'POST') {
        return await handleLeadCreate(request, env);
      }

      // Route: /health - Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', service: 'jane-cfre' });
      }

      // Route: /widget.js - Serve the chat widget
      if (path === '/widget.js') {
        return serveWidget();
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: 'Internal error', message: error.message }, 500);
    }
  }
};

/**
 * Handle chat messages - deterministic flows first, then fallbacks
 */
async function handleChat(request, env) {
  const body = await request.json();
  const { message, sessionId, flow, leadData } = body;

  // Log for debugging
  console.log('Chat request:', { message: message?.substring(0, 50), flow, sessionId });

  // DETERMINISTIC FLOWS (no AI needed)
  
  // Flow: Initial greeting/buttons
  if (!flow || flow === 'welcome') {
    return jsonResponse({
      message: "Hi! I'm Jane, CFRE's virtual client concierge. I can help you buy, sell, get your home value, or connect with our team.",
      buttons: [
        { label: "Buy a Home", value: "buy", icon: "🏠" },
        { label: "Sell My Home", value: "sell", icon: "💰" },
        { label: "Home Value", value: "value", icon: "📊" },
        { label: "Talk to Agent", value: "contact", icon: "📞" }
      ],
      flow: 'welcome'
    });
  }

  // Flow: Buy
  if (flow === 'buy' || detectIntent(message, ['buy', 'purchase', 'looking for home'])) {
    return jsonResponse({
      message: "Great! I'd love to help you find your next home. What's your target area or community in the CyFair/Houston area?",
      flow: 'buy-area',
      collected: { leadType: 'Buyer', source: 'Website Chat - Buy' }
    });
  }

  // Flow: Sell  
  if (flow === 'sell' || detectIntent(message, ['sell', 'selling', 'list my home'])) {
    return jsonResponse({
      message: "Absolutely! I can help you understand your home's value and selling options. What's the property address you'd like to sell?",
      flow: 'sell-address',
      collected: { leadType: 'Seller', source: 'Website Chat - Sell' }
    });
  }

  // Flow: Home Value
  if (flow === 'value' || detectIntent(message, ['value', 'worth', 'price', 'home value'])) {
    return jsonResponse({
      message: "I'll help you get a home value estimate. What's the property address?",
      flow: 'value-address',
      collected: { leadType: 'Seller', source: 'Website Chat - Home Value' }
    });
  }

  // Flow: Contact/Talk to Agent
  if (flow === 'contact' || detectIntent(message, ['contact', 'talk', 'call', 'speak', 'agent'])) {
    return jsonResponse({
      message: "I'd be happy to connect you with Jim or our team. What's your name and the best phone number or email to reach you?",
      flow: 'contact-info',
      collected: { leadType: 'Both', source: 'Website Chat - Contact Request' }
    });
  }

  // Flow: After getting address/area info, move to contact collection
  if (flow === 'value-address' || flow === 'sell-address') {
    // User provided address, now ask for contact info
    const addressInfo = message || 'Address provided';
    return jsonResponse({
      message: `Got it! I'll look up information on that property. To send you the home value report, I'll need your name, email, and phone number.`,
      flow: 'contact-info',
      collected: { 
        ...leadData, 
        address: addressInfo,
        note: `Property address: ${addressInfo}`
      }
    });
  }

  if (flow === 'buy-area') {
    const areaInfo = message || 'Area provided';
    return jsonResponse({
      message: `${areaInfo} is a great area! To send you available listings and schedule showings, I'll need your name, email, and phone number.`,
      flow: 'contact-info',
      collected: { 
        ...leadData, 
        area: areaInfo,
        note: `Interested area: ${areaInfo}`
      }
    });
  }

  // Flow: Collecting contact info (common across flows)
  if (flow?.endsWith('-contact') || flow?.endsWith('-info')) {
    // Try to parse contact info from message
    const { name, email, phone } = parseContactInfo(message);
    
    // Merge with any previously collected data
    const collected = {
      ...leadData,
      name: name || leadData?.name || null,
      email: email || leadData?.email || null,
      phone: phone || leadData?.phone || null
    };
    
    // Check if we have ALL required fields: first name, last name, email, phone
    const hasFirstName = collected.name?.split(' ')[0];
    const hasLastName = collected.name?.split(' ').length > 1;
    const hasEmail = collected.email;
    const hasPhone = collected.phone;
    
    const missingFields = [];
    if (!hasFirstName) missingFields.push("first name");
    if (!hasLastName) missingFields.push("last name");
    if (!hasEmail) missingFields.push("email");
    if (!hasPhone) missingFields.push("phone number");
    
    if (missingFields.length > 0) {
      // Need more info - tell them what's missing
      return jsonResponse({
        message: `To connect you with our team, I'll need your ${missingFields.join(", ")}. Could you provide ${missingFields.length > 1 ? 'those' : 'that'}?`,
        flow: flow,
        collected: collected
      });
    }
    
    // We have all required fields - create lead payload
    const leadPayload = {
      ...body.collected,
      firstName: collected.name.split(' ')[0],
      lastName: collected.name.split(' ').slice(1).join(' '),
      email: collected.email,
      phone: collected.phone,
      leadStatus: 'New',
      sourceType: 'SierraApi',
      note: `Captured via Jane chatbot (TEST MODE - NOT SAVED TO SIERRA). Flow: ${flow}. Message: ${message?.substring(0, 100)}`
    };

    // TEMPORARILY DISABLED: Create lead in Sierra
    // const result = await createSierraLead(leadPayload);
    const result = { success: true, leadId: 'TEST-NOT-SAVED', testMode: true };
    
    // Notify Jim (TEST MODE)
    await notifyTelegram(leadPayload, result, env);

    return jsonResponse({
      message: `Thanks ${leadPayload.firstName}! I've passed your information along. Jim or a team member will reach out to you within 24 hours at ${leadPayload.phone || leadPayload.email}. Is there anything specific I can pass along about what you're looking for?`,
      flow: 'complete',
      leadCreated: false, // Not actually saved yet
      testMode: true,
      buttons: [
        { label: "No, I'm all set", value: "done", icon: "✅" },
        { label: "Add more details", value: "more", icon: "📝" }
      ]
    });
  }

  // Flow: More details after lead creation
  if (flow === 'complete') {
    return jsonResponse({
      message: "Perfect! You're all set. Jim or someone from the CFRE team will be in touch soon. Thanks for reaching out!",
      flow: 'finished',
      buttons: [
        { label: "Start Over", value: "welcome", icon: "🔄" }
      ]
    });
  }

  // Fallback for unrecognized input
  return jsonResponse({
    message: "I'm here to help! You can choose one of these options or type what you're looking for:",
    buttons: [
      { label: "Buy a Home", value: "buy", icon: "🏠" },
      { label: "Sell My Home", value: "sell", icon: "💰" },
      { label: "Home Value", value: "value", icon: "📊" },
      { label: "Talk to Agent", value: "contact", icon: "📞" }
    ],
    flow: 'welcome'
  });
}

/**
 * Handle direct lead creation (for programmatic use)
 */
async function handleLeadCreate(request, env) {
  const leadData = await request.json();
  const result = await createSierraLead(leadData, env);
  
  if (result.success) {
    await notifyTelegram(leadData, result, env);
  }
  
  return jsonResponse(result, result.success ? 201 : 400);
}

/**
 * Create lead in Sierra Interactive
 */
async function createSierraLead(leadData, env) {
  try {
    const response = await fetch(`${SIERRA_BASE_URL}/leads`, {
      method: 'POST',
      headers: {
        'Sierra-ApiKey': env.SIERRA_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      return { 
        success: true, 
        leadId: result.data?.id,
        message: 'Lead created successfully'
      };
    } else {
      // Check if duplicate
      if (result.errorMessage?.includes('already exists')) {
        return {
          success: true,
          duplicate: true,
          message: 'Lead already exists - updated notes'
        };
      }
      
      return {
        success: false,
        error: result.errorMessage || 'Failed to create lead'
      };
    }
  } catch (error) {
    console.error('Sierra API error:', error);
    return {
      success: false,
      error: 'API connection failed'
    };
  }
}

/**
 * Send notification to Telegram (Jim)
 */
async function notifyTelegram(lead, result, env) {
  try {
    // Only notify on success
    if (!result.success) return;

    console.log('Telegram notify called with env:', {
      hasToken: !!env.TELEGRAM_BOT_TOKEN,
      hasChatId: !!env.TELEGRAM_CHAT_ID,
      tokenPrefix: env.TELEGRAM_BOT_TOKEN?.substring(0, 20)
    });

    const isTestMode = result.testMode || result.leadId === 'TEST-NOT-SAVED';
    const testBanner = isTestMode ? '⚠️ TEST MODE - NOT SAVED TO SIERRA\n\n' : '';

    const message = `${testBanner}🏠 New Lead via Jane Chatbot

Name: ${lead.firstName} ${lead.lastName}
Email: ${lead.email || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Type: ${lead.leadType || 'Unknown'}
Source: ${lead.source || 'Website Chat'}

Sierra ID: ${result.leadId || 'N/A'}
${isTestMode ? '\n⚠️ To enable Sierra saving, remove test mode from worker.js' : ''}`;

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.error('Missing Telegram credentials:', {
        token: !!env.TELEGRAM_BOT_TOKEN,
        chatId: !!env.TELEGRAM_CHAT_ID
      });
      return;
    }

    const botUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log('Sending to Telegram URL:', botUrl.substring(0, 50) + '...');

    // Fire-and-forget notification
    const response = await fetch(botUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const responseData = await response.json();
    console.log('Telegram API response:', response.status, responseData);

    if (!response.ok) {
      console.error('Telegram API error:', responseData);
    }

  } catch (error) {
    console.error('Notification error:', error);
  }
}

/**
 * Detect user intent from message text
 */
function detectIntent(message, keywords) {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Parse contact info from free-form text
 */
function parseContactInfo(text) {
  if (!text) return { name: null, email: null, phone: null };
  
  // Email regex
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  
  // Phone regex (various formats)
  const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  // Simple name extraction (assumes first 2-3 words before email/phone)
  let name = null;
  const words = text.split(/\s+/);
  if (words.length >= 2 && !words[0].includes('@') && !/\d/.test(words[0])) {
    name = words.slice(0, 3).join(' ').replace(/[,:]/, '');
  }
  
  return {
    name: name?.trim() || null,
    email: emailMatch?.[0] || null,
    phone: phoneMatch?.[0] || null
  };
}

/**
 * Serve the widget.js file
 */
function serveWidget() {
  const widgetCode = `(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiUrl: 'https://jane-cfre.jim-787.workers.dev/api/chat',
    brandName: 'CY-FAIR Real Estate',
    assistantName: 'Jane',
    primaryColor: '#1a5f7a',
    position: 'right',
    autoOpen: false,
    ...window.CFREChatConfig
  };

  let chatOpen = false;
  let sessionId = 'jane_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  let currentFlow = 'welcome';
  let collectedData = {};

  function createWidget() {
    const container = document.createElement('div');
    container.id = 'cfre-jane-widget';
    container.innerHTML = \`<style>
      #cfre-jane-widget {
        --jane-primary: \${CONFIG.primaryColor};
        --jane-bg: #ffffff;
        --jane-text: #333333;
        --jane-light: #f5f5f5;
        --jane-border: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .jane-launcher {
        position: fixed;
        bottom: 20px;
        \${CONFIG.position}: 20px;
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
      .jane-launcher:hover { transform: scale(1.05); }
      .jane-launcher svg { width: 28px; height: 28px; fill: white; }
      .jane-chat {
        position: fixed;
        bottom: 90px;
        \${CONFIG.position}: 20px;
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
      .jane-chat.open { opacity: 1; visibility: visible; transform: translateY(0); }
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
      .jane-title { flex: 1; }
      .jane-title h3 { margin: 0; font-size: 16px; font-weight: 600; }
      .jane-title p { margin: 2px 0 0; font-size: 12px; opacity: 0.9; }
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
      .jane-button:hover { background: var(--jane-primary); color: white; }
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
      .jane-input:focus { border-color: var(--jane-primary); }
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
        .jane-chat.open + .jane-launcher { display: none; }
      }
    </style>
    <div class="jane-chat" id="jane-chat">
      <div class="jane-header">
        <div class="jane-avatar">🏠</div>
        <div class="jane-title">
          <h3>\${CONFIG.assistantName}</h3>
          <p>\${CONFIG.brandName}</p>
        </div>
        <button class="jane-close" onclick="janeToggle()">\u00d7</button>
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
    </div>\`;
    
    document.body.appendChild(container);
    if (CONFIG.autoOpen) setTimeout(janeToggle, 1000);
    janeSendToAPI('', 'welcome');
  }

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

  window.janeSend = async function() {
    const input = document.getElementById('jane-input');
    const message = input.value.trim();
    if (!message) return;
    addMessage(message, 'user');
    input.value = '';
    await janeSendToAPI(message, currentFlow, collectedData);
  };

  async function janeSendToAPI(message, flow, data) {
    showTyping();
    try {
      const response = await fetch(CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, flow, sessionId, leadData: data,
          collected: collectedData,
          timestamp: new Date().toISOString(),
          source: window.location?.href || 'unknown'
        })
      });
      const result = await response.json();
      hideTyping();
      if (result.flow) currentFlow = result.flow;
      if (result.collected) collectedData = { ...collectedData, ...result.collected };
      addMessage(result.message, 'bot', result.buttons);
    } catch (error) {
      hideTyping();
      addMessage('Sorry, I\\'m having trouble connecting. Please try again or call us at (713) 446-1018.', 'bot');
    }
  }

  function addMessage(text, sender, buttons) {
    const messages = document.getElementById('jane-messages');
    const messageEl = document.createElement('div');
    messageEl.className = 'jane-message ' + sender;
    messageEl.textContent = text;
    messages.appendChild(messageEl);
    if (buttons && buttons.length > 0) {
      const buttonsEl = document.createElement('div');
      buttonsEl.className = 'jane-buttons';
      buttons.forEach(btn => {
        const btnEl = document.createElement('button');
        btnEl.className = 'jane-button';
        btnEl.innerHTML = (btn.icon || '') + ' ' + btn.label;
        btnEl.onclick = () => handleButtonClick(btn.value, btn.label);
        buttonsEl.appendChild(btnEl);
      });
      messages.appendChild(buttonsEl);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleButtonClick(value, label) {
    addMessage(label, 'user');
    const flowMap = { 'buy': 'buy', 'sell': 'sell', 'value': 'value', 'contact': 'contact', 'welcome': 'welcome', 'done': 'complete', 'more': 'more-info' };
    await janeSendToAPI(label, flowMap[value] || value, collectedData);
  }

  function showTyping() {
    const messages = document.getElementById('jane-messages');
    const typing = document.createElement('div');
    typing.className = 'jane-typing';
    typing.id = 'jane-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('jane-typing');
    if (typing) typing.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();`;

  return new Response(widgetCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

/**
 * Helper: JSON response with CORS
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
