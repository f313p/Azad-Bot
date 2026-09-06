// ============================================================
// routes/webhook.js
// The two endpoints Meta talks to:
//   GET  /webhook  -> one-time verification handshake
//   POST /webhook   -> real-time event notifications (both
//                      WhatsApp and Messenger send events here,
//                      Meta just tells them apart by body.object)
// ============================================================

const express = require('express');
const router = express.Router();

const config = require('../config');
const { processWebhookEvent } = require('../handlers/webhookHandler');
const verifyMetaSignature = require('../middleware/verifySignature');

// ------------------------------------------------------------
// GET /webhook — Meta's webhook verification handshake.
// When you click "Verify and Save" in the App Dashboard, Meta
// sends a GET request with these three query params. We must
// check that the verify token matches what we configured, and
// if so, echo back the "hub.challenge" value as plain text.
// ------------------------------------------------------------
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.verifyToken) {
    console.log('[webhook] Verification succeeded.');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook] Verification failed. Check META_VERIFY_TOKEN matches the dashboard.');
  return res.sendStatus(403);
});

// ------------------------------------------------------------
// POST /webhook — actual incoming messages/events.
//
// IMPORTANT: Meta expects a 200 response within a few seconds,
// otherwise it will consider the delivery failed and retry
// (which can cause duplicate replies). So we respond 200
// immediately and then process the event + call the AI + call
// the Graph API afterwards, asynchronously.
// ------------------------------------------------------------
router.post('/', verifyMetaSignature, (req, res) => {
  // Ack Meta right away.
  res.sendStatus(200);

  // Process in the background. Any error is caught and logged
  // inside processWebhookEvent's callees — this route itself
  // never throws after responding.
  processWebhookEvent(req.body).catch((err) => {
    console.error('[webhook] Unhandled error while processing event:', err);
  });
});

module.exports = router;
