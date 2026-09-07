# Azad Bot — WhatsApp + Messenger + OpenAI

Node.js/Express bot that receives customer messages from Meta webhooks for WhatsApp Cloud API and Facebook Messenger, generates an Iraqi-Arabic customer-service reply with OpenAI, and sends the reply back through the matching Meta channel.

## Project structure

- `server.js` — Express entry point and health check.
- `routes/webhook.js` — Meta GET verification + POST webhook endpoint.
- `middleware/verifySignature.js` — optional Meta App Secret signature verification.
- `handlers/webhookHandler.js` — parses WhatsApp/Messenger events, ignores duplicates and non-text events.
- `services/aiService.js` — OpenAI Responses API and short per-user conversation history.
- `services/metaService.js` — sends WhatsApp and Messenger replies through Graph API.
- `config/index.js` — validates environment variables.

## Required environment variables

Set these in Render -> Environment. Do not upload a real `.env` file to GitHub.

```env
META_VERIFY_TOKEN=your_verify_token
META_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
MESSENGER_PAGE_ACCESS_TOKEN=your_messenger_page_access_token
OPENAI_API_KEY=your_openai_api_key
```

Optional/recommended:

```env
GRAPH_API_VERSION=v21.0
META_APP_SECRET=your_meta_app_secret
OPENAI_MODEL=gpt-5.6-luna
OPENAI_MAX_OUTPUT_TOKENS=500
MAX_HISTORY_MESSAGES=10
```

`META_ACCESS_TOKEN` is the WhatsApp token. `MESSENGER_PAGE_ACCESS_TOKEN` is deliberately separate so the project does not accidentally use the WhatsApp token to answer Messenger.

## Render

- Root Directory: blank (when these files are at the repository root)
- Build Command: `npm install`
- Start Command: `npm start`
- Node: 22 or newer

After a successful deploy, opening the Render service URL should show:

`WhatsApp/Messenger AI bot is running.`

The Meta callback endpoint is:

`https://YOUR-RENDER-SERVICE.onrender.com/webhook`

Use the exact same value from `META_VERIFY_TOKEN` in Meta's Verify Token field.

## Local checks

```bash
npm install
npm run check
npm start
```

The bot stores short chat history in memory. That history resets whenever Render restarts. For durable memory later, replace the in-memory map with Redis/Postgres or another persistent store.

## Security

- Never commit `.env` or API/access tokens to GitHub.
- If a token is shown in a screenshot or committed accidentally, rotate it.
- Set `META_APP_SECRET` before production so webhook POST signatures are verified.
