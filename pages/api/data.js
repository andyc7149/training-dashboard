const ATHLETE_ID = process.env.INTERVALS_ATHLETE_ID;
const API_KEY = process.env.INTERVALS_API_KEY;
const BASE = "https://intervals.icu/api/v1/athlete/" + ATHLETE_ID;
const AUTH = "Basic " + Buffer.from("API_KEY:" + API_KEY).toString("base64");

async function fetchIntervals(path) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: AUTH, Accept: "application/json" },
  });
  return res.json();
}

function formatPace(metersPerSecond) {
  if (!metersPerSecond) return "--";
  const secsPerKm = 1000 / metersPerSecond;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60).toString().padStart(2, "0");
  return mins + ":" + secs + "/km";
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sydneyOffset = 11 * 60;
    const sydneyNow = new Date(new Date().getTime() + sydneyOffset * 60 * 1000);
    const todayStr = sydneyNow.toISOString().split("T")[0];
    const tomorrowDate = new Date(sydneyNow);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 365);
    const oldestStr = oldest.toISOString().split("T")[0];

    const [activitiesRaw, wellnessRaw, eventsRaw] = await Promise.all([
      fetchIntervals("/activities?oldest=" + oldestStr + "&limit=400"),
      fetchIntervals("/wellness?oldest=" + oldestStr + "&newest=" + tomorrowStr),
      fetchIntervals("/events?oldest=" + todayStr + "&newest=" + tomorrowStr),
    ]);

    const activities = Array.isArray(activitiesRaw) ? activitiesRaw.map(function(a) {
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        date: a.start_date_local ? a.start_date_local.slice(0, 10) : a.id,
        distance: a.distance ? (a.distance / 1000).toFixed(2) + " km" : "--",
        distanceRaw: a.distance || 0,
        pace: formatPace(a.average_speed),
        speedRaw: a.average_speed || 0,
        duration: a.moving_time ? formatDuration(a.moving_time) : "--",
        elevation: a.total_elevation_gain ? a.total_elevation_gain + "m" : "--",
        elevationRaw: a.total_elevation_gain || 0,
        hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
        load: a.load || null,
      };
    }) : [];

    var sleep = [];
    var hrvRaw = [];
    var restingHR = [];
    var fitness = null;

    if (Array.isArray(wellnessRaw)) {
      var sorted = wellnessRaw.slice().reverse();
      sorted.forEach(function(w) {
        var sleepDuration = null;
        if (w.sleepSecs) sleepDuration = Math.round(w.sleepSecs / 3600 * 10) / 10;
        else if (w.sleepSeconds) sleepDuration = Math.round(w.sleepSeconds / 3600 * 10) / 10;
        else if (w.sleep) sleepDuration = w.sleep;

        if (sleepDuration || w.sleepScore) {
          sleep.push({
            date: w.id,
            duration: sleepDuration,
            score: w.sleepScore || null,
            deep: w.sleepDeepSecs ? Math.round(w.sleepDeepSecs / 60) : w.sleepDeepSeconds ? Math.round(w.sleepDeepSeconds / 60) : null,
            rem: w.sleepRemSecs ? Math.round(w.sleepRemSecs / 60) : w.sleepRemSeconds ? Math.round(w.sleepRemSeconds / 60) : null,
          });
        }

        var hrvVal = w.hrvNight || w.hrv4Training || w.hrv || null;
        if (hrvVal) hrvRaw.push({ date: w.id, lastNight: hrvVal });

        if (w.restingHR) restingHR.push({ date: w.id, value: w.restingHR });

        if (!fitness && (w.ctl || w.atl)) {
          fitness = {
            ctl: w.ctl ? Math.round(w.ctl) : null,
            atl: w.atl ? Math.round(w.atl) : null,
            form: (w.ctl && w.atl) ? Math.round(w.ctl - w.atl) : null,
            date: w.id,
          };
        }
      });
    }

    var hrv = hrvRaw.map(function(h, i) {
      var window = hrvRaw.slice(i, i + 14);
      var avg = window.reduce(function(s, x) { return s + x.lastNight; }, 0) / window.length;
      return {
        date: h.date,
        lastNight: h.lastNight,
        weeklyAvg: Math.round(avg),
        status: h.lastNight >= Math.round(avg) * 0.95 ? "BALANCED" : "UNBALANCED",
      };
    });

    // Get today's planned workout — pick first Run type event, fall back to any event
    var todayWorkout = null;
    if (Array.isArray(eventsRaw) && eventsRaw.length > 0) {
      var runEvent = eventsRaw.find(function(e) {
        return e.type === "Run" || e.type === "VirtualRun" || e.type === "TrailRun";
      });
      var anyEvent = eventsRaw.find(function(e) {
        return e.category === "WORKOUT" && e.start_date_local && e.start_date_local.slice(0, 10) === todayStr;
      });
      var chosen = runEvent || anyEvent || eventsRaw[0];
      if (chosen) {
        todayWorkout = {
          name: chosen.name || "Workout",
          description: chosen.description || "",
          type: chosen.type || "Run",
          date: chosen.start_date_local ? chosen.start_date_local.slice(0, 10) : todayStr,
          duration: chosen.moving_time ? formatDuration(chosen.moving_time) : null,
          distance: chosen.distance > 0 ? (chosen.distance / 1000).toFixed(1) + " km" : null,
        };
      }
    }

    res.status(200).json({
      activities: activities,
      sleep: sleep.slice(0, 7),
      hrv: hrv.slice(0, 14),
      restingHR: restingHR.slice(0, 14),
      stress: [],
      fitness: fitness,
      todayWorkout: todayWorkout,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
