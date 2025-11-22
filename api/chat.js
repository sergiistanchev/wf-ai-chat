// /api/chat.js

import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "redis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load knowledge base
let kb = {};
try {
  kb = JSON.parse(readFileSync(join(__dirname, "..", "knowledge", "koenigswirt_kb.json"), "utf-8"));
} catch (e) {
  console.warn("Could not load koenigswirt_kb.json:", e.message);
}


const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Redis client for usage tracking
let redisClient = null;
async function getRedisClient() {
  const redisUrl = process.env.koenigswirt_REDIS_URL || process.env.wfchat_REDIS_URL || process.env.KV_REST_API_URL;
  if (!redisUrl) return null;
  
  try {
    // If we have a client but it's not open, reset it
    if (redisClient && !redisClient.isOpen) {
      redisClient = null;
    }
    
    if (!redisClient) {
      redisClient = createClient({ 
        url: redisUrl,
        socket: {
          connectTimeout: 2000, // 2 second timeout
          reconnectStrategy: false // Don't auto-reconnect in serverless
        }
      });
      redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err.message);
        // Mark client as unusable
        redisClient = null;
      });
      
      // Add timeout to connection attempt
      const connectPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
    }
    
    // Verify connection is still open before returning
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    } else {
      redisClient = null;
      return null;
    }
  } catch (e) {
    console.warn("Redis connection failed:", e.message);
    redisClient = null; // Reset on failure
    return null;
  }
}

// --- Usage limiting helpers (daily cap) ---
// seconds until midnight in Europe/Berlin
function secondsTillMidnightBerlin() {
  const now = new Date();
  // Build a date in Berlin time for 23:59:59
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(now).reduce((acc,p)=>{acc[p.type]=p.value; return acc;}, {});
  const berlinEnd = new Date(`${parts.year}-${parts.month}-${parts.day}T23:59:59+01:00`);
  const seconds = Math.max(1, Math.floor((berlinEnd - now) / 1000));
  return seconds;
}

function limitMessage(lang="de", limit=25) {
  const de = `Ich habe mein Bestes gegeben – für heute ist Schluss nach ${limit} Nachrichten 😅
Schreib dem Team am besten eine E-Mail an **info@koenigswirt-th.de** – oder noch besser: komm vorbei, ich geh' jetzt **ein richtig gutes Bier** im Königswirt trinken 🍺`;
  const en = `I’ve done my best — that’s ${limit} messages for today 😅
Please email the team at **info@koenigswirt-th.de** — or even better: swing by, I’m off for a **really good beer** at Königswirt 🍺`;
  const ru = `Я постарался на максимум — на сегодня лимит ${limit} сообщений 😅
Напишите команде на **info@koenigswirt-th.de** — а я пойду за **очень хорошим пивом** в Königswirt 🍺`;
  return lang === "en" ? en : lang === "ru" ? ru : de;
}

function softNudge(lang="de") {
  const de = `Kleiner Hinweis: Du näherst dich dem Tageslimit. Für ein finales Angebot bitte das Formular vollständig ausfüllen oder eine Mail an **info@koenigswirt-th.de** senden.`;
  const en = `Heads-up: you’re getting close to today’s limit. For a final quote, please complete the form or email **info@koenigswirt-th.de**.`;
  const ru = `Небольшое напоминание: вы приближаетесь к дневному лимиту. Для финального предложения заполните форму или напишите на **info@koenigswirt-th.de**.`;
  return lang === "en" ? en : lang === "ru" ? ru : de;
}


function detectLang(s = "") {
  if (/[а-яё]/i.test(s)) return "ru";
  if (/[a-z]/i.test(s) && !/[äöüß]/i.test(s)) return "en";
  return "de";
}

// Allow only wedding/venue related topics; block obvious coding/essay/news/etc.
function isWeddingRelated(s = "") {
  const t = (s || "").toLowerCase();

  // broad wedding intents (en/de/ru fragments)
  const weddingRe = /\b(wedding|marry|married|engaged|fianc[eé]|bride|groom|ceremony|reception|banquet|guest|guests|gäste|personen|venue|location|saal|menü|menu|buffet|drink|drinks|getränke|pauschale|dekor|dekoration|dj|musik|foto|fotograf|timeline|ablauf)\b/i;

  // obvious non-wedding requests
  const negative = [
    " code "," javascript "," python "," java "," c++ "," react "," sql ",
    " essay "," aufsatz "," artikel "," blog ",
    " math "," beweis "," integral "," ableitung ",
    " news "," nachrichten "," politik "," aktien "," krypto ",
    " reisen "," flug "," hotel "," wetter "," medizin "," diagnose "," recht "
  ];

  if (t.includes("königswirt")) return true;
  if (weddingRe.test(t)) return true;
  if (negative.some(k => t.includes(k.trim()))) return false;

  // neutral → allow (prevents false refusals on mixed sentences)
  return true;
}

function offTopicReply(lang = "de") {
  const lines = {
    de: `Ich weiß, ich klinge wie der Cousin von ChatGPT – aber ich bin heute nur für **Hochzeitsfragen** da 🎩✨
Lass uns beim Wichtigsten bleiben: eure Feier im Königswirt. Wobei darf ich helfen? (z. B. Menü, Saal, Getränkepauschale, Abläufe)`,
    en: `I know, I *sound* like ChatGPT’s cousin — but today I’m here **only for wedding questions** 🎩✨
Let’s stay focused on your big day at Königswirt. How can I help? (menus, rooms, drink packages, timeline)`,
    ru: `Знаю, звучит как двоюродный брат ChatGPT — но я отвечаю **только на вопросы о свадьбе** 🎩✨
Давайте сосредоточимся на вашем дне в Königswirt. Чем помочь? (меню, зал, напитки, тайминг)`
  };
  return lines[lang] || lines.de;
}

// Simple hint retrieval (optional - KB is already provided in system message)
function retrieveHint(message = "") {
  // Since the full knowledge base is provided in the system message,
  // we don't need to extract specific hints here
  return "";
}

const system = `
You are "Leon", the AI wedding assistant for **Königswirt im Trachtenheim** (not Thierhaupten).
Primary language: German. If the user writes another language, answer in that language. Be concise, friendly, and on-brand.

WORKFLOW - Act as a helpful guide:

**Step 1: Answer Questions First, Then Collect Information**
- **ALWAYS answer wedding/celebration questions first** - never interrupt a question to ask for name/email/guests.
- If the user asks about services, menus, prices, rooms, etc., provide a complete, helpful answer from the knowledge base.
- **After answering their question**, if name/email/guests are missing, politely ask for them naturally at the end of your response.
- Example flow:
  - User: "Welche Dienstleistungen bieten Sie an?"
  - You: [Answer about services] "... Übrigens, um euch noch besser helfen zu können, darf ich euren Namen erfahren?"
- If the user hasn't asked a question yet (just greeting), then you can ask for name first.
- Make it feel like a natural conversation, not an interrogation.

**Step 2: When Profile is Complete (Name + Email + Guests)**
- Acknowledge enthusiastically: "Super, [Name]! Ich sehe, dass ihr mit [X] Gästen plant – das wird fantastisch! 🎉"
- Immediately provide personalized recommendations based on guest count:
  - Suggest appropriate menus from the knowledge base (mention 2-3 options with prices)
  - Recommend drink packages based on guest count
  - Mention relevant venue capacities (which rooms would work)
- Then say: "Um ein finales Angebot zu bekommen, füllt bitte alle weiteren Informationen im Formular aus und sendet es an unser Team (info@koenigswirt-th.de)."

**Step 3: Always Mention Partner Recommendations (Photographer, Music)**
- After providing menu/drink recommendations, add helpful tips:
  "Vergesst nicht an Fotografen und Musik zu denken! Wir haben tolle Partnerempfehlungen: https://www.klosterwirt-th.de/dienstleistung – dort findet ihr professionelle Bands, Trauredner, Brautmode, Styling, Fotografen und Deko-Services."

HARD SCOPE LIMIT:
- You only answer questions about weddings/events at Königswirt: rooms, capacities, prices, menus, buffets, drinks, timelines, decor, logistics, policies, offers, children's pricing, etc.
- If the user asks for anything outside of weddings (e.g., coding help, school essays, news, general trivia), politely decline with a warm, humorous nudge back to wedding topics.
  Example tone (DE): "Ich weiß, ich klinge wie ChatGPTs Cousin – aber heute dreht sich alles um euren großen Tag. Welche Hochzeitsfrage darf ich klären?"
- Never invent facts beyond the provided knowledge base.

Knowledge policy:
- Use ONLY the provided Königswirt knowledge base (prices, capacities, policies).
- If the user asks about rooms that do not exist here (e.g., Jagdzimmer, Herzog-Tassilo-Schänke/Saal), say those belong to a different venue and present the correct Königswirt options instead.
- Don't confirm availability; ask for event date and approximate guest count.
- Show prices with € and mention if prices are per person, per hour, or flat.
- Children pricing: 0–4 gratis, 5–10 halber Preis, ab 11 normal.
- After midnight: +200 €/Stunde. Energy/cleaning flat: 300 €.
- Don't promise anything that is not in the knowledge base.
- If the user asks about a specific question, answer it directly from the knowledge base.
- Always encourage filling the entire form and sending it to the team via email (info@koenigswirt-th.de).

Personalization:
- If a name is provided in the profile, use it naturally in your responses.
- If guests count is provided, tailor ALL suggestions (menus, buffets, beverage packages, venue selection) to that size.
- If profile is complete (name + email + guests), follow Step 2 above.

If unsure or if a detail is missing from the knowledge base, clearly say so and suggest contacting the team via email (info@koenigswirt-th.de).
`.trim();

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });



  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
    }

    const { message, history = [], profile = {}, session_id } = req.body || {};

    const { name, email, guests } = profile;

    if (!message) return res.status(400).json({ error: "Missing message" });

    // --- Daily usage cap (per session/email/ip) ---
    const limit = Number(process.env.DAILY_LIMIT || 25);
    const nudgeAt = Number(process.env.SOFT_NUDGE_AT || 15);

    const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim();
    const userKey = (email && `email:${email}`) || (session_id && `session:${session_id}`) || (ip && `ip:${ip}`) || "anon";
    const day = new Date().toISOString().slice(0,10); // YYYY-MM-DD UTC bucket
    const kvKey = `usage:${userKey}:${day}`;

    let count = 0;
    try {
      const redis = await getRedisClient();
      if (redis && redis.isOpen) {
        // Add timeout to Redis operations as well
        const incrPromise = redis.incr(kvKey);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Redis operation timeout")), 1000)
        );
        count = await Promise.race([incrPromise, timeoutPromise]);
        
        if (count === 1) {
          const expirePromise = redis.expire(kvKey, secondsTillMidnightBerlin());
          await Promise.race([expirePromise, timeoutPromise]).catch(() => {
            // Ignore expire timeout - not critical
          });
        }
      }
    } catch (e) {
      console.warn("Redis operation failed:", e.message);
      // Continue without usage tracking if Redis fails
      count = 0;
    }

    // Hard limit: stop here with a friendly beer message
    if (count > limit) {
      const langHard = detectLang(message || "");
      return res.status(200).json({ ok: true, reply: limitMessage(langHard, limit) });
    }

    // Soft nudge flag (will be appended to the model reply)
    let nudgeText = "";
    if (count === nudgeAt) {
      const langSoft = detectLang(message || "");
      nudgeText = "\n\n" + softNudge(langSoft);
    }

    // --- Off-topic guardrail: return a friendly nudge before calling the model ---
    const lang = detectLang(message || "");
    const lastUserTurns = (history || []).filter(m => m.role === "user").slice(-2);
    const recentText = [message, ...lastUserTurns.map(m => m.content)].join(" ");
    if (!isWeddingRelated(recentText)) {
      return res.status(200).json({ ok: true, reply: offTopicReply(lang) });
    }



    // Light hint from FAQs (keep as you had)

    const context = retrieveHint(message);



    // Build a small profile blurb for the model (safe/useful only)
    // Include what's collected so AI knows what info is available

    const profileLine = [

      name ? `Name: ${name}` : null,

      email ? `Email: ${email}` : null,

      guests ? `Gäste (geplant): ${guests}` : null

    ].filter(Boolean).join(" | ");

    // Status indicators for AI workflow guidance
    const profileStatus = {
      hasName: !!name,
      hasEmail: !!email,
      hasGuests: !!guests,
      isComplete: !!(name && email && guests)
    };



    const messages = [

      { role: "system", content: system },

      // Provide the KB as context for the model, now merged with faqs

      { role: "system", content: `Königswirt Knowledge Base (JSON):\n${JSON.stringify(kb)}` },

      ...(history || []).slice(-6),

      {

        role: "user",

        content: `Frage: ${message}

${context ? "\n" + context : ""}

${profileLine ? `\nProfil: ${profileLine}` : ""}

${profileStatus.isComplete ? "\n✅ Profil vollständig (Name, Email, Gäste vorhanden) - Bereit für Empfehlungen!" : `\n⚠️ Profil Status: Name=${profileStatus.hasName ? "✓" : "✗"}, Email=${profileStatus.hasEmail ? "✓" : "✗"}, Gäste=${profileStatus.hasGuests ? "✓" : "✗"} - Antwort zuerst geben, dann am Ende der Antwort höflich nach fehlenden Infos fragen.`}`

      }

    ];



    const completion = await client.chat.completions.create({

      model: "gpt-4o-mini",

      temperature: 0.2,

      messages

    });



    const replyBase = completion.choices?.[0]?.message?.content ?? "…";
    const reply = replyBase + (nudgeText || "");



    // Optional: log to Make or your DB with session_id to stitch chats + form

    // if (process.env.MAKE_WEBHOOK_URL) {

    //   await fetch(process.env.MAKE_WEBHOOK_URL, {

    //     method: "POST",

    //     headers: { "Content-Type": "application/json" },

    //     body: JSON.stringify({ session_id, profile, question: message, answer: reply, ts: Date.now() })

    //   });

    // }



    res.status(200).json({ ok: true, reply });

  } catch (e) {

    console.error("API Error:", e);

    res.status(500).json({ 

      error: "Server error", 

      message: e.message || "Unknown error",

      details: process.env.NODE_ENV === "development" ? e.stack : undefined

    });

  }

}
