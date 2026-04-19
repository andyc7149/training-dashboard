const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID;
const API_KEY = process.env.INTERVALS_API_KEY;
const BASE = "https://intervals.icu/api/v1/athlete/" + ATHLETE_ID;
const AUTH = "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");

export default async function handler(req, res) {
  const today = "2026-04-19";
  const tomorrow = "2026-04-20";
  
  const response = await fetch(BASE + "/events?oldest=" + today + "&newest=" + tomorrow, {
    headers: { Authorization: AUTH, Accept: "application/json" },
  });
  
  const data = await response.json();
  res.status(200).json({ count: Array.isArray(data) ? data.length : 0, data: data });
}
