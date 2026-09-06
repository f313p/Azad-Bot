// ============================================================
// config/index.js
// Loads environment variables from .env and exposes them as a
// single, validated config object used across the whole app.
// ============================================================

require('dotenv').config();

// Small helper: throws a clear error at startup if a required
// env var is missing, instead of failing confusingly later on.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
      `Did you copy .env.example to .env and fill it in?`
    );
  }
  return value;
}

const config = {
  port: process.env.PORT || 3000,

  meta: {
    verifyToken: required('META_VERIFY_TOKEN'),
    accessToken: required('META_ACCESS_TOKEN'),
    whatsappPhoneNumberId: required('WHATSAPP_PHONE_NUMBER_ID'),
    messengerPageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN || required('META_ACCESS_TOKEN'),
    graphApiVersion: process.env.GRAPH_API_VERSION || 'v21.0',
    // Optional but STRONGLY recommended for production: the app's
    // "App Secret" (Meta App Dashboard -> Settings -> Basic). When
    // set, incoming webhook POSTs are cryptographically verified so
    // nobody can spoof requests to your /webhook endpoint.
    appSecret: process.env.META_APP_SECRET || null,
  },

  ai: {
    anthropicApiKey: required('ANTHROPIC_API_KEY'),
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES || '10', 10),
  },
};

module.exports = config;
