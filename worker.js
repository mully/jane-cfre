/**
 * Jane - CFRE Website Chatbot Worker
 * Cloudflare Worker for handling chat leads and Q&A
 */

// Configuration
const SIERRA_API_KEY = 'b9600377-1eb4-4a57-9e3c-29c8c3122a96';
const SIERRA_BASE_URL = 'https://api.sierrainteractivedev.com';
const JIM_TELEGRAM_BOT = 'https://api.telegram.org/bot<TOKEN>/sendMessage';
const JIM_CHAT_ID = '7760802474';

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

  // Flow: Collecting contact info (common across flows)
  if (flow?.endsWith('-contact') || flow?.endsWith('-info')) {
    // Try to parse contact info from message
    const { name, email, phone } = parseContactInfo(message);
    
    if (email || phone) {
      // We have enough to create a lead
      const leadPayload = {
        ...leadData,
        ...body.collected,
        firstName: name?.split(' ')[0] || '',
        lastName: name?.split(' ').slice(1).join(' ') || '',
        email: email || '',
        phone: phone || '',
        leadStatus: 'New',
        sourceType: 'SierraApi',
        note: `Captured via Jane chatbot. Flow: ${flow}. Message: ${message?.substring(0, 100)}`
      };

      // Create lead in Sierra
      const result = await createSierraLead(leadPayload);
      
      // Notify Jim
      await notifyTelegram(leadPayload, result);

      return jsonResponse({
        message: `Thanks ${name?.split(' ')[0] || ''}! Jim or a team member will reach out to you within 24 hours. Is there anything specific I can pass along about what you're looking for?`,
        flow: 'complete',
        leadCreated: result.success,
        buttons: [
          { label: "No, I'm all set", value: "done", icon: "✅" },
          { label: "Add more details", value: "more", icon: "📝" }
        ]
      });
    } else {
      // Need more info
      return jsonResponse({
        message: "I need a bit more info to connect you. Could you provide your email address or phone number?",
        flow: flow,
        collected: leadData
      });
    }
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
  const result = await createSierraLead(leadData);
  
  if (result.success) {
    await notifyTelegram(leadData, result);
  }
  
  return jsonResponse(result, result.success ? 201 : 400);
}

/**
 * Create lead in Sierra Interactive
 */
async function createSierraLead(leadData) {
  try {
    const response = await fetch(`${SIERRA_BASE_URL}/leads`, {
      method: 'POST',
      headers: {
        'Sierra-ApiKey': SIERRA_API_KEY,
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
async function notifyTelegram(lead, result) {
  try {
    // Only notify on success
    if (!result.success) return;

    const message = `🏠 New Lead via Jane Chatbot

Name: ${lead.firstName} ${lead.lastName}
Email: ${lead.email || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Type: ${lead.leadType || 'Unknown'}
Source: ${lead.source || 'Website Chat'}

Sierra ID: ${result.leadId || 'N/A'}
`;

    // Fire-and-forget notification
    fetch(JIM_TELEGRAM_BOT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: JIM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    }).catch(err => console.error('Telegram notify error:', err));

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
