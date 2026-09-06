// ============================================================
// services/metaService.js
// Everything related to talking BACK to Meta's Graph API:
// sending WhatsApp messages and Messenger messages.
// ============================================================

const axios = require('axios');
const config = require('../config');

const GRAPH_BASE = `https://graph.facebook.com/${config.meta.graphApiVersion}`;

/**
 * Send a plain text message to a WhatsApp user via the
 * WhatsApp Cloud API.
 *
 * @param {string} toWaId - the user's WhatsApp ID / phone number
 *                          (comes from the incoming webhook payload).
 * @param {string} text   - the message body to send.
 */
async function sendWhatsAppMessage(toWaId, text) {
  const url = `${GRAPH_BASE}/${config.meta.whatsappPhoneNumberId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWaId,
        type: 'text',
        text: {
          // preview_url: false avoids Meta trying to unfurl links in replies
          preview_url: false,
          body: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    logGraphError('WhatsApp send failed', err);
    throw err;
  }
}

/**
 * Mark an incoming WhatsApp message as "read" (blue ticks).
 * Optional, but makes the bot feel more responsive.
 */
async function markWhatsAppMessageAsRead(messageId) {
  const url = `${GRAPH_BASE}/${config.meta.whatsappPhoneNumberId}/messages`;
  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.meta.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    // Non-critical — just log it, don't crash the bot over a read receipt.
    logGraphError('WhatsApp mark-as-read failed', err);
  }
}

/**
 * Send a plain text message to a Messenger user via the
 * Facebook Send API.
 *
 * @param {string} recipientPsid - the user's Page-Scoped ID (PSID)
 *                                 from the incoming webhook payload.
 * @param {string} text          - the message body to send.
 */
async function sendMessengerMessage(recipientPsid, text) {
  const url = `${GRAPH_BASE}/me/messages`;

  try {
    await axios.post(
      url,
      {
        recipient: { id: recipientPsid },
        message: { text },
        messaging_type: 'RESPONSE',
      },
      {
        params: {
          access_token: config.meta.messengerPageAccessToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    logGraphError('Messenger send failed', err);
    throw err;
  }
}

/**
 * Shows the "..." typing bubble in Messenger while the AI is thinking.
 */
async function sendMessengerTypingOn(recipientPsid) {
  const url = `${GRAPH_BASE}/me/messages`;
  try {
    await axios.post(
      url,
      {
        recipient: { id: recipientPsid },
        sender_action: 'typing_on',
      },
      { params: { access_token: config.meta.messengerPageAccessToken } }
    );
  } catch (err) {
    logGraphError('Messenger typing indicator failed', err);
  }
}

function logGraphError(context, err) {
  const details = err.response ? JSON.stringify(err.response.data) : err.message;
  console.error(`[metaService] ${context}:`, details);
}

module.exports = {
  sendWhatsAppMessage,
  markWhatsAppMessageAsRead,
  sendMessengerMessage,
  sendMessengerTypingOn,
};
