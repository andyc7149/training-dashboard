import { useState, useEffect } from "react";

const ORANGE = "#FC4C02";
const DARK = "#0a0a0a";
const CARD = "#161616";
const BORDER = "#222";
const MUTED = "#666";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const PURPLE = "#a855f7";

function StatCard({ label, value, unit, color = "#fff", icon }) {
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "14px 16px", border: `1px solid ${BORDER}`, flex: 1 }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: "bold", color }}>{value}<span style={{ fontSize: 12, color: MUTED, marginLeft: 2 }}>{unit}</span></div>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

function ActivityRow({ a, onClick }) {
  const icons = { Run: "🏃", Ride: "🚴", Swim: "🏊", Walk: "🚶", Hike: "🥾" };
  return (
    <div onClick={onClick} style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>{icons[a.type] || "⚡"} {a.name}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{a.date} · {a.duration}</div>
        {a.hr && <div style={{ fontSize: 11, color: MUTED }}>❤️ {a.hr}bpm {a.elevation > 0 ? `· ⛰ ${a.elevation}m` : ""}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: ORANGE }}>{a.distance}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{a.pace}</div>
      </div>
    </div>
  );
}

function SleepRow({ s }) {
  const scoreColor = s.score >= 80 ? GREEN : s.score >= 60 ? ORANGE : "#ef4444";
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>😴 {s.date}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{s.deep ? `Deep: ${s.deep}m` : ""} {s.rem ? `· REM: ${s.rem}m` : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{s.duration}h</div>
        {s.score && <div style={{ fontSize: 12, color: scoreColor }}>Score: {s.score}</div>}
      </div>
    </div>
  );
}

function HRVRow({ h }) {
  const statusColor = h.status === "BALANCED" ? GREEN : h.status === "UNBALANCED" ? ORANGE : MUTED;
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>💜 {h.date}</div>
        <div style={{ fontSize: 11, color: statusColor }}>{h.status || "—"}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: PURPLE }}>{h.lastNight} ms</div>
        <div style={{ fontSize: 11, color: MUTED }}>7d avg: {h.weeklyAvg}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("activities");
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/api/data")
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function askCoach(question) {
    setAiLoading(true);
    setChat(prev => [...prev, { role: "user", text: question }]);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selected ? `About the activity "${selected.name}" (${selected.distance}, ${selected.pace}, ${selected.date}): ${question}` : question,
          data,
          history: chat.slice(-6),
        }),
      });
      const d = await res.json();
      setChat(prev => [...prev, { role: "assistant", text: d.reply || d.error }]);
    } catch (e) {
      setChat(prev => [...prev, { role: "assistant", text: "Error. Try again." }]);
    } finally {
      setAiLoading(false);
    }
  }

  const runs = data?.activities?.filter(a => a.type === "Run") || [];
  const latestHRV = data?.hrv?.[0];
  const latestSleep = data?.sleep?.[0];
  const avgSleep = data?.sleep?.length
    ? (data.sleep.reduce((s, d) => s + (d.duration || 0), 0) / data.sleep.length).toFixed(1)
    : "—";

  const suggestions = [
    "How is my recovery looking this week?",
    "Should I do a hard run today?",
    "How does my sleep affect my running?",
    "What does my HRV trend mean?",
    "Give me a training recommendation for this week",
  ];

  if (loading) return (
    <div style={{ background: DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 40 }}>🏃</div>
      <div style={{ color: MUTED, fontSize: 14 }}>Loading your training data...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>Error: {error}</div>
    </div>
  );

  return (
    <div style={{ background: DARK, minHeight: "100vh", color: "#fff", font​​​​​​​​​​​​​​​​
