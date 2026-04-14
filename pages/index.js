import { useState, useEffect } from "react";

var ORANGE = "#FC4C02";
var DARK = "#0a0a0a";
var CARD = "#161616";
var BORDER = "#222";
var MUTED = "#666";
var GREEN = "#22c55e";
var BLUE = "#3b82f6";
var PURPLE = "#a855f7";

function StatCard(props) {
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "14px 16px", border: "1px solid " + BORDER, flex: 1 }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{props.icon}</div>
      <div style={{ fontSize: 20, fontWeight: "bold", color: props.color || "#fff" }}>
        {props.value}
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 2 }}>{props.unit}</span>
      </div>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{props.label}</div>
    </div>
  );
}

function ActivityRow(props) {
  var a = props.a;
  var icons = { Run: "Run", Ride: "Ride", Swim: "Swim", Walk: "Walk", Hike: "Hike" };
  return (
    <div onClick={props.onClick} style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid " + BORDER, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>{icons[a.type] || a.type} - {a.name}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{a.date} - {a.duration}</div>
        {a.hr ? <div style={{ fontSize: 11, color: MUTED }}>HR: {a.hr}bpm</div> : null}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: ORANGE }}>{a.distance}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{a.pace}</div>
      </div>
    </div>
  );
}

function SleepRow(props) {
  var s = props.s;
  var scoreColor = s.score >= 80 ? GREEN : s.score >= 60 ? ORANGE : "#ef4444";
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid " + BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>Sleep {s.date}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{s.deep ? "Deep: " + s.deep + "m " : ""}{s.rem ? "REM: " + s.rem + "m" : ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{s.duration}h</div>
        {s.score ? <div style={{ fontSize: 12, color: scoreColor }}>Score: {s.score}</div> : null}
      </div>
    </div>
  );
}

function HRVRow(props) {
  var h = props.h;
  var statusColor = h.status === "BALANCED" ? GREEN : h.status === "UNBALANCED" ? ORANGE : MUTED;
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid " + BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>HRV {h.date}</div>
        <div style={{ fontSize: 11, color: statusColor }}>{h.status || ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: PURPLE }}>{h.lastNight} ms</div>
        <div style={{ fontSize: 11, color: MUTED }}>7d avg: {h.weeklyAvg}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  var stateData = useState(null);
  var data = stateData[0];
  var setData = stateData[1];
  var stateLoading = useState(true);
  var loading = stateLoading[0];
  var setLoading = stateLoading[1];
  var stateError = useState(null);
  var error = stateError[0];
  var setError = stateError[1];
  var stateTab = useState("activities");
  var tab = stateTab[0];
  var setTab = stateTab[1];
  var stateChat = useState([]);
  var chat = stateChat[0];
  var setChat = stateChat[1];
  var stateInput = useState("");
  var input = stateInput[0];
  var setInput = stateInput[1];
  var stateAiLoading = useState(false);
  var aiLoading = stateAiLoading[0];
  var setAiLoading = stateAiLoading[1];
  var stateSelected = useState(null);
  var selected = stateSelected[0];
  var setSelected = stateSelected[1];

  useEffect(function() {
    fetch("/api/data")
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(function(e) { setError(e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  function askCoach(question) {
    setAiLoading(true);
    setChat(function(prev) { return prev.concat([{ role: "user", text: question }]); });
    setInput("");
    var q = selected ? "About " + selected.name + ": " + question : question;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, data: data, history: chat.slice(-6) }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setChat(function(prev) { return prev.concat([{ role: "assistant", text: d.reply || d.error }]); });
      })
      .catch(function() {
        setChat(function(prev) { return prev.concat([{ role: "assistant", text: "Error. Try again." }]); });
      })
      .finally(function() { setAiLoading(false); });
  }

  var runs = data && data.activities ? data.activities.filter(function(a) { return a.type === "Run"; }) : [];
  var latestHRV = data && data.hrv && data.hrv.length > 0 ? data.hrv[0] : null;
  var avgSleepVal = "--";
  if (data && data.sleep && data.sleep.length > 0) {
    var total = data.sleep.reduce(function(s, d) { return s + (d.duration || 0); }, 0);
    avgSleepVal = (total / data.sleep.length).toFixed(1);
  }

  var suggestions = [
    "How is my recovery looking this week?",
    "Should I do a hard run today?",
    "How does my sleep affect my running?",
    "What does my HRV trend mean?",
    "Give me a training recommendation for this week",
  ];

  if (loading) {
    return (
      <div style={{ background: DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, color: MUTED }}>Loading your training data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: DARK, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
        <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", maxWidth: 500, margin: "0 auto", paddingBottom: 90 }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid " + BORDER }}>
        <div style={{ fontSize: 10, color: ORANGE, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Andy Training</div>
        <div style={{ fontSize: 22, fontWeight: "800" }}>Dashboard</div>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, borderBottom: "1px solid " + BORDER }}>
        <StatCard icon="Run" label="Runs" value={runs.length} color={ORANGE} />
        <StatCard icon="Sleep" label="Avg Sleep" value={avgSleepVal} unit="h" color={BLUE} />
        <StatCard icon="HRV" label="HRV" value={latestHRV ? latestHRV.lastNight : "--"} unit="ms" color={PURPLE} />
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid " + BORDER }}>
        {[{ key: "activities", label: "Runs" }, { key: "recovery", label: "Recovery" }, { key: "coach", label: "Coach" }].map(function(t) {
          return (
            <button key={t.key} onClick={function() { setTab(t.key); }} style={{ flex: 1, padding: "11px 4px", background: "none", border: "none", color: tab === t.key ? ORANGE : MUTED, borderBottom: tab === t.key ? "2px solid " + ORANGE : "2px solid transparent", fontSize: 12, cursor: "pointer" }}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "activities" && (
        <div style={{ padding: "12px 16px" }}>
          {data && data.activities && data.activities.map(function(a, i) {
            return <ActivityRow key={a.id || i} a={a} onClick={function() { setSelected(a); setTab("coach"); }} />;
          })}
        </div>
      )}
      {tab === "recovery" && (
        <div style={{ padding: "12px 16px" }}>
          {data && data.sleep && data.sleep.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sleep</div>
              {data.sleep.map(function(s, i) { return <SleepRow key={i} s={s} />; })}
            </div>
          )}
          {data && data.hrv && data.hrv.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>HRV</div>
              {data.hrv.map(function(h, i) { return <HRVRow key={i} h={h} />; })}
            </div>
          )}
          {(!data || !data.sleep || data.sleep.length === 0) && (!data || !data.hrv || data.hrv.length === 0) && (
            <div style={{ textAlign: "center", padding: 40, color: MUTED, fontSize: 14 }}>No recovery data yet</div>
          )}
        </div>
      )}
      {tab === "coach" && (
        <div style={{ padding: "12px 16px" }}>
          {selected && (
            <div style={{ background: "#1a1000", border: "1px solid " + ORANGE, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: ORANGE, marginBottom: 2 }}>Asking about</div>
                <div style={{ fontSize: 13, fontWeight: "bold" }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{selected.distance} - {selected.pace}</div>
              </div>
              <button onClick={function() { setSelected(null); }} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>X</button>
            </div>
          )}
          {chat.length === 0 && (
            <div>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 12, textAlign: "center" }}>Ask your AI coach about your runs and recovery</div>
              {suggestions.map(function(s, i) {
                return (
                  <button key={i} onClick={function() { askCoach(s); }} style={{ display: "block", width: "100%", background: CARD, border: "1px solid " + BORDER, borderRadius: 10, padding: "12px 14px", color: "#ccc", fontSize: 13, cursor: "pointer", textAlign: "left", marginBottom: 8 }}>
                    {s}
                  </button>
                );
              })}
            </div>
          )}
          {chat.map(function(m, i) {
            return (
              <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ maxWidth: "85%", background: m.role === "user" ? ORANGE : CARD, borderRadius: "16px", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, color: "#fff", border: m.role === "assistant" ? "1px solid " + BORDER : "none" }}>
                  {m.text}
                </div>
              </div>
            );
          })}
          {aiLoading && (
            <div style={{ display: "flex" }}>
              <div style={{ background: CARD, borderRadius: "16px", padding: "10px 14px", fontSize: 13, color: MUTED, border: "1px solid " + BORDER }}>Thinking...</div>
            </div>
          )}
        </div>
      )}
      {tab === "coach" && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 500, background: "#0a0a0a", borderTop: "1px solid " + BORDER, padding: "10px 16px", display: "flex", gap: 8 }}>
          <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter" && input.trim() && !aiLoading) { askCoach(input.trim()); } }} placeholder="Ask your coach..." style={{ flex: 1, background: CARD, border: "1px solid " + BORDER, borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none" }} />
          <button onClick={function() { if (input.trim() && !aiLoading) { askCoach(input.trim()); } }} disabled={aiLoading || !input.trim()} style={{ background: ORANGE, border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", fontSize: 16, cursor: "pointer", opacity: aiLoading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      )}
    </div>
  );
}
