// ============================================================
// handlers/webhookHandler.js
// Parses the two different payload shapes Meta sends
// (WhatsApp Cloud API vs Messenger Send/Receive API), pulls out
// the sender id + text, asks the AI service for a reply, and
// sends that reply back through the right channel.
// ============================================================

const aiService = require('../services/aiService');
const metaService = require('../services/metaService');

/**
 * Entry point called from the webhook route for every POST body
 * Meta sends us. `body.object` tells us whether this is a
 * WhatsApp update or a Messenger/Page update.
 */
async function processWebhookEvent(body) {
  if (body.object === 'whatsapp_business_account') {
    await handleWhatsAppPayload(body);
  } else if (body.object === 'page') {
    await handleMessengerPayload(body);
  } else {
    console.log('[webhookHandler] Ignoring unknown webhook object type:', body.object);
  }
}

// ------------------------------------------------------------
// WhatsApp Cloud API
// ------------------------------------------------------------
async function handleWhatsAppPayload(body) {
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      // `value.statuses` = delivery/read receipts for messages WE sent.
      // We don't need to reply to those, just skip them.
      if (value.statuses) {
        continue;
      }

      for (const message of value.messages || []) {
        // Only handle plain text messages in this starter project.
        // Extend here for message.type === 'image' | 'audio' | 'document' etc.
        if (message.type !== 'text') {
          console.log(`[webhookHandler] Skipping unsupported WhatsApp message type: ${message.type}`);
          continue;
        }

        const fromWaId = message.from; // e.g. "9647XXXXXXXX"
        const text = message.text.body;

        console.log(`[WhatsApp] ${fromWaId}: ${text}`);

        // Fire-and-forget style processing so the webhook route can
        // ack Meta immediately (see routes/webhook.js). Errors are
        // caught and logged, never thrown back into Meta's request.
        markAndReplyWhatsApp(fromWaId, message.id, text).catch((err) =>
          console.error('[webhookHandler] WhatsApp handling failed:', err)
        );
      }
    }
  }
}

async function markAndReplyWhatsApp(fromWaId, messageId, text) {
  await metaService.markWhatsAppMessageAsRead(messageId);
  const reply = await aiService.generateReply(fromWaId, text);
  await metaService.sendWhatsAppMessage(fromWaId, reply);
}

// ------------------------------------------------------------
// Messenger (Facebook Page) API
// ------------------------------------------------------------
async function handleMessengerPayload(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      // Skip delivery receipts, read receipts, postback-only events
      // without a text message, and echoes of our own sent messages.
      if (!event.message || event.message.is_echo) {
        continue;
      }

      const senderPsid = event.sender.id;
      const text = event.message.text;

      if (!text) {
        console.log('[webhookHandler] Skipping non-text Messenger message (attachment, sticker, etc.)');
        continue;
      }

      console.log(`[Messenger] ${senderPsid}: ${text}`);

      replyMessenger(senderPsid, text).catch((err) =>
        console.error('[webhookHandler] Messenger handling failed:', err)
      );
    }
  }
}

async function replyMessenger(senderPsid, text) {
  await metaService.sendMessengerTypingOn(senderPsid);
  const reply = await aiService.generateReply(senderPsid, text);
  await metaService.sendMessengerMessage(senderPsid, reply);
}

module.exports = { processWebhookEvent };
