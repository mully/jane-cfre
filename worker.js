/**
 * Jane CFRE Cloudflare Worker - Hermes proxy mode
 *
 * Public website widget/edge proxy. The AI runs in the local Hermes
 * cfrechatbot profile behind JANE_BACKEND_URL, not inside this Worker.
 *
 * Required Worker variable:
 * - JANE_BACKEND_URL = https://jane-origin.cyfairrealestate.com
 */

const WIDGET_JS = "(() => {\n  if (window.__CFRE_JANE_WIDGET_LOADED__) return;\n  window.__CFRE_JANE_WIDGET_LOADED__ = true;\n\n  const cfg = window.CFREChatConfig || {};\n  const apiUrl = cfg.apiUrl || 'https://jane-cfre.cyfairrealestate.com/api/chat';\n  const brandName = cfg.brandName || 'CY-FAIR Real Estate';\n  const assistantName = cfg.assistantName || 'Jane';\n  const primary = cfg.primaryColor || '#12122a';\n\n  const style = document.createElement('style');\n  style.textContent = `\n    #cfre-jane-button { position: fixed; right: 22px; bottom: 22px; z-index: 999999; background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 14px 18px; font: 600 15px system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.25); cursor: pointer; }\n    #cfre-jane-panel { position: fixed; right: 22px; bottom: 82px; z-index: 999999; width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 110px)); background: #fff; border-radius: 18px; box-shadow: 0 16px 50px rgba(0,0,0,.30); display: none; overflow: hidden; border: 1px solid rgba(0,0,0,.08); font-family: system-ui, -apple-system, Segoe UI, sans-serif; }\n    #cfre-jane-panel.open { display: flex; flex-direction: column; }\n    #cfre-jane-header { background: ${primary}; color: white; padding: 15px 16px; }\n    #cfre-jane-title { font-weight: 700; font-size: 16px; }\n    #cfre-jane-subtitle { opacity: .85; font-size: 12px; margin-top: 2px; }\n    #cfre-jane-messages { flex: 1; padding: 14px; overflow: auto; background: #f7f7fb; }\n    .cfre-msg { margin: 9px 0; padding: 10px 12px; border-radius: 14px; max-width: 86%; line-height: 1.35; font-size: 14px; white-space: pre-wrap; }\n    .cfre-msg.bot { background: white; color: #20202a; border-bottom-left-radius: 4px; }\n    .cfre-msg.user { background: ${primary}; color: white; margin-left: auto; border-bottom-right-radius: 4px; }\n    #cfre-jane-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; background: white; }\n    #cfre-jane-input { flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: 11px 13px; font-size: 14px; outline: none; }\n    #cfre-jane-send { background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 0 15px; font-weight: 700; cursor: pointer; }\n  `;\n  document.head.appendChild(style);\n\n  const button = document.createElement('button');\n  button.id = 'cfre-jane-button';\n  button.textContent = 'Chat with Jane';\n\n  const panel = document.createElement('div');\n  panel.id = 'cfre-jane-panel';\n  panel.innerHTML = `\n    <div id=\"cfre-jane-header\">\n      <div id=\"cfre-jane-title\">${assistantName} at ${brandName}</div>\n      <div id=\"cfre-jane-subtitle\">Ask about Cypress, Hockley, neighborhoods, schools, builders, or buying/selling.</div>\n    </div>\n    <div id=\"cfre-jane-messages\"></div>\n    <form id=\"cfre-jane-form\">\n      <input id=\"cfre-jane-input\" autocomplete=\"off\" placeholder=\"Type your question...\" />\n      <button id=\"cfre-jane-send\" type=\"submit\">Send</button>\n    </form>`;\n\n  document.body.appendChild(button);\n  document.body.appendChild(panel);\n\n  const messages = panel.querySelector('#cfre-jane-messages');\n  const form = panel.querySelector('#cfre-jane-form');\n  const input = panel.querySelector('#cfre-jane-input');\n\n  function addMsg(text, who) {\n    const div = document.createElement('div');\n    div.className = 'cfre-msg ' + who;\n    div.textContent = text;\n    messages.appendChild(div);\n    messages.scrollTop = messages.scrollHeight;\n    return div;\n  }\n\n  button.addEventListener('click', () => {\n    panel.classList.toggle('open');\n    if (panel.classList.contains('open') && !messages.dataset.started) {\n      messages.dataset.started = '1';\n      addMsg(\"Hi, I\u2019m Jane with CY-FAIR Real Estate. I can help with Cypress/Hockley neighborhoods, schools, builders, and new construction. What are you looking for?\", 'bot');\n      input.focus();\n    }\n  });\n\n  form.addEventListener('submit', async (e) => {\n    e.preventDefault();\n    const text = input.value.trim();\n    if (!text) return;\n    input.value = '';\n    addMsg(text, 'user');\n    const wait = addMsg('Jane is typing...', 'bot');\n    try {\n      const res = await fetch(apiUrl, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ message: text })\n      });\n      const data = await res.json();\n      wait.textContent = data.reply || data.message || data.error || 'Sorry, I had trouble answering that.';\n    } catch (err) {\n      wait.textContent = 'Sorry, I could not connect right now. You can call CY-FAIR Real Estate at 713-446-1018.';\n    }\n  });\n})();";

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'jane-cfre-worker',
        mode: 'hermes-proxy',
        has_backend_url: Boolean(env.JANE_BACKEND_URL),
      });
    }

    if (url.pathname === '/widget.js') {
      return new Response(WIDGET_JS, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          ...corsHeaders(),
        },
      });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return handleChat(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

async function handleChat(request, env) {
  if (!env.JANE_BACKEND_URL) {
    return jsonResponse({
      message: 'Jane is almost ready, but the backend URL is not configured yet.',
      error: 'Missing JANE_BACKEND_URL',
    }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const backendBase = env.JANE_BACKEND_URL.replace(/\/$/, '');
  const backendUrl = backendBase.endsWith('/chat') ? backendBase : `${backendBase}/chat`;

  try {
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: payload.message || '',
        session_id: payload.sessionId || payload.session_id || null,
        visitor: payload.visitor || null,
      }),
    });

    const text = await backendResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = { reply: text };
    }

    if (!backendResponse.ok) {
      return jsonResponse({
        message: "I'm having trouble reaching Jane right now. Please call CY-FAIR Real Estate at 713-446-1018, or try again in a moment.",
        error: data.detail || data.error || `Backend error ${backendResponse.status}`,
      }, 502);
    }

    return jsonResponse({
      message: data.reply || data.message || "I'm here to help with your Cy-Fair real estate questions.",
      flow: 'hermes-proxy',
      profile: data.profile || 'cfrechatbot',
    });
  } catch (error) {
    return jsonResponse({
      message: "I'm having trouble reaching Jane right now. Please call CY-FAIR Real Estate at 713-446-1018, or try again in a moment.",
      error: error.message,
    }, 502);
  }
}
