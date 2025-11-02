// /api/debug-kv.js

import { createClient } from "redis";

// Redis client for usage tracking
let redisClient = null;
async function getRedisClient() {
  const redisUrl = process.env.wfchat_REDIS_URL || process.env.KV_REST_API_URL;
  if (!redisUrl) return null;
  
  try {
    if (!redisClient || !redisClient.isOpen) {
      redisClient = createClient({ url: redisUrl });
      redisClient.on("error", (err) => console.error("Redis Client Error:", err));
      await redisClient.connect();
    }
    return redisClient;
  } catch (e) {
    console.error("Redis connection failed:", e.message);
    return null;
  }
}

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
    let kvError = null;
    try {
      const redis = await getRedisClient();
      if (redis) {
        const value = await redis.get(kvKey);
        count = value ? Number(value) : 0;
      } else {
        count = -1; // Redis not available
        kvError = "Redis client not available - check wfchat_REDIS_URL environment variable";
      }
    } catch (e) {
      console.error("Redis get failed:", e);
      kvError = e.message;
      // In development/local, Redis might not be configured - return partial info
      if (process.env.NODE_ENV === "development" || !process.env.wfchat_REDIS_URL) {
        count = -1; // Indicate Redis not available
      } else {
        return res.status(500).json({ error: "Redis query failed", message: e.message });
      }
    }

    const limit = Number(process.env.DAILY_LIMIT || 25);
    const nudgeAt = Number(process.env.SOFT_NUDGE_AT || 15);

    res.status(200).json({
      ok: true,
      userKey,
      day,
      kvKey,
      count: count >= 0 ? count : null,
      limit,
      nudgeAt,
      remaining: count >= 0 ? Math.max(0, limit - count) : null,
      isLimited: count > limit,
      isNearLimit: count >= nudgeAt && count <= limit,
      kvAvailable: count >= 0,
      kvError: kvError || null
    });

  } catch (e) {
    console.error("Debug KV Error:", e);
    res.status(500).json({ error: "Server error", message: e.message });
  }
}

