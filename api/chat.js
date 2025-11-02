// /api/chat.js

import OpenAI from "openai";

// FAQs embedded for Vercel compatibility
const faqs = [
  { "q": "capacity", "a": "Herzog Tassilo Saal: bis 200 Gäste. Restaurant: 80-100. Schänke: bis 150." },
  { "q": "saalmiete", "a": "Saalmiete aktuell 1.500 € (Datum/Verfügbarkeit abhängig)." },
  { "q": "deko", "a": "Eigene Deko möglich. Aufbau oft ab Vortag 17:00, wenn frei." }
];



const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });



function retrieveHint(text = "") {

  const t = text.toLowerCase();

  const hit = faqs.find(f => t.includes(f.q.toLowerCase()));

  return hit ? `FAQ-Hinweis: ${hit.a}` : "";

}



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



    const system = `

You are Leon, the venue's wedding assistant.

- Be concise, friendly, and on-brand.

- If a name is provided, address the user by name once in the first reply ("Hallo Anna, ..."), then naturally.

- Never expose or confirm private info unless the user brings it up (email, phone).

- Don't promise availability; ask for date and approximate guest count if missing.

- Use € for prices. If unsure, ask one clarifying question.

`.trim();



    // Light hint from FAQs (keep as you had)

    const context = retrieveHint(message);



    // Build a small profile blurb for the model (safe/useful only)

    const profileLine = [

      name ? `Name: ${name}` : null,

      guests ? `Gäste (geplant): ${guests}` : null

    ].filter(Boolean).join(" | ");



    const messages = [

      { role: "system", content: system },

      ...(history || []).slice(-6),

      { role: "user", content:

`Frage: ${message}

${context ? "\n" + context : ""}

${profileLine ? `\nProfil: ${profileLine}` : ""}` }

    ];



    const completion = await client.chat.completions.create({

      model: "gpt-4o-mini",

      temperature: 0.2,

      messages

    });



    const reply = completion.choices?.[0]?.message?.content ?? "…";



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

