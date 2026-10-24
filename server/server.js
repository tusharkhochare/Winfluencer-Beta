require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const app = express();
app.use(cors());
app.use(express.json());
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});
// Test endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Winfluencer API is running!",
  });
});
app.post("/api/youtube/analyze", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        error: "YouTube channel URL is required",
      });
    }
    let channelId = null;
    // Format 1:
    // https://www.youtube.com/channel/UCxxxxxxxx
    const channelMatch = url.match(
      /youtube\.com\/channel\/(UC[\w-]+)/
    );
    if (channelMatch) {
      channelId = channelMatch[1];
    }
    // Format 2:
    // https://www.youtube.com/@username
    if (!channelId) {
      const handleMatch = url.match(
        /youtube\.com\/@([\w.-]+)/
      );
      if (handleMatch) {
        const handle = handleMatch[1];
        const response = await youtube.channels.list({
          part: "snippet,statistics",
          forHandle: handle,
        });
        if (!response.data.items?.length) {
          return res.status(404).json({
            error: "YouTube channel not found",
          });
        }
        channelId = response.data.items[0].id;
      }
    }
    if (!channelId) {
      return res.status(400).json({
        error: "Please enter a valid YouTube channel URL",
      });
    }
    // Get channel information
    const response = await youtube.channels.list({
      part: "snippet,statistics,contentDetails",
      id: channelId,
    });
    if (!response.data.items?.length) {
      return res.status(404).json({
        error: "Channel not found",
      });
    }
    const channel = response.data.items[0];
// ------------------------------------
// GET VIDEOS FROM LAST 7 DAYS
// ------------------------------------
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
// Uses the channel's uploads playlist (1 quota unit) instead of
// youtube.search.list (100 units, separate daily "Search Queries" quota).
const uploadsPlaylistId =
  channel.contentDetails?.relatedPlaylists?.uploads || "";
let videoIds = [];
if (uploadsPlaylistId) {
  const uploadsResponse = await youtube.playlistItems.list({
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: 50,
  });
  videoIds = (uploadsResponse.data.items || [])
    .filter((item) => {
      const published = item.contentDetails?.videoPublishedAt;
      return published && new Date(published) >= sevenDaysAgo;
    })
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);
}
// Get statistics for those videos
let recentVideos = [];
if (videoIds.length > 0) {
  const videoResponse = await youtube.videos.list({
    part: "snippet,statistics",
    id: videoIds.join(","),
  });
  recentVideos = videoResponse.data.items.map((video) => ({
    id: video.id,
    title: video.snippet.title,
    thumbnail:
      video.snippet.thumbnails?.medium?.url ||
      video.snippet.thumbnails?.default?.url,
    views: Number(video.statistics.viewCount || 0),
    publishedAt: video.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  }));
}
// ------------------------------------
// CALCULATE 7-DAY VIDEO PERFORMANCE
// ------------------------------------
const combinedViews = recentVideos.reduce(
  (total, video) => total + video.views,
  0
);
const videoCount = recentVideos.length;
const averageViews =
  videoCount > 0
    ? Math.round(combinedViews / videoCount)
    : 0;
const highestViews =
  videoCount > 0
    ? Math.max(...recentVideos.map((video) => video.views))
    : 0;
const lowestViews =
  videoCount > 0
    ? Math.min(...recentVideos.map((video) => video.views))
    : 0;
// ------------------------------------
// SEND EVERYTHING TO REACT
// ------------------------------------
res.json({
  id: channel.id,
  name: channel.snippet.title,
  description: channel.snippet.description,
  thumbnail: channel.snippet.thumbnails?.high?.url,
  subscribers: channel.statistics.subscriberCount,
  views: channel.statistics.viewCount,
  videos: channel.statistics.videoCount,
  sevenDayPerformance: {
    videoCount,
    combinedViews,
    averageViews,
    highestViews,
    lowestViews,
  },
  recentVideos,
});
  } catch (error) {
    console.error("YOUTUBE API ERROR:");
    console.error(error.response?.data || error.message || error);
    res.status(500).json({
      error: "Failed to analyze YouTube channel",
    });
  }
});
// Get channel information
app.get("/api/youtube/channel", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({
        error: "YouTube channel ID is required",
      });
    }
    const response = await youtube.channels.list({
      part: "snippet,statistics",
      id: id,
    });
    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({
        error: "Channel not found",
      });
    }
    const channel = response.data.items[0];
    res.json({
      id: channel.id,
      name: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails.high.url,
      subscribers: channel.statistics.subscriberCount,
      views: channel.statistics.viewCount,
      videos: channel.statistics.videoCount,
    });
} catch (error) {
  console.error("YOUTUBE API ERROR:");
  console.error(error.response?.data || error.message || error);
  res.status(500).json({
    error: "Failed to fetch YouTube channel data",
    details: error.response?.data || error.message,
  });
}
});
app.post("/api/ai/analyze-creator", async (req, res) => {
  try {
    const { channel } = req.body;
    if (!channel || typeof channel !== "object") {
      return res.status(400).json({
        error: "Channel data is required",
      });
    }
    if (!channel.id || !channel.name) {
      return res.status(400).json({
        error: "Channel ID and channel name are required",
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini API key is not configured",
      });
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    // Limit the amount of channel data sent for analysis.
    const videos = Array.isArray(channel.recentVideos)
      ? channel.recentVideos.slice(0, 10).map((video) => ({
          title: String(video.title || "").slice(0, 250),
          views: Number(video.views || 0),
          publishedAt: video.publishedAt || "",
        }))
      : [];
    const channelData = {
      name: String(channel.name).slice(0, 200),
      description: String(channel.description || "").slice(0, 3000),
      subscribers: channel.subscribers ?? null,
      totalViews: channel.views ?? null,
      totalVideos: channel.videos ?? null,
      recentVideos: videos,
    };
    const prompt = `
You are the Creator Intelligence Engine for Winfluencer.
Analyze the supplied public YouTube channel information.
Use evidence from its description and video titles.
Return ONLY a valid JSON object with these fields:
{
  "primaryNiche": "string",
  "subNiches": ["string"],
  "contentThemes": ["string"],
  "sponsorCategories": [
    {
      "category": "string",
      "reason": "string"
    }
  ],
  "competitorSearchKeywords": ["string"],
  "confidence": "low | medium | high"
}
Rules:
- Do not invent channel facts, audience demographics, or private analytics.
- Audience interests are hypotheses inferred from public content.
- Recommend relevant sponsor categories, not fabricated company names.
- Competitor keywords should help find similar public YouTube channels.
- Base confidence on the amount and quality of available evidence.
- If the evidence is insufficient, say so in limitations.
- Do not claim that any sponsor contact has been verified.
Channel data:
${JSON.stringify(channelData)}
`;
console.time("Gemini analysis");
let response;
let lastError;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    console.log(`Gemini attempt ${attempt}/3`);
    console.time("Gemini analysis");
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 700,
        temperature: 0.2,
      },
    });
    console.timeEnd("Gemini analysis");
    break;
  } catch (error) {
    console.timeEnd("Gemini analysis");
    lastError = error;
    const message = String(error.message || error);
    const retryable =
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      message.includes("429") ||
      message.includes("RESOURCE_EXHAUSTED");
    if (!retryable || attempt === 3) {
      throw error;
    }
    const delay = attempt * 1500;
    console.log(`Gemini temporarily unavailable. Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
if (!response) {
  throw lastError || new Error("Gemini did not return a response");
}
console.timeEnd("Gemini analysis");
    const text = response.text;
    if (!text) {
      return res.status(502).json({
        error: "Gemini returned an empty response",
      });
    }
    let profile;
    try {
      profile = JSON.parse(text);
    } catch {
      console.error("Gemini returned invalid JSON");
      return res.status(502).json({
        error: "Could not parse the creator analysis",
      });
    }
    return res.json({
      channelId: channel.id,
      channelName: channel.name,
      analyzedAt: new Date().toISOString(),
      profile,
    });
  } catch (error) {
    console.error(
      "CREATOR INTELLIGENCE ERROR:",
      error.message
    );
    return res.status(500).json({
      error: "Failed to analyze creator",
      message:
        "Check the backend logs and Gemini API configuration.",
    });
  }
});
app.get("/api/ai/models", async (req, res) => {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    const models = await ai.models.list();
    const available = [];
    for await (const model of models) {
      if (model.supportedActions?.includes("generateContent")) {
        available.push(model.name);
      }
    }
    res.json({ models: available });
  } catch (error) {
    console.error("MODEL LIST ERROR:", error.message);
    res.status(500).json({ error: "Could not list models" });
  }
});
app.post("/api/ai/generate-sponsor-email", async (req, res) => {
  try {
    const { channel, profile, sponsor, creatorName } = req.body;
    if (!channel?.id || !channel?.name || !profile || !sponsor?.name) {
      return res.status(400).json({
        error: "Channel, creator profile, and sponsor are required.",
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini API key is not configured.",
      });
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
    const channelData = {
      name: String(channel.name).slice(0, 200),
      description: String(channel.description || "").slice(0, 2000),
      subscribers: channel.subscribers ?? null,
      totalViews: channel.views ?? null,
      recentVideos: Array.isArray(channel.recentVideos)
        ? channel.recentVideos.slice(0, 10).map((video) => ({
            title: String(video.title || "").slice(0, 200),
            views: Number(video.views || 0),
          }))
        : [],
    };
    const prompt = `
Write a convincing, professional sponsorship outreach email.
CREATOR INFORMATION:
${JSON.stringify(channelData)}
AI CREATOR PROFILE:
${JSON.stringify({
  primaryNiche: profile.primaryNiche,
  subNiches: profile.subNiches,
  contentThemes: profile.contentThemes,
  audienceInterests: profile.audienceInterests,
  confidence: profile.confidence,
})}
SUGGESTED SPONSOR:
${JSON.stringify({
  name: String(sponsor.name).slice(0, 200),
  reason: String(sponsor.reason || "").slice(0, 500),
})}
CREATOR NAME:
${String(creatorName || "Content Creator").slice(0, 100)}
REQUIREMENTS:
- Return only the email draft, as plain text.
- Include a useful subject line beginning with "Subject:".
- Explain the creator's niche and specific content themes using available evidence.
- Explain the likely audience interests and why the sponsor is relevant.
- Use recent video titles as examples where useful.
- Explain how a collaboration could benefit the brand.
- Suggest a relevant integration, demonstration, review, or other content collaboration.
- Invite the brand to discuss partnership opportunities.
- Keep the email concise, professional, personal, and convincing.
- Do not invent audience demographics, engagement rates, sponsorship history, or performance metrics.
- Treat audience interests as inferred interests, not verified demographics.
- Do not invent a recipient's name, email address, or brand-specific product facts.
- If subscriber or view counts are unavailable, do not invent them.
- Do not include placeholders for facts you can reasonably omit.
- End with the creator's name and YouTube channel name.
`;
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: prompt,
          config: {
            maxOutputTokens: 800,
            temperature: 0.4,
          },
        });
        break;
      } catch (error) {
        lastError = error;
        const message = String(error.message || error);
        const retryable =
          message.includes("503") ||
          message.includes("UNAVAILABLE") ||
          message.includes("429") ||
          message.includes("RESOURCE_EXHAUSTED");
        if (!retryable || attempt === 3) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1500)
        );
      }
    }
    if (!response?.text) {
      throw lastError || new Error("Gemini returned an empty email.");
    }
    return res.json({
      email: response.text.trim(),
    });
  } catch (error) {
    console.error("SPONSOR EMAIL ERROR:", error.message);
    return res.status(500).json({
      error: "Could not generate the sponsorship email. Please try again.",
    });
  }
});
app.post("/api/ai/find-sponsors", async (req, res) => {
  try {
    const { channel, profile } = req.body;
    if (!channel?.id || !profile?.primaryNiche) {
      return res.status(400).json({
        error: "A channel and its AI creator profile are required.",
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini API key is not configured.",
      });
    }
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
const prompt = `
Find 3 real companies that could be suitable sponsors for this YouTube creator.
Creator niche: ${profile.primaryNiche}
Sub-niches: ${(profile.subNiches || []).slice(0, 4).join(", ")}
Content themes: ${(profile.contentThemes || []).slice(0, 4).join(", ")}
Likely audience interests: ${(profile.audienceInterests || []).slice(0, 4).join(", ")}
Use Google Search to identify real companies relevant to this niche.
Return ONLY valid JSON:
{
  "sponsors": [
    {
      "name": "Company name",
      "website": "Official website URL",
      "reason": "One short explanation of why this company fits",
      "evidence": "One relevant fact supported by research",
      "sourceUrl": "URL supporting the recommendation"
    }
  ]
}
Rules:
- Return at most 3 companies.
- Use real companies, not invented names.
- Prefer official websites.
- Do not invent URLs or claim sponsorship programs are confirmed without evidence.
- Keep explanations concise.
- Audience interests are inferred, not verified demographics.
`;
    const communityAI = new (await import("@google/genai")).GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const response = await communityAI.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        maxOutputTokens: 1800,
      },
    });
    const text = response.text;
    if (!text) {
      return res.status(502).json({
        error: "Gemini returned no sponsor recommendations.",
      });
    }
    let result;
    try {
      const cleanText = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      result = JSON.parse(cleanText);
    } catch {
      console.error("Sponsor search returned invalid JSON.");
      return res.status(502).json({
        error: "Could not process the sponsor search results. Please retry.",
      });
    }
    const sponsors = (Array.isArray(result.sponsors)
      ? result.sponsors
      : []
    )
      .filter((sponsor) =>
        sponsor &&
        typeof sponsor.name === "string" &&
        typeof sponsor.reason === "string"
      )
      .slice(0, 6)
      .map((sponsor) => ({
        name: sponsor.name.slice(0, 150),
        website:
          typeof sponsor.website === "string" &&
          /^https?:\/\//i.test(sponsor.website)
            ? sponsor.website
            : "",
        reason: sponsor.reason.slice(0, 600),
        evidence:
          typeof sponsor.evidence === "string"
            ? sponsor.evidence.slice(0, 400)
            : "",
        sourceUrl:
          typeof sponsor.sourceUrl === "string" &&
          /^https?:\/\//i.test(sponsor.sourceUrl)
            ? sponsor.sourceUrl
            : "",
      }));
    return res.json({
      channelId: channel.id,
      sponsors,
      searchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SPONSOR DISCOVERY ERROR:", error.message);
    return res.status(500).json({
      error: "Could not find sponsors. Please try again.",
    });
  }
});
function extractYouTubeChannelInput(value) {
  const input = String(value || "").trim();
  if (/^UC[\w-]{22}$/.test(input)) {
    return { id: input };
  }
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      return { handle: parts[0].slice(1) };
    }
    if (parts[0] === "channel" && parts[1]) {
      return { id: parts[1] };
    }
    if (parts[0] === "user" && parts[1]) {
      return { username: parts[1] };
    }
  } catch {
    // Not a complete URL.
  }
  if (input.startsWith("@")) {
    return { handle: input.slice(1) };
  }
  throw new Error(
    "Enter a valid YouTube channel URL, @handle, or channel ID."
  );
}
async function getCommunityChannel(input) {
  const query = extractYouTubeChannelInput(input);
  let response;
  if (query.id) {
    response = await youtube.channels.list({
      part: ["snippet", "contentDetails"],
      id: [query.id],
      maxResults: 1,
    });
  } else if (query.handle) {
    response = await youtube.channels.list({
      part: ["snippet", "contentDetails"],
      forHandle: query.handle,
      maxResults: 1,
    });
  } else if (query.username) {
    response = await youtube.channels.list({
      part: ["snippet", "contentDetails"],
      forUsername: query.username,
      maxResults: 1,
    });
  }
  const item = response?.data?.items?.[0];
  if (!item) {
    throw new Error("YouTube channel not found. Check the URL and try again.");
  }
  return {
    id: item.id,
    name: item.snippet?.title || "YouTube Creator",
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      "",
    uploadsPlaylistId:
      item.contentDetails?.relatedPlaylists?.uploads || "",
  };
}
function mapCommunityVideo(item) {
  const snippet = item.snippet || {};
  const videoId =
    item.contentDetails?.videoId ||
    snippet.resourceId?.videoId ||
    item.id?.videoId ||
    item.id;
  if (!videoId) return null;
  return {
    id: videoId,
    title: snippet.title || "",
    thumbnail:
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      snippet.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    publishedAt:
      item.contentDetails?.videoPublishedAt ||
      snippet.publishedAt ||
      "",
    channelTitle: snippet.channelTitle || "",
    channelId: snippet.channelId || "",
  };
}
// Add an inspiration channel.
app.post("/api/community/inspirations", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        error: "A YouTube channel URL is required.",
      });
    }
    const channel = await getCommunityChannel(url);
    return res.json({ channel });
  } catch (error) {
    console.error("COMMUNITY ADD INSPIRATION ERROR:", error.message);
    return res.status(400).json({
      error: error.message || "Could not add this channel.",
    });
  }
});
// Retrieve recent videos from an inspiration channel.
app.post("/api/community/inspiration-videos", async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!/^UC[\w-]{22}$/.test(String(channelId || ""))) {
      return res.status(400).json({
        error: "A valid YouTube channel ID is required.",
      });
    }
    const channel = await getCommunityChannel(channelId);
    if (!channel.uploadsPlaylistId) {
      return res.json({ videos: [] });
    }
    const response = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: channel.uploadsPlaylistId,
      maxResults: 6,
    });
    const videos = (response.data.items || [])
      .map(mapCommunityVideo)
      .filter(Boolean)
      .slice(0, 6);
    return res.json({ videos });
  } catch (error) {
    console.error("COMMUNITY INSPIRATION VIDEOS ERROR:", error.message);
    return res.status(500).json({
      error: "Could not load recent inspiration videos.",
    });
  }
});
// ---------------------------------------------------------------------------
// Community: Top 5 related videos (YouTube Data API only)
// Uses uploads playlists from the creator's saved inspiration channels.
// This route does NOT call youtube.search.list or Gemini.
// ---------------------------------------------------------------------------

// In-memory cache: cleared whenever the server restarts.
const communityRelatedVideoCache = new Map();
const communityRelatedInFlight = new Map();
const RELATED_FRESH_MS = 6 * 60 * 60 * 1000; // fresh for 6 hours
const RELATED_STALE_MS = 7 * 24 * 60 * 60 * 1000; // stale fallback for 7 days
const RELATED_CACHE_MAX = 200;

function pruneRelatedCache() {
  const now = Date.now();
  for (const [key, entry] of communityRelatedVideoCache) {
    if (now - entry.time > RELATED_STALE_MS) {
      communityRelatedVideoCache.delete(key);
    }
  }
  while (communityRelatedVideoCache.size > RELATED_CACHE_MAX) {
    communityRelatedVideoCache.delete(
      communityRelatedVideoCache.keys().next().value
    );
  }
}

function tokenizeRelatedText(value) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "this", "that", "your", "you",
    "are", "was", "how", "why", "what", "when", "into", "about", "best",
    "new", "all", "can", "not", "but", "its", "their", "they", "video",
    "videos", "official", "part", "episode", "full", "one", "top"
  ]);

  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreRelatedVideo(video, profile) {
  const niche = tokenizeRelatedText(profile.primaryNiche);
  const themes = Array.isArray(profile.contentThemes)
    ? profile.contentThemes.slice(0, 8).flatMap(tokenizeRelatedText)
    : [];
  const subNiches = Array.isArray(profile.subNiches)
    ? profile.subNiches.slice(0, 5).flatMap(tokenizeRelatedText)
    : [];
  const keywords = Array.isArray(profile.competitorSearchKeywords)
    ? profile.competitorSearchKeywords.slice(0, 8).flatMap(tokenizeRelatedText)
    : [];

  const titleTokens = new Set(tokenizeRelatedText(video.title));
  const descriptionTokens = new Set(tokenizeRelatedText(video.description));
  let score = 0;

  for (const word of niche) {
    if (titleTokens.has(word)) score += 5;
    else if (descriptionTokens.has(word)) score += 2;
  }
  for (const word of themes) {
    if (titleTokens.has(word)) score += 4;
    else if (descriptionTokens.has(word)) score += 1.5;
  }
  for (const word of subNiches) {
    if (titleTokens.has(word)) score += 3;
    else if (descriptionTokens.has(word)) score += 1;
  }
  for (const word of keywords) {
    if (titleTokens.has(word)) score += 2;
    else if (descriptionTokens.has(word)) score += 0.75;
  }

  // A small recency bonus helps newer videos rank higher when relevance is similar.
  const published = Date.parse(video.publishedAt || "");
  if (Number.isFinite(published)) {
    const ageDays = Math.max(0, (Date.now() - published) / (24 * 60 * 60 * 1000));
    score += Math.max(0, 2 - ageDays / 45);
  }

  return score;
}

async function fetchRelatedVideosFromInspirations({
  channelId,
  profile,
  inspirations,
}) {
  const inspirationList = Array.isArray(inspirations)
    ? inspirations.slice(0, 5)
    : [];

  if (inspirationList.length === 0) {
    const error = new Error(
      "Add at least one inspiration channel first so Winfluencer can recommend related videos without YouTube search."
    );
    error.status = 400;
    error.code = "NO_INSPIRATIONS";
    throw error;
  }

  // Each playlistItems.list call costs 1 general quota unit and avoids
  // the separate, currently exhausted search.list quota.
  const playlistResults = await Promise.allSettled(
    inspirationList.map(async (inspiration) => {
      let playlistId = String(inspiration?.uploadsPlaylistId || "");

      // Older saved inspiration entries might not have the playlist ID.
      if (!playlistId && inspiration?.id) {
        const resolved = await getCommunityChannel(inspiration.id);
        playlistId = resolved.uploadsPlaylistId;
      }

      if (!playlistId) return [];

      const response = await youtube.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 15,
      });

      return (response.data.items || [])
        .map(mapCommunityVideo)
        .filter(Boolean)
        .map((video) => ({
          ...video,
          description: String(
            response.data.items?.find((item) =>
              (item.contentDetails?.videoId ||
                item.snippet?.resourceId?.videoId) === video.id
            )?.snippet?.description || ""
          ),
        }));
    })
  );

  const allVideos = [];
  let successfulPlaylists = 0;

  for (const result of playlistResults) {
    if (result.status === "fulfilled") {
      successfulPlaylists += 1;
      allVideos.push(...result.value);
    } else {
      console.error(
        "COMMUNITY RELATED PLAYLIST ERROR:",
        result.reason?.message || result.reason
      );
    }
  }

  if (successfulPlaylists === 0) {
    const error = new Error(
      "Could not retrieve videos from your inspiration channels. Check the server logs and YouTube API configuration."
    );
    error.status = 502;
    error.code = "INSPIRATION_FETCH_FAILED";
    throw error;
  }

  const seen = new Set();
  const uniqueVideos = allVideos.filter((video) => {
    if (!video.id || seen.has(video.id) || video.channelId === channelId) {
      return false;
    }
    seen.add(video.id);
    return true;
  });

  const ranked = uniqueVideos
    .map((video) => ({
      ...video,
      relevanceScore: scoreRelatedVideo(video, profile),
    }))
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
    })
    .slice(0, 5)
    .map(({ description, relevanceScore, ...video }) => video);

  return ranked;
}

app.post("/api/community/related-videos", async (req, res) => {
  try {
    const { channel, profile, inspirations, refresh } = req.body || {};

    if (!channel?.id || !profile?.primaryNiche) {
      return res.status(400).json({
        error: "A channel and creator profile are required.",
      });
    }

    const inspirationIds = Array.isArray(inspirations)
      ? inspirations.slice(0, 5).map((item) => ({
          id: String(item?.id || ""),
          uploadsPlaylistId: String(item?.uploadsPlaylistId || ""),
        }))
      : [];

    const cacheKey = [
      String(channel.id),
      String(profile.primaryNiche).slice(0, 150),
      JSON.stringify(profile.contentThemes || []),
      JSON.stringify(profile.subNiches || []),
      JSON.stringify(profile.competitorSearchKeywords || []),
      JSON.stringify(inspirationIds),
    ].join("|");

    const cached = communityRelatedVideoCache.get(cacheKey);
    const age = cached ? Date.now() - cached.time : Infinity;

    if (!refresh && cached && age < RELATED_FRESH_MS) {
      return res.json({
        videos: cached.videos,
        cached: true,
        stale: false,
        source: "youtube-inspiration-playlists",
      });
    }

    let pending = communityRelatedInFlight.get(cacheKey);
    if (!pending) {
      pending = fetchRelatedVideosFromInspirations({
        channelId: String(channel.id),
        profile,
        inspirations,
      }).finally(() => communityRelatedInFlight.delete(cacheKey));
      communityRelatedInFlight.set(cacheKey, pending);
    }

    try {
      const videos = await pending;
      communityRelatedVideoCache.set(cacheKey, {
        videos,
        time: Date.now(),
      });
      pruneRelatedCache();

      return res.json({
        videos,
        cached: false,
        stale: false,
        source: "youtube-inspiration-playlists",
      });
    } catch (error) {
      if (cached && age < RELATED_STALE_MS) {
        return res.json({
          videos: cached.videos,
          cached: true,
          stale: true,
          warning: error.message,
          source: "youtube-inspiration-playlists",
        });
      }
      throw error;
    }
  } catch (error) {
    console.error(
      "COMMUNITY RELATED VIDEOS ERROR:",
      error.code || "",
      error.message
    );
    return res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not load related videos. Try again later.",
      code: error.code || "INTERNAL_ERROR",
    });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Winfluencer server running on http://localhost:${PORT}`);
});
