import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question, data, history = [] } = req.body;
  if (!question) return res.status(400).json({ error: "No question provided" });

  try {
    const messages = [
      ...history.map(function(m) { return { role: m.role, content: m.text }; }),
      {
        role: "user",
        content: "Here is Andy's training data:\n\nAll Activities (up to 400):\n" + JSON.stringify(data.activities, null, 2) + "\n\nSleep (last 14 days):\n" + JSON.stringify(data.sleep, null, 2) + "\n\nHRV (last 14 days):\n" + JSON.stringify(data.hrv, null, 2) + "\n\nQuestion: " + question,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: "You are an expert running coach and sports scientist coaching Andy Colman, a recreational runner based in Sydney, Australia. You have access to his full activity history including all runs, sleep and HRV data. Use the full dataset when answering questions — if asked about a specific time period like July last year, look through all the activities provided to find relevant data. Give personalised, data-driven coaching advice. Be direct, encouraging, and practical. Use metric units. Keep responses concise — 4-6 sentences unless more detail is needed.",
      messages,
    });

    res.status(200).json({ reply: response.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
