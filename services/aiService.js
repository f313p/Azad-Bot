// ============================================================
// services/aiService.js
// Generates replies with the OpenAI Responses API.
// ============================================================

const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.ai.openaiApiKey });

const SYSTEM_PROMPT = `
انت "سارة"، مساعدة خدمة الزبائن الافتراضية لشركة [اسم الشركة].
مهمتك تساعد الزبائن بأسئلتهم وطلباتهم بأسلوب ودود، مرتب، ومحترف.

القاعدة الأهم: جاوب باللهجة العراقية الدارجة المحكية، مو بالفصحى ولا
بلهجة خليجية أو شامية أو مصرية، إلا إذا احتاجت كلمة فصحى حتى يكون الرد واضح.

أسلوبك:
- خلي الرد قصير ومباشر ومناسب لواتساب وماسنجر.
- لا تستخدم Markdown أو عناوين طويلة.
- كون مهذب ومحترف حتى إذا الزبون متضايق.
- افهم أي لغة يكتب بيها الزبون، لكن جاوبه بالعراقي ما لم يطلب لغة ثانية صراحة.
- لا تختلق أسعار أو سياسات أو مواعيد أو معلومات مو موجودة عندك.
- إذا ما تعرف معلومة، وضح إنك تحتاج تتأكد أو تحول الطلب لموظف بشري.
- لا تطلب كلمات مرور أو أرقام بطاقات كاملة أو معلومات حساسة.
- إذا الطلب يحتاج تدخل بشري، وضح هذا للزبون بشكل طبيعي.
- اسمك "سارة" كمساعدة افتراضية، ولا تدعي إنك إنسان حقيقي إذا انسألت.

هدفك: الزبون يحس أنه يحچي ويا خدمة زبائن عراقية مفهومة، سريعة ومحترفة.
`.trim();

// Short in-memory history. It resets when Render restarts and is not shared
// between multiple server instances. Good for this deployment; use Redis/DB
// later if persistent memory is needed.
const conversationHistory = new Map();

function getHistory(userKey) {
  if (!conversationHistory.has(userKey)) {
    conversationHistory.set(userKey, []);
  }
  return conversationHistory.get(userKey);
}

function appendToHistory(userKey, role, content) {
  const history = getHistory(userKey);
  history.push({ role, content });

  const max = config.ai.maxHistoryMessages;
  if (history.length > max) {
    history.splice(0, history.length - max);
  }
}

async function generateReply(userKey, userMessage) {
  appendToHistory(userKey, 'user', userMessage);

  try {
    const response = await openai.responses.create({
      model: config.ai.model,
      instructions: SYSTEM_PROMPT,
      input: getHistory(userKey).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      max_output_tokens: config.ai.maxOutputTokens,
    });

    const reply = String(response.output_text || '').trim();
    if (!reply) {
      throw new Error('OpenAI returned an empty text response.');
    }

    appendToHistory(userKey, 'assistant', reply);
    return reply;
  } catch (err) {
    const requestId = err?.request_id ? ` request_id=${err.request_id}` : '';
    console.error(`[aiService] OpenAI API call failed:${requestId}`, err?.message || err);

    // Remove the failed user turn so it does not pollute the next request.
    const history = getHistory(userKey);
    if (history.at(-1)?.role === 'user' && history.at(-1)?.content === userMessage) {
      history.pop();
    }

    return 'سوري، صار عندنا خلل تقني بسيط. جرّب ترسل رسالتك مرة ثانية بعد شوي 🙏';
  }
}

module.exports = { generateReply };
