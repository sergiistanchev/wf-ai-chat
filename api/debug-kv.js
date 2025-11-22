// /api/debug-kv.js

import { createClient } from "redis";

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
      if (redis && redis.isOpen) {
        // Add timeout to Redis operations
        const getPromise = redis.get(kvKey);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Redis operation timeout")), 1000)
        );
        const value = await Promise.race([getPromise, timeoutPromise]);
        count = value ? Number(value) : 0;
      } else {
        count = -1; // Redis not available
        kvError = "Redis client not available - check koenigswirt_REDIS_URL environment variable";
      }
    } catch (e) {
      console.warn("Redis get failed:", e.message);
      kvError = e.message;
      // Always return partial info instead of failing - Redis is optional
      count = -1; // Indicate Redis not available
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

