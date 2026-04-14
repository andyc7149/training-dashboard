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
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 365);
    const oldestStr = oldest.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const [activitiesRaw, wellnessRaw] = await Promise.all([
      fetchIntervals("/activities?oldest=" + oldestStr + "&limit=400"),
      fetchIntervals("/wellness?oldest=" + oldestStr + "&newest=" + todayStr),
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
      };
    }) : [];

    var sleep = [];
    var hrv = [];

    if (Array.isArray(wellnessRaw)) {
      wellnessRaw.slice().reverse().forEach(function(w) {
        var sleepDuration = null;
        if (w.sleepSecs) {
          sleepDuration = Math.round(w.sleepSecs / 3600 * 10) / 10;
        } else if (w.sleepSeconds) {
          sleepDuration = Math.round(w.sleepSeconds / 3600 * 10) / 10;
        } else if (w.sleep) {
          sleepDuration = w.sleep;
        }

        if (sleepDuration || w.sleepScore) {
          sleep.push({
            date: w.id,
            duration: sleepDuration,
            score: w.sleepScore || null,
            deep: w.sleepDeepSecs ? Math.round(w.sleepDeepSecs / 60)
              : w.sleepDeepSeconds ? Math.round(w.sleepDeepSeconds / 60) : null,
            rem: w.sleepRemSecs ? Math.round(w.sleepRemSecs / 60)
              : w.sleepRemSeconds ? Math.round(w.sleepRemSeconds / 60) : null,
          });
        }

        var hrvVal = w.hrvNight || w.hrv4Training || w.hrv || null;
        if (hrvVal) {
          hrv.push({
            date: w.id,
            lastNight: hrvVal,
            weeklyAvg: w.hrvNightAverage || w.hrvAverage || null,
            status: w.hrvNightAverage && hrvVal
              ? hrvVal >= w.hrvNightAverage * 0.95 ? "BALANCED" : "UNBALANCED"
              : null,
          });
        }
      });
    }

    res.status(200).json({
      activities: activities,
      sleep: sleep.slice(0, 7),
      hrv: hrv.slice(0, 14),
      stress: [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

