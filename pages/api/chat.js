import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question, data, history = [] } = req.body;
  if (!question) return res.status(400).json({ error: "No question provided" });

  try {
    const messages = [
      ...history.map(m => ({ role: m.role, content: m.text })),
      {
        role: "user",
        content: `Here is Andy's recent training data:\n\nActivities (last 30):\n${JSON.stringify(data.activities?.slice(0, 20), null, 2)}\n\nSleep (last 7 days):\n${JSON.stringify(data.sleep, null, 2)}\n\nHRV (last 7 days):\n${JSON.stringify(data.hrv, null, 2)}\n\nStress (last 7 days):\n${JSON.stringify(data.stress, null, 2)}\n\nQuestion: ${question}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: `You are an expert running coach and sports scientist coaching Andy Colman, a recreational runner based in Sydney, Australia. You have access to his Strava running data AND his Garmin health data including sleep, HRV, and stress scores. Give personalised, data-driven coaching advice that considers both his training load AND his recovery metrics. If his sleep or HRV is poor, factor that into your recommendations. Be direct, encouraging, and practical. Use metric units. Keep responses concise — 4-6 sentences unless more detail is genuinely needed.`,
      messages,
    });

    res.status(200).json({ reply: response.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
