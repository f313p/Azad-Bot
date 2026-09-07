// ============================================================
// handlers/webhookHandler.js
// Parses WhatsApp/Messenger webhook payloads and routes messages.
// ============================================================

const aiService = require('../services/aiService');
const metaService = require('../services/metaService');

// Meta can retry webhook deliveries. Keep a short-lived in-memory set so the
// same message does not produce duplicate AI replies during normal retries.
const processedEventIds = new Map();
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function alreadyProcessed(id) {
  if (!id) return false;
  const now = Date.now();

  for (const [key, timestamp] of processedEventIds) {
    if (now - timestamp > DEDUPE_TTL_MS) processedEventIds.delete(key);
  }

  if (processedEventIds.has(id)) return true;
  processedEventIds.set(id, now);
  return false;
}

async function processWebhookEvent(body) {
  if (!body || typeof body !== 'object') return;

  if (body.object === 'whatsapp_business_account') {
    await handleWhatsAppPayload(body);
  } else if (body.object === 'page') {
    await handleMessengerPayload(body);
  } else {
    console.log('[webhookHandler] Ignoring unknown webhook object type:', body.object);
  }
}

async function handleWhatsAppPayload(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      // Delivery/read status notifications are not customer messages.
      if (Array.isArray(value.statuses) && value.statuses.length > 0) continue;

      for (const message of value.messages || []) {
        if (alreadyProcessed(`wa:${message.id}`)) continue;

        if (message.type !== 'text' || !message.text?.body) {
          console.log(`[webhookHandler] Skipping unsupported WhatsApp message type: ${message.type}`);
          continue;
        }

        const fromWaId = message.from;
        const text = message.text.body.trim();
        if (!fromWaId || !text) continue;

        console.log(`[WhatsApp] ${fromWaId}: ${text}`);

        markAndReplyWhatsApp(fromWaId, message.id, text).catch((err) =>
          console.error('[webhookHandler] WhatsApp handling failed:', err?.message || err)
        );
      }
    }
  }
}

async function markAndReplyWhatsApp(fromWaId, messageId, text) {
  await metaService.markWhatsAppMessageAsRead(messageId);
  const reply = await aiService.generateReply(`wa:${fromWaId}`, text);
  await metaService.sendWhatsAppMessage(fromWaId, reply);
}

async function handleMessengerPayload(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderPsid = event.sender?.id;
      const text = event.message.text?.trim();
      const eventId = event.message.mid || `${entry.id || 'page'}:${event.timestamp || ''}:${senderPsid || ''}`;

      if (alreadyProcessed(`messenger:${eventId}`)) continue;

      if (!senderPsid || !text) {
        console.log('[webhookHandler] Skipping non-text Messenger message.');
        continue;
      }

      console.log(`[Messenger] ${senderPsid}: ${text}`);

      replyMessenger(senderPsid, text).catch((err) =>
        console.error('[webhookHandler] Messenger handling failed:', err?.message || err)
      );
    }
  }
}

async function replyMessenger(senderPsid, text) {
  await metaService.sendMessengerTypingOn(senderPsid);
  const reply = await aiService.generateReply(`messenger:${senderPsid}`, text);
  await metaService.sendMessengerMessage(senderPsid, reply);
}

module.exports = { processWebhookEvent };
