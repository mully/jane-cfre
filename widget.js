(() => {
  if (window.__CFRE_JANE_WIDGET_LOADED__) return;
  window.__CFRE_JANE_WIDGET_LOADED__ = true;

  const cfg = window.CFREChatConfig || {};
  const apiUrl = cfg.apiUrl || 'https://chatbot.cyfairre.com/api/chat';
  const brandName = cfg.brandName || 'CY-FAIR Real Estate';
  const assistantName = cfg.assistantName || 'Jane';
  const primary = cfg.primaryColor || '#12122a';
  const avatarUrl = cfg.avatarUrl || "data:image/jpeg;base64,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";
  const storageKey = 'cfreChatSessionId';
  const sessionId = localStorage.getItem(storageKey) || ('cfre-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  localStorage.setItem(storageKey, sessionId);
  let sessionNotified = false;

  const style = document.createElement('style');
  style.textContent = `
    #cfre-jane-button { position: fixed; right: 22px; bottom: 22px; z-index: 999999; background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 12px 16px; font: 700 15px system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.25); cursor: pointer; display: flex; align-items: center; gap: 10px; }
    #cfre-jane-button .mini-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.8); }
    #cfre-jane-panel { position: fixed; right: 22px; bottom: 82px; z-index: 999999; width: min(390px, calc(100vw - 32px)); height: min(590px, calc(100vh - 110px)); background: #fff; border-radius: 18px; box-shadow: 0 16px 50px rgba(0,0,0,.30); display: none; overflow: hidden; border: 1px solid rgba(18,18,42,.16); font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    #cfre-jane-panel.open { display: flex; flex-direction: column; }
    #cfre-jane-header { background: ${primary}; color: white; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
    #cfre-jane-avatar-wrap { position: relative; width: 46px; height: 46px; flex: 0 0 auto; }
    #cfre-jane-avatar { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.9); background: white; }
    #cfre-jane-status { position: absolute; left: 0px; bottom: 3px; width: 13px; height: 13px; background: #30d158; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 rgba(48,209,88,.65); animation: cfrePulse 1.8s infinite; }
    @keyframes cfrePulse { 0% { box-shadow: 0 0 0 0 rgba(48,209,88,.65); } 70% { box-shadow: 0 0 0 8px rgba(48,209,88,0); } 100% { box-shadow: 0 0 0 0 rgba(48,209,88,0); } }
    #cfre-jane-title { font-weight: 800; font-size: 16px; line-height: 1.2; }
    #cfre-jane-subtitle { opacity: .88; font-size: 12px; margin-top: 2px; }
    #cfre-jane-close { margin-left: auto; background: transparent; color: white; border: 0; font-size: 22px; cursor: pointer; line-height: 1; opacity: .9; }
    #cfre-jane-messages { flex: 1; padding: 14px; overflow: auto; background: #f7f7fb; }
    .cfre-msg { margin: 9px 0; padding: 10px 12px; border-radius: 14px; max-width: 86%; line-height: 1.38; font-size: 14px; white-space: pre-wrap; }
    .cfre-msg.bot { background: white; color: #20202a; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
    .cfre-msg.user { background: ${primary}; color: white; margin-left: auto; border-bottom-right-radius: 4px; }
    #cfre-jane-form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; background: white; }
    #cfre-jane-input { flex: 1; border: 1px solid #d8d8e2; border-radius: 999px; padding: 11px 13px; font-size: 14px; outline: none; }
    #cfre-jane-input:focus { border-color: ${primary}; box-shadow: 0 0 0 3px rgba(18,18,42,.10); }
    #cfre-jane-send { background: ${primary}; color: white; border: 0; border-radius: 999px; padding: 0 15px; font-weight: 800; cursor: pointer; }
    #cfre-jane-powered { text-align: center; font-size: 11px; color: #777; padding: 0 0 9px; background: white; }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'cfre-jane-button';
  button.innerHTML = `<img class="mini-avatar" src="${avatarUrl}" alt="${assistantName}" /><span>Chat with ${assistantName}</span>`;

  const panel = document.createElement('div');
  panel.id = 'cfre-jane-panel';
  panel.innerHTML = `
    <div id="cfre-jane-header">
      <div id="cfre-jane-avatar-wrap"><img id="cfre-jane-avatar" src="${avatarUrl}" alt="${assistantName}" /><span id="cfre-jane-status"></span></div>
      <div><div id="cfre-jane-title">${assistantName}</div><div id="cfre-jane-subtitle">Assistant at ${brandName}</div></div>
      <button id="cfre-jane-close" type="button" aria-label="Close chat">×</button>
    </div>
    <div id="cfre-jane-messages"></div>
    <form id="cfre-jane-form">
      <input id="cfre-jane-input" autocomplete="off" placeholder="Type your message..." />
      <button id="cfre-jane-send" type="submit">Send</button>
    </form>
    <div id="cfre-jane-powered">Powered by <strong>CY-FAIR Real Estate</strong></div>`;

  document.body.appendChild(button);
  document.body.appendChild(panel);

  const messages = panel.querySelector('#cfre-jane-messages');
  const form = panel.querySelector('#cfre-jane-form');
  const input = panel.querySelector('#cfre-jane-input');
  const closeBtn = panel.querySelector('#cfre-jane-close');

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'cfre-msg ' + who;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function sendToJane(text, extra) {
    const payload = Object.assign({
      message: text,
      sessionId,
      page_url: location.href,
      referrer: document.referrer || null
    }, extra || {});
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async function notifySessionStart() {
    if (sessionNotified) return;
    sessionNotified = true;
    try {
      await sendToJane('Session started. Please greet the visitor briefly and ask how you can help.', { event: 'session_start' });
    } catch (err) {
      // Non-blocking; the visitor can still chat.
    }
  }

  function openPanel() {
    panel.classList.add('open');
    if (!messages.dataset.started) {
      messages.dataset.started = '1';
      addMsg("Hi! My name is " + assistantName + ", I'm an assistant at " + brandName + ". How can I help you?", 'bot');
      notifySessionStart();
    }
    input.focus();
  }

  button.addEventListener('click', () => {
    if (panel.classList.contains('open')) panel.classList.remove('open');
    else openPanel();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMsg(text, 'user');
    const wait = addMsg(assistantName + ' is typing...', 'bot');
    try {
      const data = await sendToJane(text);
      wait.textContent = data.reply || data.message || data.error || 'Sorry, I had trouble answering that.';
    } catch (err) {
      wait.textContent = 'Sorry, I could not connect right now. You can call CY-FAIR Real Estate at 713-446-1018.';
    }
  });
})();
