# Jane - CFRE Website Chatbot Deployment Guide

## Overview
Jane is a custom website chatbot for CyFairRealEstate.com that captures leads and sends them directly to Sierra Interactive via Cloudflare Workers.

## Architecture
- **Frontend:** JavaScript widget (widget.js) - embeds on your website
- **Backend:** Cloudflare Worker (worker.js) - handles API calls securely
- **CRM:** Sierra Interactive API - direct lead creation
- **Notifications:** Telegram alerts to Jim

## Step 1: Set Up Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Create a free account (no credit card required)
3. Verify your email

## Step 2: Install Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This will open a browser to authenticate.

## Step 3: Deploy the Worker

```bash
# Navigate to the project directory
cd /Users/jim/.hermes/cfre-jane-cloudflare

# Create the worker
wrangler deploy
```

Your worker will be deployed to: `https://jane-cfre.<your-subdomain>.workers.dev`

## Step 4: Set Secrets (IMPORTANT)

These are never exposed in code:

```bash
# Sierra API Key
wrangler secret put SIERRA_API_KEY
# Enter: b9600377-1eb4-4a57-9e3c-29c8c3122a96

# Telegram Bot Token (create via @BotFather)
wrangler secret put TELEGRAM_BOT_TOKEN
# Enter: your_bot_token_here

# Telegram Chat ID (Jim's ID)
wrangler secret put TELEGRAM_CHAT_ID
# Enter: 7760802474
```

## Step 5: Test the API

```bash
# Health check
curl https://jane-cfre.<your-subdomain>.workers.dev/health

# Test chat endpoint
curl -X POST https://jane-cfre.<your-subdomain>.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"", "flow":"welcome"}'
```

## Step 6: Update Worker.js with Telegram Token

Before deploying, update line 8 in `worker.js`:

```javascript
const JIM_TELEGRAM_BOT = 'https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage';
```

Replace `<YOUR_BOT_TOKEN>` with your actual bot token from @BotFather.

## Step 7: Host the Widget

Option A: Cloudflare Pages (Recommended)
```bash
# Upload widget.js to Cloudflare Pages or R2
# Get URL: https://chat.cyfairrealestate.com/widget.js
```

Option B: Self-host on your website
```bash
# Upload widget.js to your web server
# Access via: https://cyfairrealestate.com/js/widget.js
```

## Step 8: Embed on Website

Add this to your website's HTML (before closing `</body>` tag):

```html
<script>
  window.CFREChatConfig = {
    apiUrl: 'https://jane-cfre.<your-subdomain>.workers.dev/api/chat',
    brandName: 'CY-FAIR Real Estate',
    assistantName: 'Jane'
  };
</script>
<script src="https://chat.cyfairrealestate.com/widget.js" async></script>
```

## Step 9: Test End-to-End

1. Visit your website
2. Click the chat bubble
3. Select "Buy a Home"
4. Enter your info
5. Check Sierra Interactive for new lead
6. Check Telegram for notification

## Custom Domain (Optional)

To use `chat.cyfairrealestate.com`:

1. In Cloudflare dashboard, go to your Worker
2. Click "Triggers" tab
3. Click "Add Custom Domain"
4. Enter: `chat.cyfairrealestate.com`
5. Add DNS record in your domain registrar

## Files Structure

```
cfre-jane-cloudflare/
├── worker.js           # Backend API (Cloudflare Worker)
├── widget.js           # Frontend widget (host anywhere)
├── wrangler.toml       # Worker configuration
├── DEPLOY.md          # This file
└── README.md          # User documentation
```

## Costs

- **Cloudflare Workers Free Tier:** 100,000 requests/day (more than enough)
- **Cloudflare Pages/R2:** Free for hosting widget.js
- **Total: $0/month**

## Troubleshooting

**Worker not deploying?**
- Check `wrangler.toml` is valid
- Run `wrangler login` again

**Leads not creating?**
- Check Sierra API key is set as secret: `wrangler secret list`
- Check worker logs: `wrangler tail`

**Widget not showing?**
- Check browser console for CORS errors
- Verify `apiUrl` in config matches worker URL
- Ensure `widget.js` is being loaded (check Network tab)

**Telegram notifications not working?**
- Verify bot token is correct
- Ensure Jim has started the bot (@YourBotName)
- Check chat ID is correct (get from @userinfobot)

## Security Notes

- API keys are stored as secrets, never in code
- Worker validates all inputs
- CORS headers restrict to your domain
- No sensitive data exposed to browser

## Next Steps After Deploy

1. Add more flows (property search, financing questions)
2. Style widget to match CFRE brand colors
3. Add analytics/tracking
4. A/B test different greeting messages
5. Add AI fallback for complex questions (Phase 2)

## Support

If stuck on any step, the Cloudflare docs are excellent:
https://developers.cloudflare.com/workers/
