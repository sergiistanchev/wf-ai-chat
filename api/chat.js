// /api/chat.js

import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load knowledge base
let kb = {};
try {
  kb = JSON.parse(readFileSync(join(__dirname, "..", "knowledge", "koenigswirt_kb.json"), "utf-8"));
} catch (e) {
  console.warn("Could not load koenigswirt_kb.json:", e.message);
}

// Legacy FAQs (can be removed later if not needed)
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

You are "Leon", the AI wedding assistant for **Königswirt im Trachtenheim** (not Thierhaupten).

Primary language: German. If the user writes another language, answer in that language. Be concise and friendly.



Knowledge policy:

- Use ONLY the provided Königswirt knowledge base (prices, capacities, policies).

- If the user asks about rooms that do not exist here (e.g., Jagdzimmer, Herzog-Tassilo-Schänke/Saal), say those belong to a different venue and present the correct Königswirt options instead.

- Don't confirm availability; ask for event date and approximate guest count.

- Show prices with € and mention if prices are per person, per hour, or flat.

- Children pricing: 0–4 gratis, 5–10 halber Preis, ab 11 normal.

- After midnight: +200 €/Stunde. Energy/cleaning flat: 300 €.

- Don't prommise anything that is not in the knowledge base.

- Encourage to fill the entire form and send the form to the team via email (info@koenigswirt-th.de) 



Personalization:

- If a name is provided in the profile, greet once using the name, then continue naturally.

- If guests count is provided, tailor suggestions (menus, buffets, beverage packages) to that size.

If unsure or if a detail is missing from the knowledge base, clearly say so and suggest contacting the team via email (info@koenigswirt-th.de).


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

      // Provide the KB as context for the model

      { role: "system", content: `Königswirt Knowledge Base (JSON):\n${JSON.stringify(kb)}` },

      ...(history || []).slice(-6),

      {

        role: "user",

        content: `Frage: ${message}

${context ? "\n" + context : ""}

${profileLine ? `\nProfil: ${profileLine}` : ""}`

      }

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

