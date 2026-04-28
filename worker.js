/**
 * Jane - CFRE Website Chatbot Worker
 * Cloudflare Worker for handling chat leads and Q&A
 * 
 * Required Environment Variables:
 * - KIMI_API_KEY (for AI responses via Kimi K2.5)
 * - TELEGRAM_BOT_TOKEN (for notifications)
 * - TELEGRAM_CHAT_ID (your Telegram ID)
 * - SIERRA_API_KEY (optional, for lead creation)
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
        return jsonResponse({ 
          status: 'ok', 
          service: 'jane-cfre',
          env_check: {
            has_kimi_key: !!env.KIMI_API_KEY,
            kimi_key_prefix: env.KIMI_API_KEY ? env.KIMI_API_KEY.substring(0, 10) + '...' : 'NOT SET',
            has_telegram_token: !!env.TELEGRAM_BOT_TOKEN,
            has_chat_id: !!env.TELEGRAM_CHAT_ID
          }
        });
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
 * Handle chat messages - Forward to CFRE Chatbot Agent
 */
async function handleChat(request, env) {
  const body = await request.json();
  const { message } = body;

  console.log('Chat request:', { message: message?.substring(0, 50) });

  // First message - welcome
  if (!message || message === '') {
    return jsonResponse({
      message: "Hi! I'm here to help with your Cy-Fair real estate questions. Ask me about neighborhoods, schools, market trends, or connect with one of our agents!",
      buttons: [
        { label: "Buy a Home", value: "buy", icon: "🏠" },
        { label: "Sell My Home", value: "sell", icon: "💰" },
        { label: "Home Value", value: "value", icon: "📊" },
        { label: "Talk to Agent", value: "contact", icon: "📞" }
      ],
      flow: 'welcome'
    });
  }

  // Forward to local chatbot server
  // TODO: Replace with your ngrok URL or server address
  const CHATBOT_URL = env.CHATBOT_URL || 'http://localhost:8080/chat';
  
  try {
    // For now, use built-in knowledge base + Kimi if available
    const knowledge = searchKnowledge(message);
    const aiResponse = await getAIResponse(message, knowledge, env);
    
    // Check for contact info
    const contactInfo = parseContactInfo(message);
    if ((contactInfo.email || contactInfo.phone) && 
        (message.toLowerCase().includes('agent') || 
         message.toLowerCase().includes('contact') ||
         message.toLowerCase().includes('call'))) {
      
      const leadPayload = {
        firstName: contactInfo.name?.split(' ')[0] || 'Website',
        lastName: contactInfo.name?.split(' ').slice(1).join(' ') || 'Visitor',
        email: contactInfo.email || '',
        phone: contactInfo.phone || '',
        leadType: 'Both',
        source: 'Website Chat - CFRE Chatbot',
        note: `Message: ${message?.substring(0, 150)}`
      };

      const result = { success: true, leadId: 'TEST-NOT-SAVED', testMode: true };
      await notifyTelegram(leadPayload, result, env);
    }
    
    return jsonResponse({
      message: aiResponse,
      flow: 'ai-chat'
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return jsonResponse({
      message: "I'm here to help with your real estate questions! Ask me about Cy-Fair neighborhoods, schools, or how to connect with our team.",
      flow: 'error-fallback'
    });
  }
}

/**
 * Get AI response from Kimi K2.5 with knowledge context
 */
async function getAIResponse(userMessage, knowledge, env) {
  const KIMI_API_KEY = env.KIMI_API_KEY || env.OPENAI_API_KEY;
  
  console.log('getAIResponse called:', {
    has_kimi_key: !!env.KIMI_API_KEY,
    has_openai_key: !!env.OPENAI_API_KEY,
    using_key: KIMI_API_KEY ? 'YES' : 'NO'
  });
  
  if (!KIMI_API_KEY) {
    console.log('No API key found, using knowledge fallback');
    return `Based on our local expertise: ${knowledge.substring(0, 800)}. Would you like to connect with Jim or one of our agents for personalized assistance?`;
  }

  const systemPrompt = `You are Jane, a friendly and knowledgeable virtual assistant for CY-FAIR Real Estate (CFRE), a boutique real estate brokerage in Cypress, Texas (Cy-Fair area).

YOUR ROLE:
- Answer questions about Cy-Fair real estate, neighborhoods, schools, and market conditions
- Be conversational, helpful, and professional  
- Use the provided KNOWLEDGE BASE to answer accurately
- If you don't know something specific, be honest and offer to connect them with an agent
- Always mention you're an AI assistant and offer human help when appropriate

KNOWLEDGE BASE:
${knowledge}

GUIDELINES:
- Keep responses conversational but concise (2-4 sentences)
- Mention specific neighborhoods, schools, and data when relevant
- If they seem ready to buy/sell, suggest speaking with Jim or an agent
- Phone: 713-446-1018, Website: CyFairRealEstate.com
- Be warm and approachable - use "we" and "our team"`;

  try {
    // Try Kimi API first
    console.log('Calling Kimi API with key prefix:', KIMI_API_KEY.substring(0, 15) + '...');
    
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-5',  // Kimi K2.5 model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    console.log('Kimi API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Kimi API error:', response.status, errorData);
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Kimi API success, response length:', data.choices[0].message.content.length);
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('AI error:', error.message);
    // Fallback to knowledge base
    return `Based on what I know about Cy-Fair real estate:\n\n${knowledge.substring(0, 600)}...\n\nFor personalized help, I can connect you with Jim or one of our agents. Just share your name and contact info!`;
  }
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
 * CFRE Knowledge Base - Embedded wiki data for Jane
 */
const CFRE_KNOWLEDGE = {
  company: {
    name: "CY-FAIR Real Estate",
    description: "A boutique real estate brokerage serving the Cy-Fair and greater Houston area with personalized service and local expertise.",
    phone: "713-446-1018",
    website: "CyFairRealEstate.com",
    address: "Cypress, TX (Cy-Fair area)"
  },
  
  agents: {
    jim_mulholland: {
      name: "Jim Mulholland",
      role: "Broker/Owner",
      specialties: ["Luxury homes", "Investor clients", "New construction", "Relocation"],
      experience: "15+ years in Cy-Fair real estate",
      contact: "Jim@cfre.me"
    },
    wendy: {
      name: "Wendy",
      role: "Owner/Agent", 
      specialties: ["First-time buyers", "Family homes"],
      contact: "Available through main office"
    },
    kyle: {
      name: "Kyle",
      role: "Agent",
      specialties: ["First-time buyers", "Young professionals", "Condos and townhomes"]
    },
    justin: {
      name: "Justin", 
      role: "Agent",
      specialties: ["Residential sales", "Buyer representation"]
    },
    tammy: {
      name: "Tammy",
      role: "Agent",
      specialties: ["Residential sales", "Seller representation"]
    },
    ana: {
      name: "Ana",
      role: "Agent",
      specialties: ["Bilingual (Spanish)", "Family homes", "First-time buyers"]
    },
    tricia: {
      name: "Tricia",
      role: "Agent",
      specialties: ["Residential sales", "Community expert"]
    }
  },
  
  neighborhoods: {
    bridgeland: {
      name: "Bridgeland",
      description: "Master-planned community with excellent schools, lakes, trails, and multiple villages. Popular with families.",
      schools: "Bridgeland High School (9/10), Wells Elementary, Smith Middle School",
      builders: ["Perry Homes", "Taylor Morrison", "Lennar", "Highland Homes"],
      price_range: "$400K - $1.5M+"
    },
    cypress_creek_lakes: {
      name: "Cypress Creek Lakes",
      description: "Established community with mature trees, community pools, and tennis courts. Good school zone.",
      schools: "Cy-Ranch High School, Warner Elementary",
      price_range: "$350K - $700K"
    },
    towne_lake: {
      name: "Towne Lake",
      description: "Large master-planned community with 300-acre lake, boating, and waterfront properties.",
      schools: "Cypress Ranch High School, Rennell Elementary",
      builders: ["Lennar", "KB Home", "Perry Homes"],
      price_range: "$350K - $900K"
    },
    blackhorse_ranch: {
      name: "Blackhorse Ranch",
      description: "Golf course community with custom homes and established neighborhoods.",
      schools: "Cypress Springs High School",
      price_range: "$400K - $800K"
    },
    coles_crossing: {
      name: "Coles Crossing",
      description: "Family-friendly community with great amenities and Cy-Fair ISD schools.",
      schools: "Cy-Fair High School, Goodson Middle School",
      price_range: "$300K - $600K"
    }
  },
  
  schools: {
    cy_fair_isd: {
      name: "Cy-Fair ISD",
      rating: "A-rated district",
      note: "One of the largest and highest-performing school districts in Texas",
      top_schools: ["Bridgeland High", "Cypress Ranch High", "Cy-Fair High", "Langham Creek High"]
    },
    bridgeland_high: {
      name: "Bridgeland High School",
      rating: "9/10 GreatSchools",
      note: "Top-rated high school in the area, strong academics and athletics"
    }
  },
  
  market_stats: {
    current: "As of 2024, Cy-Fair area median home price is approximately $380,000",
    trend: "Steady appreciation with 3-5% annual growth typical for the area",
    inventory: "Moderate inventory levels - still a seller's market in most price ranges under $500K",
    hot_areas: "Bridgeland, Towne Lake, and Cypress Creek Lakes remain the most active"
  },
  
  builders: {
    perry_homes: "Texas-based builder known for quality construction and energy efficiency",
    lennar: "National builder offering everything's included packages and quick move-in homes",
    taylor_morrison: "Premium builder with customizable floor plans",
    highland_homes: "Luxury custom builder in select Cy-Fair communities",
    kb_home: "Affordable new construction with personalization options"
  },
  
  services: {
    buying: "Full buyer representation including MLS access, showing coordination, offer negotiation, and closing support",
    selling: "Comprehensive marketing including professional photography, online syndication, open houses, and negotiation",
    home_value: "Free comparative market analysis (CMA) to determine your home's current market value",
    new_construction: "Representation for buyers purchasing new builds (no cost to buyer)"
  }
};

/**
 * Search knowledge base for relevant context
 */
function searchKnowledge(query) {
  const query_lower = query.toLowerCase();
  let results = [];
  
  // Search neighborhoods
  for (const [key, data] of Object.entries(CFRE_KNOWLEDGE.neighborhoods)) {
    if (query_lower.includes(key.replace('_', ' ')) || 
        query_lower.includes(data.name.toLowerCase())) {
      results.push(`Neighborhood: ${data.name} - ${data.description}. Schools: ${data.schools}. Price range: ${data.price_range}. Builders: ${data.builders?.join(', ') || 'Various'}`);
    }
  }
  
  // Search schools
  if (query_lower.includes('school') || query_lower.includes('education') || query_lower.includes('isd')) {
    results.push(`Schools: ${CFRE_KNOWLEDGE.schools.cy_fair_isd.name} is ${CFRE_KNOWLEDGE.schools.cy_fair_isd.rating}. ${CFRE_KNOWLEDGE.schools.cy_fair_isd.note}. Top schools include ${CFRE_KNOWLEDGE.schools.cy_fair_isd.top_schools.join(', ')}.`);
  }
  
  // Search agents
  for (const [key, agent] of Object.entries(CFRE_KNOWLEDGE.agents)) {
    if (query_lower.includes(agent.name.toLowerCase()) || 
        query_lower.includes('agent') || 
        query_lower.includes('realtor') ||
        agent.specialties.some(s => query_lower.includes(s.toLowerCase()))) {
      results.push(`Agent: ${agent.name} - ${agent.role}. Specialties: ${agent.specialties.join(', ')}. ${agent.experience || ''}`);
    }
  }
  
  // Search market stats
  if (query_lower.includes('market') || query_lower.includes('price') || query_lower.includes('value') || query_lower.includes('cost')) {
    results.push(`Market: ${CFRE_KNOWLEDGE.market_stats.current}. Trend: ${CFRE_KNOWLEDGE.market_stats.trend}. ${CFRE_KNOWLEDGE.market_stats.inventory}`);
  }
  
  // Search builders
  for (const [key, info] of Object.entries(CFRE_KNOWLEDGE.builders)) {
    if (query_lower.includes(key.replace('_', ' '))) {
      results.push(`Builder: ${key.replace('_', ' ')} - ${info}`);
    }
  }
  
  // Search services
  if (query_lower.includes('buy') || query_lower.includes('purchase')) {
    results.push(`Service: ${CFRE_KNOWLEDGE.services.buying}`);
  }
  if (query_lower.includes('sell') || query_lower.includes('listing')) {
    results.push(`Service: ${CFRE_KNOWLEDGE.services.selling}`);
  }
  
  // Always include company info
  results.unshift(`About CFRE: ${CFRE_KNOWLEDGE.company.description} Contact: ${CFRE_KNOWLEDGE.company.phone}. Website: ${CFRE_KNOWLEDGE.company.website}`);
  
  return results.join('\n\n');
}
function serveWidget() {
  const widgetCode = `(function() {
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
