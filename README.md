# Jane - CFRE Virtual Client Concierge

A custom website chatbot for CyFairRealEstate.com that captures leads and integrates directly with Sierra Interactive.

## Quick Start

1. **Sign up** for Cloudflare (free): https://dash.cloudflare.com
2. **Deploy** the worker (5 minutes)
3. **Add** widget.js to your website
4. **Test** lead capture

## What Jane Does

- 🏠 **Greets visitors** with friendly, professional chat
- 📋 **Collects lead info** (name, phone, email, property interest)
- 🔄 **Routes to Sierra** CRM automatically
- 📢 **Alerts Jim** via Telegram instantly
- 🛡️ **Secures data** - API keys hidden, no Zapier needed

## Cost

**$0/month** - Uses Cloudflare Free Tier (100k requests/day)

## Flow

```
Visitor clicks chat
    ↓
Jane offers: Buy | Sell | Home Value | Contact
    ↓
Collects info naturally
    ↓
Creates lead in Sierra
    ↓
Jim gets Telegram alert
```

## Files

- `worker.js` - Backend API (Cloudflare Worker)
- `widget.js` - Chat widget (embed on website)
- `DEPLOY.md` - Step-by-step deployment guide

## Example Chat

**Visitor:** (clicks chat)  
**Jane:** Hi! I'm Jane, CFRE's virtual client concierge. I can help you buy, sell, get your home value, or connect with our team.

**Visitor:** (clicks "Buy a Home")  
**Jane:** Great! What's your target area or community?

**Visitor:** "Bridgeland"  
**Jane:** Perfect! What's the best phone number or email for our team to reach you?

**Visitor:** "john@email.com, 713-555-1234"  
**Jane:** Thanks John! Jim or a team member will reach out within 24 hours.

**Jim:** (gets Telegram notification)

## Lead Data Sent to Sierra

- First/Last Name
- Email & Phone
- Lead Type (Buyer/Seller/Both)
- Source: "Website Chat - Jane"
- Notes with conversation context
- Auto-assigned to appropriate agent

## Status

**Phase 1:** Core flows (Buy/Sell/Home Value/Contact) - READY TO DEPLOY  
**Phase 2:** AI Q&A for complex questions - PLANNED  
**Phase 3:** Property search integration - PLANNED

## Security

- ✅ Sierra API key never exposed to browser
- ✅ All server-side processing
- ✅ CORS restricted to your domain
- ✅ Input validation on all fields
- ✅ No third-party dependencies (Zapier, etc.)

## Customization

Edit `worker.js` to:
- Change greeting messages
- Add more conversation flows
- Modify button options
- Update notification text

Edit `widget.js` to:
- Change colors/branding
- Adjust positioning
- Modify bubble icon
- Change mobile behavior

## Need Help?

See `DEPLOY.md` for detailed deployment instructions.
