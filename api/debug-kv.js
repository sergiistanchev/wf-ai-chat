// /api/debug-kv.js

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { session_id, email, ip } = req.method === "POST" ? req.body : req.query;

    if (!session_id && !email && !ip) {
      return res.status(400).json({ 
        error: "Missing identifier",
        usage: "Provide session_id, email, or ip as query param or in POST body"
      });
    }

    const userKey = (email && `email:${email}`) || (session_id && `session:${session_id}`) || (ip && `ip:${ip}`) || null;
    
    if (!userKey) {
      return res.status(400).json({ error: "Invalid identifier" });
    }

    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const kvKey = `usage:${userKey}:${day}`;

    let count = 0;
    try {
      const value = await kv.get(kvKey);
      count = value ? Number(value) : 0;
    } catch (e) {
      console.error("KV get failed:", e);
      return res.status(500).json({ error: "KV query failed", message: e.message });
    }

    const limit = Number(process.env.DAILY_LIMIT || 25);
    const nudgeAt = Number(process.env.SOFT_NUDGE_AT || 15);

    res.status(200).json({
      ok: true,
      userKey,
      day,
      kvKey,
      count,
      limit,
      nudgeAt,
      remaining: Math.max(0, limit - count),
      isLimited: count > limit,
      isNearLimit: count >= nudgeAt && count <= limit
    });

  } catch (e) {
    console.error("Debug KV Error:", e);
    res.status(500).json({ error: "Server error", message: e.message });
  }
}

