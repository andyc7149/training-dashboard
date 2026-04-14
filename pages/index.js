import { useState, useEffect, useRef } from "react";

var ORANGE = "#FC4C02";
var DARK = "#0a0a0a";
var CARD = "#161616";
var BORDER = "#222";
var MUTED = "#666";
var GREEN = "#22c55e";
var BLUE = "#3b82f6";
var PURPLE = "#a855f7";
var YELLOW = "#eab308";
var RED = "#ef4444";

var CACHE_KEY = "andy_training_cache";
var CACHE_TTL = 30 * 60 * 1000;
var CHAT_KEY = "andy_coach_chat";

function saveCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() }));
  } catch(e) {}
}

function loadCache() {
  try {
    var raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed.data;
  } catch(e) { return null; }
}

function saveChat(chat) {
  try {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat));
  } catch(e) {}
}

function loadChat() {
  try {
    var raw = sessionStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function isRun(a) {
  return a.type === "Run" || a.type === "VirtualRun" || a.type === "TrailRun";
}

function getReadiness(hrv, sleep, activities) {
  var score = 0;
  var factors = 0;

  if (hrv && hrv.length > 0) {
    var latest = hrv[0].lastNight;
    var avg = hrv.reduce(function(s, h) { return s + (h.lastNight || 0); }, 0) / hrv.length;
    if (avg > 0) {
      var ratio = latest / avg;
      var hrvScore = ratio * 35;
      score += Math.min(35, Math.max(0, hrvScore));

      if (hrv.length >= 3) {
        var recent3 = hrv.slice(0, 3).map(function(h) { return h.lastNight || 0; });
        var trend = recent3[0] - recent3[2];
        if (trend > 5) score += 5;
        else if (trend < -5) score -= 5;
      }
      factors++;
    }
  }

  if (sleep && sleep.length > 0) {
    var s = sleep[0];
    var sleepScore = 0;
    if (s.duration) {
      sleepScore += s.duration >= 8 ? 18 : s.duration >= 7 ? 14 : s.duration >= 6 ? 8 : 3;
    }
    if (s.score) {
      sleepScore += s.score >= 80 ? 17 : s.score >= 60 ? 12 : s.score >= 40 ? 6 : 2;
    } else if (s.duration) {
      sleepScore = sleepScore * 2;
    }
    score += Math.min(35, sleepScore);
    factors++;
  }

  if (activities && activities.length > 0) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    var sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    var recentRuns = activities.filter(function(a) {
      return isRun(a) && new Date(a.date) >= sevenDaysAgo;
    });

    var recentLoad = recentRuns.reduce(function(s, a) { return s + (a.load || 0); }, 0);
    var loadScore = recentLoad < 150 ? 20 : recentLoad < 300 ? 17 : recentLoad < 450 ? 13 : recentLoad < 600 ? 8 : 3;
    score += loadScore;

    var consecutiveDays = 0;
    for (var i = 0; i < 7; i++) {
      var checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      var dateStr = checkDate.toISOString().split("T")[0];
      var hasRun = recentRuns.some(function(a) { return a.date === dateStr; });
      if (hasRun) { consecutiveDays++; } else { break; }
    }
    if (consecutiveDays >= 4) score -= 8;
    else if (consecutiveDays >= 3) score -= 4;

    var yesterdayStr = yesterday.toISOString().split("T")[0];
    var hardYesterday = activities.some(function(a) {
      return a.date === yesterdayStr && isRun(a) && (a.load || 0) > 120;
    });
    if (hardYesterday) score -= 6;

    factors++;
  }

  if (factors === 0) return null;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getReadinessLabel(score) {
  if (score === null) return { label: "No data", color: MUTED, advice: "Connect Garmin sleep and HRV for readiness scoring" };
  if (score >= 78) return { label: "Ready to Train Hard", color: GREEN, advice: "Excellent recovery. Push it today." };
  if (score >= 58) return { label: "Moderate - Train Easy", color: YELLOW, advice: "Decent recovery. Keep intensity moderate." };
  if (score >= 40) return { label: "Easy Running Only", color: ORANGE, advice: "Below average recovery. Keep it very easy." };
  return { label: "Rest Today", color: RED, advice: "Your body needs recovery. Rest or walk today." };
}

function getFormLabel(form) {
  if (form === null || form === undefined) return { label: "--", color: MUTED };
  if (form > 20) return { label: "Fresh", color: BLUE };
  if (form > -5) return { label: "Optimal", color: GREEN };
  if (form > -20) return { label: "Productive", color: YELLOW };
  if (form > -30) return { label: "Tired", color: ORANGE };
  return { label: "Very Tired", color: RED };
}

function getWeeklyStats(activities) {
  var weeks = [];
  for (var w = 0; w < 12; w++) {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    var weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday - (w * 7));
    weekStart.setHours(0, 0, 0, 0);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    var weekActivities = activities.filter(function(a) {
      var d = new Date(a.date);
      return d >= weekStart && d < weekEnd && isRun(a);
    });
    var km = weekActivities.reduce(function(s, a) { return s + (a.distanceRaw || 0); }, 0) / 1000;
    weeks.push({
      label: w === 0 ? "This week" : w === 1 ? "Last week" : weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      km: Math.round(km * 10) / 10,
      runs: weekActivities.length,
    });
  }
  return weeks.reverse();
}

function BarChart(props) {
  var data = props.data;
  var max = Math.max.apply(null, data.map(function(d) { return d.km; })) || 1;
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>{props.title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
        {data.map(function(d, i) {
          var height = Math.max(2, (d.km / max) * 80);
          var isRecent = i >= data.length - 2;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 8, color: MUTED }}>{d.km > 0 ? d.km : ""}</div>
              <div style={{ width: "100%", height: height, background: isRecent ? ORANGE : "#333", borderRadius: 2 }}></div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {data.map(function(d, i) {
          return (
            <div key={i} style={{ flex: 1, fontSize: 7, color: MUTED, textAlign: "center", overflow: "hidden" }}>
              {i % 3 === 0 ? d.label.slice(0, 6) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadinessCard(props) {
  var score = props.score;
  var info = getReadinessLabel(score);
  var circumference = 2 * Math.PI * 30;
  var progress = score !== null ? (score / 100) * circumference : 0;
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "16px", border: "1px solid " + BORDER, margin: "12px 16px" }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Today's Readiness</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="#222" strokeWidth="8" />
          <circle cx="40" cy="40" r="30" fill="none" stroke={info.color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={circumference - progress}
            strokeLinecap="round" transform="rotate(-90 40 40)" />
          <text x="40" y="44" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">
            {score !== null ? score : "--"}
          </text>
        </svg>
        <div>
          <div style={{ fontSize: 15, fontWeight: "bold", color: info.color, marginBottom: 4 }}>{info.label}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{info.advice}</div>
        </div>
      </div>
    </div>
  );
}

function FitnessCard(props) {
  var f = props.fitness;
  if (!f) return null;
  var formInfo = getFormLabel(f.form);
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "16px", border: "1px solid " + BORDER, margin: "0 16px 12px" }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Fitness / Fatigue / Form</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Fitness</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: BLUE }}>{f.ctl || "--"}</div>
          <div style={{ fontSize: 10, color: MUTED }}>CTL</div>
        </div>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Fatigue</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: ORANGE }}>{f.atl || "--"}</div>
          <div style={{ fontSize: 10, color: MUTED }}>ATL</div>
        </div>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Form</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: formInfo.color }}>{f.form !== null ? (f.form > 0 ? "+" : "") + f.form : "--"}</div>
          <div style={{ fontSize: 10, color: formInfo.color }}>{formInfo.label}</div>
        </div>
      </div>
    </div>
  );
}

function WeekCompare(props) {
  var weeks = props.weeks;
  if (!weeks || weeks.length < 2) return null;
  var thisWeek = weeks[weeks.length - 1];
  var lastWeek = weeks[weeks.length - 2];
  var diff = Math.round((thisWeek.km - lastWeek.km) * 10) / 10;
  var diffColor = diff >= 0 ? GREEN : RED;
  return (
    <div style={{ background: CARD, borderRadius: 12, padding: "16px", border: "1px solid " + BORDER, margin: "0 16px 12px" }}>
      <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Weekly Summary</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>This week</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: ORANGE }}>{thisWeek.km}<span style={{ fontSize: 12, color: MUTED }}> km</span></div>
          <div style={{ fontSize: 11, color: MUTED }}>{thisWeek.runs} runs</div>
        </div>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Last week</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff" }}>{lastWeek.km}<span style={{ fontSize: 12, color: MUTED }}> km</span></div>
          <div style={{ fontSize: 11, color: MUTED }}>{lastWeek.runs} runs</div>
        </div>
        <div style={{ flex: 1, background: DARK, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Change</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: diffColor }}>{diff >= 0 ? "+" : ""}{diff}</div>
          <div style={{ fontSize: 10, color: diffColor }}>{diff >= 0 ? "more" : "less"} km</div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow(props) {
  var a = props.a;
  return (
    <div onClick={props.onClick} style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid " + BORDER, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>{a.type} - {a.name}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{a.date} - {a.duration}</div>
        {a.hr ? <div style={{ fontSize: 11, color: MUTED }}>HR: {a.hr}bpm {a.elevationRaw > 0 ? "- Elev: " + a.elevationRaw + "m" : ""}</div> : null}
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
  var scoreColor = s.score >= 80 ? GREEN : s.score >= 60 ? YELLOW : RED;
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
  var statusColor = h.status === "BALANCED" ? GREEN : h.status === "UNBALANCED" ? YELLOW : MUTED;
  return (
    <div style={{ background: CARD, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid " + BORDER, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>HRV {h.date}</div>
        <div style={{ fontSize: 11, color: statusColor }}>{h.status || ""}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: "bold", color: PURPLE }}>{h.lastNight} ms</div>
        <div style={{ fontSize: 11, color: MUTED }}>14d avg: {h.weeklyAvg || "--"}</div>
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
  var stateTab = useState("home");
  var tab = stateTab[0];
  var setTab = stateTab[1];
  var stateChat = useState(function() { return loadChat(); });
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
  var stateFilter = useState("All");
  var filter = stateFilter[0];
  var setFilter = stateFilter[1];
  var stateFromCache = useState(false);
  var fromCache = stateFromCache[0];
  var setFromCache = stateFromCache[1];
  var chatEndRef = useRef(null);

  useEffect(function() {
    var cached = loadCache();
    if (cached) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
      fetch("/api/data")
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (!d.error) { setData(d); saveCache(d); }
        })
        .catch(function() {});
    } else {
      fetch("/api/data")
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.error) throw new Error(d.error);
          setData(d);
          saveCache(d);
        })
        .catch(function(e) { setError(e.message); })
        .finally(function() { setLoading(false); });
    }
  }, []);

  useEffect(function() {
    saveChat(chat);
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat]);

  function askCoach(question) {
    setAiLoading(true);
    var newChat = chat.concat([{ role: "user", text: question }]);
    setChat(newChat);
    setInput("");
    var q = selected ? "About " + selected.name + " (" + selected.date + ", " + selected.distance + ", " + selected.pace + "): " + question : question;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, data: data, history: newChat.slice(-10) }),
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

  function clearChat() {
    setChat([]);
    saveChat([]);
  }

  var allActivities = data && data.activities ? data.activities : [];
  var runs = allActivities.filter(isRun);
  var filteredActivities = filter === "All" ? allActivities : allActivities.filter(function(a) { return a.type === filter; });
  var readinessScore = data ? getReadiness(data.hrv, data.sleep, allActivities) : null;
  var weeklyData = allActivities.length > 0 ? getWeeklyStats(allActivities) : [];

  var avgSleepVal = "--";
  if (data && data.sleep && data.sleep.length > 0) {
    var total = data.sleep.reduce(function(s, d) { return s + (d.duration || 0); }, 0);
    avgSleepVal = (total / data.sleep.length).toFixed(1);
  }
  var hrvAvg14 = "--";
  if (data && data.hrv && data.hrv.length > 0) {
    var hrvTotal = data.hrv.reduce(function(s, h) { return s + (h.lastNight || 0); }, 0);
    hrvAvg14 = Math.round(hrvTotal / data.hrv.length);
  }

  var activityTypes = ["All", "Run", "TrailRun", "VirtualRun", "Ride", "Swim", "Walk", "Hike"];
  var suggestions = [
    "How is my recovery looking this week?",
    "Should I do a hard run today?",
    "How does my sleep affect my running?",
    "What does my HRV and form score mean?",
    "Give me a training plan for this week",
    "How fit am I compared to 3 months ago?",
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
        <div style={{ color: RED, fontSize: 14, textAlign: "center" }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif", maxWidth: 500, margin: "0 auto", paddingBottom: 90 }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid " + BORDER, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: ORANGE, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Andy Training</div>
          <div style={{ fontSize: 22, fontWeight: "800" }}>Dashboard</div>
        </div>
        {fromCache && <div style={{ fontSize: 10, color: MUTED }}>Cached</div>}
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid " + BORDER, overflowX: "auto" }}>
        {[{ key: "home", label: "Home" }, { key: "activities", label: "Runs" }, { key: "recovery", label: "Recovery" }, { key: "coach", label: "Coach" }].map(function(t) {
          return (
            <button key={t.key} onClick={function() { setTab(t.key); }} style={{ flex: "0 0 auto", padding: "11px 16px", background: "none", border: "none", color: tab === t.key ? ORANGE : MUTED, borderBottom: tab === t.key ? "2px solid " + ORANGE : "2px solid transparent", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "home" && (
        <div style={{ paddingTop: 8 }}>
          <ReadinessCard score={readinessScore} />
          <div style={{ padding: "0 16px 12px", display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: CARD, borderRadius: 10, padding: "12px", border: "1px solid " + BORDER }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Runs (yr)</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: ORANGE }}>{runs.length}</div>
            </div>
            <div style={{ flex: 1, background: CARD, borderRadius: 10, padding: "12px", border: "1px solid " + BORDER }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Avg Sleep</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: BLUE }}>{avgSleepVal}<span style={{ fontSize: 12, color: MUTED }}>h</span></div>
            </div>
            <div style={{ flex: 1, background: CARD, borderRadius: 10, padding: "12px", border: "1px solid " + BORDER }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>14d HRV</div>
              <div style={{ fontSize: 22, fontWeight: "bold", color: PURPLE }}>{hrvAvg14}<span style={{ fontSize: 12, color: MUTED }}>ms</span></div>
            </div>
          </div>
          <FitnessCard fitness={data && data.fitness} />
          <WeekCompare weeks={weeklyData} />
          {weeklyData.length > 0 && (
            <div style={{ background: CARD, borderRadius: 12, border: "1px solid " + BORDER, margin: "0 16px 12px" }}>
              <BarChart title="Weekly km (12 weeks)" data={weeklyData} />
            </div>
          )}
        </div>
      )}

      {tab === "activities" && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {activityTypes.map(function(type) {
              return (
                <button key={type} onClick={function() { setFilter(type); }} style={{ flex: "0 0 auto", padding: "6px 12px", background: filter === type ? ORANGE : CARD, border: "1px solid " + (filter === type ? ORANGE : BORDER), borderRadius: 20, color: "#fff", fontSize: 11, cursor: "pointer" }}>
                  {type}
                </button>
              );
            })}
          </div>
          {filteredActivities.map(function(a, i) {
            return <ActivityRow key={a.id || i} a={a} onClick={function() { setSelected(a); setTab("coach"); }} />;
          })}
        </div>
      )}

      {tab === "recovery" && (
        <div style={{ padding: "12px 16px" }}>
          {data && data.sleep && data.sleep.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sleep (last 7 days)</div>
              {data.sleep.map(function(s, i) { return <SleepRow key={i} s={s} />; })}
            </div>
          )}
          {data && data.hrv && data.hrv.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>HRV (last 14 days)</div>
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
          {chat.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={clearChat} style={{ background: "none", border: "1px solid " + BORDER, borderRadius: 8, padding: "4px 10px", color: MUTED, fontSize: 11, cursor: "pointer" }}>
                Clear chat
              </button>
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
          <div ref={chatEndRef}></div>
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
