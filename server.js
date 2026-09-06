// ============================================================
// server.js
// Entry point: sets up the Express app and mounts the webhook
// routes that both WhatsApp and Messenger send events to.
// ============================================================

const express = require('express');

const config = require('./config');
const webhookRouter = require('./routes/webhook');

const app = express();

// Meta sends JSON payloads; make sure we can parse them. We also
// stash the raw request body on req.rawBody, because verifying
// Meta's webhook signature (see middleware/verifySignature.js)
// requires hashing the EXACT bytes that were sent, not the
// re-serialized JSON object.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Simple health check — useful for confirming the deploy is alive,
// and some hosting platforms (Render, Railway) ping this automatically.
app.get('/', (req, res) => {
  res.send('WhatsApp/Messenger AI bot is running.');
});

// Both WhatsApp and Messenger webhook calls arrive at the SAME
// callback URL you configure once in the Meta App Dashboard
// (e.g. https://your-app.onrender.com/webhook).
app.use('/webhook', webhookRouter);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
  console.log(`Webhook callback URL to configure in Meta: https://<your-domain>/webhook`);
});
