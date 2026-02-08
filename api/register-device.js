// Vercel Serverless Function: Register device for push notifications
// POST /api/register-device
// Body: { pushToken, watchlist: ["AAPL", "005930"], platform: "ios", deviceName: "iPhone" }
//
// Uses Vercel KV (Redis) for storage. Set up at:
// Vercel Dashboard → Storage → Create KV Database → Link to project

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pushToken, watchlist, platform, deviceName } = req.body;

  if (!pushToken || !watchlist || !Array.isArray(watchlist)) {
    return res.status(400).json({ error: "pushToken and watchlist array are required" });
  }

  try {
    // ─── Storage: Vercel KV (Redis) ────────────────────────────────
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      // Fallback: use in-memory storage (for development)
      console.warn("KV not configured. Device registration will not persist.");
      return res.status(200).json({
        success: true,
        message: "Registered (no persistent storage configured)",
        deviceId: pushToken.slice(-8),
      });
    }

    // Store device info in Redis
    const deviceData = {
      pushToken,
      watchlist,
      platform: platform || "unknown",
      deviceName: deviceName || "Unknown",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSignals: {}, // Track last known signals to avoid duplicates
    };

    // Use push token as key (each device is unique)
    const deviceKey = `device:${Buffer.from(pushToken).toString("base64").slice(0, 32)}`;

    // Check if device exists (to preserve lastSignals)
    const existingRes = await fetch(`${KV_URL}/get/${deviceKey}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const existingData = await existingRes.json();

    if (existingData.result) {
      try {
        const existing = JSON.parse(existingData.result);
        deviceData.lastSignals = existing.lastSignals || {};
        deviceData.registeredAt = existing.registeredAt;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Save device
    await fetch(`${KV_URL}/set/${deviceKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: JSON.stringify(deviceData) }),
    });

    // Also add to the device index set (for cron to iterate)
    await fetch(`${KV_URL}/sadd/device_index/${deviceKey}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });

    return res.status(200).json({
      success: true,
      message: "Device registered successfully",
      deviceId: deviceKey.slice(-8),
      watchlistCount: watchlist.length,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Failed to register device", message: error.message });
  }
}
