// ============================================================
// middleware/verifySignature.js
// Verifies the "X-Hub-Signature-256" header Meta sends on every
// webhook POST, proving the request really came from Meta and
// wasn't forged by someone who guessed your /webhook URL.
//
// Requires config.meta.appSecret to be set (META_APP_SECRET in
// .env, found in Meta App Dashboard -> Settings -> Basic -> App
// Secret). If it's not set, verification is skipped with a
// warning — fine for quick local testing, NOT fine for production.
// ============================================================

const crypto = require('crypto');
const config = require('../config');

function verifyMetaSignature(req, res, next) {
  if (!config.meta.appSecret) {
    console.warn(
      '[verifySignature] META_APP_SECRET is not set — skipping signature verification. ' +
      'Set it before going to production!'
    );
    return next();
  }

  const signatureHeader = req.get('x-hub-signature-256'); // "sha256=<hex>"
  if (!signatureHeader || !req.rawBody) {
    console.warn('[verifySignature] Missing signature header or raw body — rejecting request.');
    return res.sendStatus(401);
  }

  const expectedSignature =
    'sha256=' +
    crypto.createHmac('sha256', config.meta.appSecret).update(req.rawBody).digest('hex');

  const provided = Buffer.from(signatureHeader);
  const expected = Buffer.from(expectedSignature);

  const isValid =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!isValid) {
    console.warn('[verifySignature] Invalid signature — rejecting request.');
    return res.sendStatus(401);
  }

  next();
}

module.exports = verifyMetaSignature;
