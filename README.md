# Jane - CFRE Virtual Client Concierge

Jane is the public website chat assistant for CyFairRealEstate.com.

This repository is the Cloudflare Worker/widget layer. It does not run the AI model inside Cloudflare. Instead, it serves the browser widget and proxies chat requests to the working Hermes `cfrechatbot` profile.

## Current Architecture

```text
CyFairRealEstate.com
  -> Cloudflare Worker /widget.js
  -> Cloudflare Worker /api/chat
  -> JANE_BACKEND_URL/chat
  -> Jane FastAPI bridge on port 8084
  -> Hermes profile cfrechatbot
  -> OpenAI Direct gpt-5.4-mini
```

Why this architecture:

- Jane's personality and knowledge live in the Hermes profile, not inside Worker code.
- We avoid the old Kimi/OpenRouter Worker errors.
- Cloudflare only handles public HTTPS, widget delivery, CORS, and proxying.
- API keys stay out of browser JavaScript.

## Files

- `worker.js` - Cloudflare Worker; serves `/widget.js`, `/health`, and proxies `/api/chat`.
- `wrangler.toml` - Worker configuration.
- `DEPLOY.md` - Deployment and CyFairRealEstate.com embed instructions.

## Required Cloudflare Variable

Set this Worker variable in Cloudflare Dashboard:

```text
JANE_BACKEND_URL=https://YOUR-PUBLIC-JANE-BACKEND-URL
```

That URL must point to the Jane FastAPI bridge, which serves:

```text
/health
/chat
```

For example, after setting up Cloudflare Tunnel, it might be:

```text
JANE_BACKEND_URL=https://jane-origin.cyfairrealestate.com
```

## Website Embed

Once the Worker custom domain is live, add this before `</body>` on CyFairRealEstate.com:

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

If using the workers.dev URL temporarily, replace the host with that deployed Worker URL.

## Status

- Local Hermes Jane profile works.
- Local FastAPI bridge works at `http://127.0.0.1:8084`.
- Worker code is ready for GitHub-connected Cloudflare deployment.
- Remaining deployment task: create a public HTTPS backend URL for the local/VPS Jane bridge and set `JANE_BACKEND_URL` in Cloudflare.
