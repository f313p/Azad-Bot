# WhatsApp + Messenger AI Customer Service Bot

A single Node.js/Express server that answers customers on **WhatsApp** and
**Facebook Messenger**, powered by the **Claude API**, replying exclusively
in the **Iraqi Arabic dialect** (اللهجة العراقية).

Both channels share one webhook endpoint, one AI brain, and one codebase.

---

## 1. How it all fits together

```
WhatsApp user ─┐
                ├─► Meta Graph API ─► POST /webhook ─► Express server ─► Claude API
Messenger user ─┘                                            │
                                                              └─► Graph API "send message" ─► back to user
```

- `server.js` — starts Express, mounts the webhook route.
- `routes/webhook.js` — `GET /webhook` (Meta's verification handshake) and
  `POST /webhook` (real events from both WhatsApp and Messenger).
- `middleware/verifySignature.js` — checks Meta's request signature.
- `handlers/webhookHandler.js` — figures out if a payload is WhatsApp or
  Messenger, extracts the sender + text.
- `services/aiService.js` — calls Claude with the Iraqi-dialect system
  prompt and keeps a short rolling memory per user.
- `services/metaService.js` — sends replies back via the Graph API.
- `config/index.js` — loads and validates everything from `.env`.

---

## 2. Prerequisites

- Node.js 18+ and npm installed.
- A Meta (Facebook) developer account: https://developers.facebook.com
- A Facebook Page (required for both Messenger and as the parent of your
  WhatsApp Business Account).
- An Anthropic API key: https://console.anthropic.com
- (For local testing) `ngrok` or a similar tunneling tool, since Meta needs
  a public HTTPS URL to send webhooks to — `https://ngrok.com`

---

## 3. Meta App Setup (step by step)

### 3.1 Create the app

1. Go to https://developers.facebook.com/apps and click **Create App**.
2. Choose the **Business** app type.
3. Give it a name (e.g. "My Store Support Bot") and create it.

### 3.2 Add the WhatsApp product

1. In your app's dashboard, find **WhatsApp** in the left sidebar under
   "Add Products" and click **Set Up**.
2. Meta will create (or ask you to attach) a **WhatsApp Business Account**
   and give you a **free test phone number** for development.
3. Under **WhatsApp -> API Setup** you'll see:
   - A **temporary access token** (valid ~24h — good for testing; you'll
     switch to a permanent token before going live, see 3.5).
   - Your **Phone number ID** → copy this into `WHATSAPP_PHONE_NUMBER_ID`.
4. Under the same page, add your own phone number as a **recipient test
   number** so Meta will actually deliver messages to you while in
   development mode.

### 3.3 Add the Messenger product

1. In "Add Products", click **Set Up** under **Messenger**.
2. Under **Messenger -> API Setup**, connect the Facebook Page you want the
   bot to reply as.
3. Generate a **Page Access Token** for that page → copy it into
   `MESSENGER_PAGE_ACCESS_TOKEN` (or reuse the same token as
   `META_ACCESS_TOKEN` if Meta gives you one combined token with both
   permissions).

### 3.4 Configure the Webhook (used by both products)

1. Deploy the app first (see Section 5) OR start it locally with `ngrok`
   so you have a public HTTPS URL, e.g. `https://abcd1234.ngrok.app`.
2. In the app dashboard, go to **WhatsApp -> Configuration** (and
   separately **Messenger -> Settings**, "Webhooks" section) and click
   **Edit** on the Callback URL.
3. Fill in:
   - **Callback URL**: `https://<your-domain>/webhook`
   - **Verify Token**: any string you invent — just make sure it's the
     exact same value as `META_VERIFY_TOKEN` in your `.env`.
4. Click **Verify and Save**. Meta will send a `GET /webhook` request; if
   your server is running and the token matches, this succeeds instantly
   (see `routes/webhook.js` for the handshake code).
5. Subscribe to fields:
   - WhatsApp: subscribe to **messages**.
   - Messenger: subscribe to **messages** and **messaging_postbacks**.

### 3.5 Get a permanent access token (before going live)

Temporary tokens expire after ~24 hours. For production:

1. Go to **Meta Business Settings -> Users -> System Users**.
2. Create a System User, assign it to your app and your WhatsApp Business
   Account / Page with **full control**.
3. Generate a token for that System User with the permissions
   `whatsapp_business_messaging`, `whatsapp_business_management`, and
   `pages_messaging`. This token doesn't expire on its own.
4. Put it in `META_ACCESS_TOKEN` (and `MESSENGER_PAGE_ACCESS_TOKEN` if
   different).

### 3.6 App Review (production requirement)

While your app is in **Development Mode**, it only works for people added
as testers/admins in the dashboard. To message any customer, submit for
**App Review** and request the `whatsapp_business_messaging` and
`pages_messaging` permissions, with a short screen-recording showing the
bot working. This is a Meta requirement, not something the code needs to
handle.

### 3.7 Get your App Secret (recommended)

Go to **App Dashboard -> Settings -> Basic**, reveal the **App Secret**,
and put it in `META_APP_SECRET`. This lets the server verify that incoming
webhook requests genuinely came from Meta (see `middleware/verifySignature.js`).

---

## 4. Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your real values
cp .env.example .env

# 3. Start the server
npm start
# or, for auto-restart on file changes during development:
npm run dev
```

To let Meta reach your local server, open a tunnel in another terminal:

```bash
ngrok http 3000
```

Copy the `https://....ngrok.app` URL it prints and use
`https://....ngrok.app/webhook` as the Callback URL in Section 3.4. Note
that the free ngrok URL changes every time you restart it, so you'll need
to re-verify the webhook after each restart (or use a paid ngrok static
domain, or just deploy — see Section 5).

### Testing

- Send a WhatsApp message to your test number from the phone you added as
  a tester in Section 3.2 — you should get an Iraqi-dialect reply within a
  couple seconds.
- Message your Facebook Page (as an admin/tester of the app) to test
  Messenger the same way.
- Watch your terminal logs — every incoming message and any errors are
  logged with a `[WhatsApp]`, `[Messenger]`, or `[aiService]` prefix.

---

## 5. Deployment

Any Node-friendly host works; two beginner-friendly, low-cost options:

### Option A — Render (recommended for simplicity)

1. Push this project to a GitHub repository.
2. On https://render.com, click **New -> Web Service**, connect the repo.
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance type**: the Free tier works for testing (it sleeps after
     inactivity, which adds a few seconds' delay to the first message
     after idle — upgrade to a paid instance to avoid that for real users).
4. Under **Environment**, add every variable from your `.env` file.
5. Deploy. Render gives you a permanent URL like
   `https://your-app.onrender.com` — use
   `https://your-app.onrender.com/webhook` as the Callback URL in Meta.

### Option B — Railway

1. Push the project to GitHub.
2. On https://railway.app, click **New Project -> Deploy from GitHub repo**.
3. Railway auto-detects Node and runs `npm install && npm start`.
4. Add the same environment variables under the **Variables** tab.
5. Under **Settings -> Networking**, generate a public domain, then use
   `https://<that-domain>/webhook` as the Callback URL in Meta.

Either way, **the webhook URL never expires** once deployed (unlike ngrok),
so you only configure it in Meta once.

### Managing secrets

- Never commit `.env` — it's already in `.gitignore`.
- Set the real values only in your host's "Environment Variables" panel.
- Rotate `META_ACCESS_TOKEN` and `ANTHROPIC_API_KEY` immediately if they
  ever leak (e.g. committed by accident), from the Meta dashboard and the
  Anthropic console respectively.

---

## 6. Customizing the bot

- Edit the `SYSTEM_PROMPT` constant in `services/aiService.js`:
  - Replace `[اسم الشركة]` with your real business name.
  - Add real details: working hours, return policy, shipping times,
    price ranges — whatever you want the bot to know and say accurately.
    The prompt already instructs Claude to never invent facts it wasn't
    given, so give it real ones here.
- Swap `CLAUDE_MODEL` in `.env` for a faster/cheaper or more capable model
  as needed.
- `MAX_HISTORY_MESSAGES` controls how many recent turns are kept per user
  before older ones are dropped, to control cost and prompt size.

---

## 7. Known limitations of this starter

- Conversation history is kept **in memory** (a JS `Map`) — it resets on
  every server restart and doesn't scale across multiple server instances.
  For production with real traffic, swap it for Redis or a database table
  keyed by user id.
- Only plain **text** messages are handled. Images, voice notes, location
  shares, and Messenger quick-reply/postback payloads are logged and
  skipped — extend `handlers/webhookHandler.js` to support them.
- WhatsApp's **24-hour customer service window**: you can only send free-
  form replies within 24 hours of the customer's last message. Outside
  that window, WhatsApp requires a pre-approved **message template** — this
  is a WhatsApp platform rule, not something this code can bypass.

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Webhook verification fails (403) | `META_VERIFY_TOKEN` in `.env` doesn't exactly match what you typed in the Meta dashboard field. |
| Bot doesn't receive messages | Field subscriptions (Section 3.4 step 5) aren't enabled, or your phone isn't added as a tester (development mode). |
| Bot receives messages but never replies | Check server logs for `[metaService]` errors — usually an expired temporary token (Section 3.5) or wrong phone number ID. |
| `Missing required environment variable` on startup | You haven't created `.env` from `.env.example`, or left a value blank. |
| 401 on POST /webhook | `META_APP_SECRET` is set but doesn't match the app's real App Secret — copy it again from Settings -> Basic. |
