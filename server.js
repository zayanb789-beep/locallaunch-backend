// LocalLaunch Backend — Node.js + Express
// ─────────────────────────────────────────
// SETUP:
//   1. npm init -y
//   2. npm install express cors dotenv @anthropic-ai/sdk
//   3. Create a .env file with your Anthropic API key (see below)
//   4. node server.js
//
// .env file contents:
//   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
//
// Then point your frontend fetch calls to:
//   http://localhost:3001/api/...

const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3001;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// ── Helper: extract text from Anthropic response content blocks ──
function extractText(content) {
  return content.map(b => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
}

// ── Helper: safely parse JSON from Claude's response ──
function safeParseJSON(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────
// POST /api/ai-opportunities
// Generates personalized AI opportunities
// Body: { city, grade, interests, skills, goals, availability }
// ─────────────────────────────────────────
app.post("/api/ai-opportunities", async (req, res) => {
  const { city = "Sugar Land", grade, interests = [], skills = [], goals = [], availability = [] } = req.body;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: "Return pure JSON arrays only. No markdown, no backticks, no explanation.",
      messages: [{
        role: "user",
        content: `Generate 6 realistic local opportunities for a high school student.
City: ${city}, TX. Grade: ${grade || "high school"}.
Interests: ${interests.join(", ") || "general"}.
Skills: ${skills.join(", ") || "none listed"}.
Goals: ${goals.join(", ") || "general"}.
Availability: ${availability.join(", ") || "flexible"}.
Return ONLY a JSON array. Each object: { title, business, type (Internship|Part-time Job|Volunteer), industry, city, hours, description }`
      }]
    });
    const parsed = safeParseJSON(extractText(response.content));
    res.json({ opportunities: parsed });
  } catch (err) {
    console.error("AI opportunities error:", err.message);
    res.status(500).json({ error: "Failed to generate AI opportunities." });
  }
});

// ─────────────────────────────────────────
// POST /api/web-opportunities
// Searches the web for real listings
// Body: { city, interests }
// ─────────────────────────────────────────
app.post("/api/web-opportunities", async (req, res) => {
  const { city = "Sugar Land", interests = [] } = req.body;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: "Search the web and return results as pure JSON arrays only. No markdown, no backticks.",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for real internship, part-time job, and volunteer opportunities for high school students in ${city}, TX.
Student interests: ${interests.join(", ") || "general"}.
Find 5+ real listings from job boards or local organizations.
Return ONLY a JSON array. Each: { title, business, type (Internship|Part-time Job|Volunteer), industry, city, hours, description, url }`
      }]
    });
    const parsed = safeParseJSON(extractText(response.content));
    res.json({ opportunities: parsed });
  } catch (err) {
    console.error("Web search error:", err.message);
    res.status(500).json({ error: "Failed to fetch web opportunities." });
  }
});

// ─────────────────────────────────────────
// POST /api/advisor
// AI career advisor chat
// Body: { messages, profile, opportunities }
// ─────────────────────────────────────────
app.post("/api/advisor", async (req, res) => {
  const { messages = [], profile = {}, opportunities = [] } = req.body;
  const opList = opportunities.slice(0, 12).map(o => `${o.title} at ${o.business} (${o.type}, ${o.industry})`).join("; ");
  const system = `You are a friendly career advisor for high school students.
Student: name=${profile.name || "unknown"}, grade=${profile.grade || "unknown"}, interests=${(profile.interests || []).join(",")}, skills=${(profile.skills || []).join(",")}, goals=${(profile.goals || []).join(",")}, careerGoal=${profile.careerGoal || "undecided"}, city=${profile.city || "Sugar Land TX"}.
Available opportunities: ${opList}.
Give practical, encouraging advice in 2-4 sentences.`;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system,
      messages
    });
    res.json({ reply: extractText(response.content) });
  } catch (err) {
    console.error("Advisor error:", err.message);
    res.status(500).json({ error: "Advisor unavailable. Try again." });
  }
});

// ─────────────────────────────────────────
// POST /api/insight
// Personalized profile insight
// Body: { profile, topMatches }
// ─────────────────────────────────────────
app.post("/api/insight", async (req, res) => {
  const { profile = {}, topMatches = [] } = req.body;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: "You are a friendly high school career advisor. Be encouraging and specific. Keep it to 2 sentences max.",
      messages: [{
        role: "user",
        content: `Student: name=${profile.name}, grade=${profile.grade}, interests=${(profile.interests||[]).join(", ")}, skills=${(profile.skills||[]).join(", ")}, goals=${(profile.goals||[]).join(", ")}, careerGoal=${profile.careerGoal||"undecided"}.
Top matches: ${topMatches.join(", ") || "none yet"}.
Write a 2-sentence personalized insight about which opportunities suit them best and one actionable tip.`
      }]
    });
    res.json({ insight: extractText(response.content) });
  } catch (err) {
    console.error("Insight error:", err.message);
    res.status(500).json({ error: "Could not load insight." });
  }
});

app.listen(PORT, () => console.log(`LocalLaunch backend running on http://localhost:${PORT}`));