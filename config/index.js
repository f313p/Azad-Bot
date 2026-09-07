// ============================================================
// config/index.js
// Loads environment variables and exposes one validated config object.
// ============================================================

require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable "${name}".`);
  }
  return String(value).trim();
}

function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const config = {
  port: positiveInt('PORT', 3000),

  meta: {
    verifyToken: required('META_VERIFY_TOKEN'),

    // WhatsApp Cloud API token.
    accessToken: required('META_ACCESS_TOKEN'),
    whatsappPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),

    // Messenger must use its Page Access Token. Keeping it separate avoids
    // accidentally using the WhatsApp token for Facebook Page replies.
    messengerPageAccessToken: required('MESSENGER_PAGE_ACCESS_TOKEN'),

    // Override this in Render whenever you want to move to a newer Graph API version.
    graphApiVersion: process.env.GRAPH_API_VERSION || 'v21.0',

    // Optional during initial setup, strongly recommended in production.
    appSecret: process.env.META_APP_SECRET?.trim() || null,
  },

  ai: {
    openaiApiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    maxHistoryMessages: positiveInt('MAX_HISTORY_MESSAGES', 10),
    maxOutputTokens: positiveInt('OPENAI_MAX_OUTPUT_TOKENS', 500),
  },
};

module.exports = config;
