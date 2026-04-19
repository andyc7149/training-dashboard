import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const name = String(body.workoutName || "Workout").slice(0, 100);
    const desc = String(body.workoutDescription || "").replace(/[^\w\s.,!?-]/g, " ").slice(0, 300);
    const duration = String(body.workoutDuration || "").slice(0, 50);
    const readiness = body.readiness !== null && body.readiness !== undefined ? Number(body.readiness) : null;
    const injuryLevel = String(body.injuryLevel || "unknown").slice(0, 20);
    const injuryScore = Number(body.injuryScore || 0);
    const ctl = body.ctl ? Number(body.ctl) : null;
    const atl = body.atl ? Number(body.atl) : null;
    const form = body.form !== null && body.form !== undefined ? Number(body.form) : null;

    const prompt = "Assess this workout. Reply with ONLY a JSON object.\n\nWorkout: " + name + "\n" +
      (duration ? "Duration: " + duration + "\n" : "") +
      (desc ? "Description: " + desc + "\n" : "") +
      "Readiness: " + (readiness !== null ? readiness + "/100" : "unknown") + "\n" +
      "Injury risk: " + injuryLevel + " " + injuryScore + "/100\n" +
      (ctl !== null ? "CTL: " + ctl + " ATL: " + atl + " Form: " + form + "\n" : "") +
      "\nReply with ONLY this JSON, no other text: {\"signal\":\"GREEN\",\"headline\":\"title here\",\"advice\":\"advice here\"}";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return res.status(200).json(parsed);
    }
    return res.status(200).json({ signal: "AMBER", headline: "See advice", advice: text.slice(0, 200) });
  } catch (e) {
    return res.status(500).json({ signal: "AMBER", headline: "Error", advice: e.message });
  }
}
