(() => {
  if (window.__CFRE_JANE_WIDGET_LOADED__) return;
  window.__CFRE_JANE_WIDGET_LOADED__ = true;

  const cfg = window.CFREChatConfig || {};
  const apiUrl = cfg.apiUrl || 'https://jane-cfre.cyfairrealestate.com/api/chat';
  const brandName = cfg.brandName || 'CY-FAIR Real Estate';
  const assistantName = cfg.assistantName || 'Jane';
  const primary = cfg.primaryColor || '#12122a';

  const style = document.createElement('style');
  style.textContent = `
    #cfre-jane-button { position: fixed; right: 22px; bottom: 22px; z-index: 999999; background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 14px 18px; font: 600 15px system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.25); cursor: pointer; }
    #cfre-jane-panel { position: fixed; right: 22px; bottom: 82px; z-index: 999999; width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100vh - 110px)); background: #fff; border-radius: 18px; box-shadow: 0 16px 50px rgba(0,0,0,.30); display: none; overflow: hidden; border: 1px solid rgba(0,0,0,.08); font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    #cfre-jane-panel.open { display: flex; flex-direction: column; }
    #cfre-jane-header { background: ${primary}; color: white; padding: 15px 16px; }
    #cfre-jane-title { font-weight: 700; font-size: 16px; }
    #cfre-jane-subtitle { opacity: .85; font-size: 12px; margin-top: 2px; }
    #cfre-jane-messages { flex: 1; padding: 14px; overflow: auto; background: #f7f7fb; }
    .cfre-msg { margin: 9px 0; padding: 10px 12px; border-radius: 14px; max-width: 86%; line-height: 1.35; font-size: 14px; white-space: pre-wrap; }
    .cfre-msg.bot { background: white; color: #20202a; border-bottom-left-radius: 4px; }
    .cfre-msg.user { background: ${primary}; color: white; margin-left: auto; border-bottom-right-radius: 4px; }
    #cfre-jane-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; background: white; }
    #cfre-jane-input { flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: 11px 13px; font-size: 14px; outline: none; }
    #cfre-jane-send { background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 0 15px; font-weight: 700; cursor: pointer; }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'cfre-jane-button';
  button.textContent = 'Chat with Jane';

  const panel = document.createElement('div');
  panel.id = 'cfre-jane-panel';
  panel.innerHTML = `
    <div id="cfre-jane-header">
      <div id="cfre-jane-title">${assistantName} at ${brandName}</div>
      <div id="cfre-jane-subtitle">Ask about Cypress, Hockley, neighborhoods, schools, builders, or buying/selling.</div>
    </div>
    <div id="cfre-jane-messages"></div>
    <form id="cfre-jane-form">
      <input id="cfre-jane-input" autocomplete="off" placeholder="Type your question..." />
      <button id="cfre-jane-send" type="submit">Send</button>
    </form>`;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const messages = panel.querySelector('#cfre-jane-messages');
  const form = panel.querySelector('#cfre-jane-form');
  const input = panel.querySelector('#cfre-jane-input');

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'cfre-msg ' + who;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  button.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && !messages.dataset.started) {
      messages.dataset.started = '1';
      addMsg("Hi, I’m Jane with CY-FAIR Real Estate. I can help with Cypress/Hockley neighborhoods, schools, builders, and new construction. What are you looking for?", 'bot');
      input.focus();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    const wait = addMsg('Jane is typing...', 'bot');
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      wait.textContent = data.reply || data.message || data.error || 'Sorry, I had trouble answering that.';
    } catch (err) {
      wait.textContent = 'Sorry, I could not connect right now. You can call CY-FAIR Real Estate at 713-446-1018.';
    }
  });
})();