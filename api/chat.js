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

  // CORS: open while testing; lock to your domain later via env

  const origin = process.env.CORS_ORIGIN || "*";

  res.setHeader("Access-Control-Allow-Origin", origin);

  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });



  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
    }

    const { message, history = [] } = req.body || {};

    if (!message) return res.status(400).json({ error: "Missing message" });



    const system = `

You are Leon, a warm, concise wedding assistant for our Bavarian venue.

Answer only about our venue/services. Prefer German; if user writes Russian, reply in Russian.

Do not promise availability; suggest sending date + email.

Use € for prices. If unsure, ask one clarifying question.

    `.trim();



    const context = retrieveHint(message);



    const messages = [

      { role: "system", content: system },

      ...history.slice(-6),

      { role: "user", content: `Frage: ${message}\n${context ? "\n" + context : ""}` }

    ];



    const completion = await client.chat.completions.create({

      model: "gpt-4o-mini",

      temperature: 0.2,

      messages

    });



    const reply = completion.choices?.[0]?.message?.content ?? "…";

    res.status(200).json({ ok: true, reply });

  } catch (e) {

    console.error(e);

    res.status(500).json({ error: "Server error" });

  }

}

