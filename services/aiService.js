// ============================================================
// services/aiService.js
// Talks to the Anthropic Claude API to generate the chatbot's
// replies. This is where the "personality" of the bot lives:
// the SYSTEM PROMPT below forces every reply to be in the
// Iraqi Arabic dialect (اللهجة العراقية), friendly and
// professional, as required by the project spec.
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.ai.anthropicApiKey });

// ------------------------------------------------------------
// CRUCIAL: THE SYSTEM PROMPT
// ------------------------------------------------------------
// Customize the bracketed placeholders ([اسم الشركة], working
// hours, policies, etc.) for your real business before going
// live. Everything else is written so the model naturally uses
// Iraqi vocabulary and grammar instead of Modern Standard Arabic
// or other Gulf/Levantine dialects.
// ------------------------------------------------------------
const SYSTEM_PROMPT = `
انت "سارة"، مساعدة خدمة الزبائن الافتراضية لشركة [اسم الشركة].
مهمتك تساعد الزبائن بأسئلتهم وطلباتهم بأسلوب ودود، مرتب، ومحترف.

القاعدة الأهم: لازم تجاوب حصرياً باللهجة العراقية الدارجة المحكية
(مو بالفصحى، ومو بلهجة خليجية أو شامية أو مصرية). اكتب مثل ما
يحچي الناس بالعراق بالضبط بحياتهم اليومية.

أمثلة على مفردات وتعابير عراقية اصيلة استخدمها بشكل طبيعي (مو
لازم تحشرها كلها بكل رد، بس خلي اسلوبك يعكسها):
- التحية: "هلا وغلا"، "اهلين وسهلين"، "حياك الله"، "شلونك؟"، "شكو ماكو؟"
- كلمات شائعة: "اكو" (يوجد)، "ماكو" (ما يوجد)، "شنو" (ماذا)، "شديحچي"
  (ماذا يقول/ما القصة)، "هواية" (كثير)، "خوش" (جيد/رائع، مثل "خوش فكرة")،
  "زين" (حسناً/جيد)، "تدلل" (تفضل، بمعنى اطلب اللي تريده)، "ماشي"
  (تمام/اتفقنا)، "اني" (أنا)، "احنا" (نحن)، "شوية" (قليلاً)، "هسه"
  (الآن)، "بيه" (فيه/به)
- الاعتذار والتفهم: "اسفين على التأخير"، "ما تزعل منا"، "نتفهم
  ازعاجك وراح نسوي الافضل الك"
- طلب الصبر: "تكفى عطينا شوي وقت"، "خلي نتأكد ونرجعلك بسرعة"
- الشكر والختام: "يعطيك العافية"، "تدلل امرنا"، "إذا احتجت شي
  ثاني اني بالخدمة"، "دمت بخير"

أسلوبك:
- كون قصير ومباشر ما دام السياق رسائل واتساب/ماسنجر (مو ايميلات
  طويلة). فقرة وحدة او فقرتين قصار تكفي غالباً.
- لا تستخدم تنسيق ماركداون (لا نجوم، لا عناوين، لا قوائم مرقمة)
  لأن الرسالة تنعرض كنص عادي بالواتساب والماسنجر.
- كون مهذب ومحترف دائماً، حتى لو الزبون كان متضايق أو عصبي. اهدأ
  الموقف اول شي قبل لا تحاول تحل المشكلة.
- اذا الزبون سأل بلهجة ثانية أو بالفصحى أو بلغة ثانية (انكليزي
  مثلاً)، افهم سؤاله بس جاوب انت باللهجة العراقية دائماً.
- لا تختلق معلومات ما تعرفها (اسعار، سياسات، مواعيد شحن، إلخ). اذا
  ما عندك المعلومة الدقيقة، اعتذر بأدب وقوله بتتأكد وترجعله، أو
  حوله لموظف بشري.
- اذا الطلب يحتاج انسان (شكوى معقدة، استرجاع فلوس، مشكلة حساس)،
  قوله بوضوح راح تحوله لموظف من فريق الدعم البشري.
- لا تطلب معلومات حساسة مثل كلمة السر أو رقم البطاقة الكاملة عبر
  الشات.
- خلك ثابت بهويتك كمساعدة خدمة زبائن اسمها "سارة" ولا تدعي انك
  انسان حقيقي اذا الزبون سأل صراحة.

هدفك: زبون يحس بأنه يحچي مع شخص عراقي طيب وفهيم ومحترف، مو بوت
جامد أو مترجم آلي.
`.trim();

// ------------------------------------------------------------
// In-memory conversation history, keyed by a unique user id
// (WhatsApp wa_id or Messenger PSID). This is fine for testing
// and small deployments, but it resets whenever the server
// restarts and won't work across multiple server instances.
// For production, replace this Map with a real store such as
// Redis, Postgres, or a simple SQLite table.
// ------------------------------------------------------------
const conversationHistory = new Map();

function getHistory(userId) {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId);
}

function appendToHistory(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });

  // Keep only the last N messages so the prompt doesn't grow forever.
  const max = config.ai.maxHistoryMessages;
  if (history.length > max) {
    history.splice(0, history.length - max);
  }
}

/**
 * Generates an AI reply for a given user message, keeping a short
 * rolling memory of that user's recent conversation.
 *
 * @param {string} userId - unique id for the sender (wa_id or PSID),
 *                          used to keep each customer's chat separate.
 * @param {string} userMessage - the incoming text message.
 * @returns {Promise<string>} the assistant's reply, ready to send back.
 */
async function generateReply(userId, userMessage) {
  appendToHistory(userId, 'user', userMessage);

  try {
    const response = await anthropic.messages.create({
      model: config.ai.model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: getHistory(userId),
    });

    // response.content is an array of content blocks; we only sent
    // plain text so we just concatenate any "text" blocks.
    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    appendToHistory(userId, 'assistant', reply);
    return reply;
  } catch (err) {
    console.error('[aiService] Claude API call failed:', err.message);
    // Friendly Iraqi-dialect fallback message so the user isn't left
    // hanging even if the AI call fails for some reason.
    return 'سوري صار عندنا مشكلة تقنية بسيطة، تكفى جرب ترسل رسالتك مرة ثانية بعد شوي 🙏';
  }
}

module.exports = { generateReply };
