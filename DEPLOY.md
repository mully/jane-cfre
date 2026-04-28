# Deploy Jane to CyFairRealEstate.com

This repo is already connected to Cloudflare. Pushes to `main` should trigger the Cloudflare deployment that was configured from GitHub.

## 1. Confirm Jane works locally

Jane's local backend is the FastAPI bridge:

```text
/Users/jim/.hermes/profiles/cfrechatbot/server.py
```

Run it with Hermes' Python environment:

```bash
/Users/jim/.hermes/hermes-agent/venv/bin/python3 /Users/jim/.hermes/profiles/cfrechatbot/server.py
```

Verify locally:

```bash
python3 - <<'PY'
import json, urllib.request
print(urllib.request.urlopen('http://127.0.0.1:8084/health').read().decode())
req=urllib.request.Request('http://127.0.0.1:8084/chat', data=json.dumps({'message':'Tell me about Bridgeland.'}).encode(), headers={'Content-Type':'application/json'}, method='POST')
print(urllib.request.urlopen(req, timeout=120).read().decode())
PY
```

Expected:

- `/health` returns status ok.
- `/chat` returns a Jane answer.

## 2. Create a public HTTPS backend URL

The Worker cannot call `127.0.0.1`. Create a public URL that forwards to local port 8084.

Recommended production option:

```text
Cloudflare Tunnel -> http://127.0.0.1:8084
```

Suggested hostname:

```text
jane-origin.cyfairrealestate.com
```

Then the public backend URL is:

```text
https://jane-origin.cyfairrealestate.com
```

For quick temporary testing, ngrok can expose port 8084, but the URL changes unless using a paid/static domain.

## 3. Set Cloudflare Worker variable

In Cloudflare Dashboard:

1. Workers & Pages
2. jane-cfre
3. Settings
4. Variables
5. Add/update variable:

```text
JANE_BACKEND_URL=https://jane-origin.cyfairrealestate.com
```

Save and redeploy if Cloudflare does not automatically redeploy.

No OpenAI/Kimi/Sierra key is required in this Worker for basic chat proxy mode.

## 4. Deploy Worker from GitHub

Because this repository is connected to Cloudflare, commit and push to GitHub:

```bash
git add worker.js wrangler.toml README.md DEPLOY.md
git commit -m "Switch Jane Worker to Hermes backend proxy"
git push origin main
```

Cloudflare should redeploy automatically.

If manually configuring GitHub integration in Cloudflare:

- Build command: leave empty
- Deploy command: `npx wrangler deploy`

## 5. Configure Worker custom domain

Use either:

```text
https://jane-cfre.cyfairrealestate.com
```

or, if you prefer:

```text
https://chat.cyfairrealestate.com
```

Cloudflare Worker should serve:

```text
/health
/widget.js
/api/chat
```

Test:

```bash
python3 - <<'PY'
import json, urllib.request
base='https://jane-cfre.cyfairrealestate.com'
print(urllib.request.urlopen(base + '/health').read().decode())
req=urllib.request.Request(base + '/api/chat', data=json.dumps({'message':'Tell me about Hockley new construction.'}).encode(), headers={'Content-Type':'application/json'}, method='POST')
print(urllib.request.urlopen(req, timeout=120).read().decode())
PY
```

## 6. Add widget to CyFairRealEstate.com

Add before `</body>`:

```html
<script>
  window.CFREChatConfig = {
    apiUrl: 'https://jane-cfre.cyfairrealestate.com/api/chat',
    brandName: 'CY-FAIR Real Estate',
    assistantName: 'Jane',
    primaryColor: '#12122a'
  };
</script>
<script src="https://jane-cfre.cyfairrealestate.com/widget.js" async></script>
```

Typo checks:

- `CFREChatConfig`, not `CFREChatContig`
- `widget.js`, not `widget.is`
- `async`, not `asvnc`

## 7. Production hardening before broad public launch

Add next:

- LaunchAgent or VPS process manager for Jane backend.
- Rate limiting/bot protection.
- Lead capture logging.
- Telegram notification for complete leads.
- Sierra lead creation after test mode is verified.
