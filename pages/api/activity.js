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
  if (!metersPerSecond || metersPerSecond <= 0) return "--";
  const secsPerKm = 1000 / metersPerSecond;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60).toString().padStart(2, "0");
  return mins + ":" + secs + "/km";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Activity ID required" });

  const activityId = String(id).replace(/^i/, "");
  console.log("Fetching activity ID:", activityId);

  try {
    const [activity, streams] = await Promise.allSettled([
      fetchIntervals("/activities/" + activityId),
      fetchIntervals("/activities/" + activityId + "/streams?stream_types=distance,time,heartrate,altitude"),
    ]);

    const act = activity.status === "fulfilled" ? activity.value : null;
    if (!act || act.error) return res.status(404).json({ error: "Activity not found" });

    var splits = [];
    if (streams.status === "fulfilled" && streams.value && !streams.value.error) {
      const s = streams.value;
      const distances = s.distance || [];
      const times = s.time || [];
      const heartrates = s.heartrate || [];
      const altitudes = s.altitude || [];

      if (distances.length > 0) {
        var currentKm = 1;
        var kmStart = 0;
        var kmStartTime = 0;
        var kmHRs = [];
        var kmAlts = [];

        for (var i = 0; i < distances.length; i++) {
          var distKm = distances[i] / 1000;
          if (heartrates[i]) kmHRs.push(heartrates[i]);
          if (altitudes[i]) kmAlts.push(altitudes[i]);

          if (distKm >= currentKm || i === distances.length - 1) {
            var elapsed = (times[i] || 0) - kmStartTime;
            var distCovered = distances[i] - kmStart;
            var avgSpeed = distCovered > 0 && elapsed > 0 ? distCovered / elapsed : 0;
            var avgHR = kmHRs.length > 0 ? Math.round(kmHRs.reduce(function(a, b) { return a + b; }, 0) / kmHRs.length) : null;
            var elevGain = 0;
            var elevLoss = 0;
            for (var j = 1; j < kmAlts.length; j++) {
              var diff = kmAlts[j] - kmAlts[j-1];
              if (diff > 0) elevGain += diff; else elevLoss += Math.abs(diff);
            }
            splits.push({
              km: currentKm,
              pace: formatPace(avgSpeed),
              hr: avgHR,
              elevGain: Math.round(elevGain),
              elevLoss: Math.round(elevLoss),
            });
            currentKm++;
            kmStart = distances[i];
            kmStartTime = times[i] || 0;
            kmHRs = [];
            kmAlts = [];
          }
        }
      }
    }

    var intervals = [];
    if (act.intervals && Array.isArray(act.intervals)) {
      intervals = act.intervals.map(function(iv) {
        return {
          label: iv.label || ("Interval " + (iv.number || "")),
          distance: iv.distance ? (iv.distance / 1000).toFixed(2) + " km" : "--",
          pace: formatPace(iv.avg_speed),
          hr: iv.avg_hr ? Math.round(iv.avg_hr) : null,
          type: iv.type || null,
        };
      });
    }

    var bestEfforts = [];
    if (act.best_efforts && Array.isArray(act.best_efforts)) {
      bestEfforts = act.best_efforts.slice(0, 6).map(function(b) {
        return { name: b.name, pace: formatPace(b.avg_speed), hr: b.avg_hr ? Math.round(b.avg_hr) : null };
      });
    }

    res.status(200).json({
      id: act.id,
      name: act.name,
      type: act.type,
      date: act.start_date_local ? act.start_date_local.slice(0, 10) : null,
      distance: act.distance ? (act.distance / 1000).toFixed(2) + " km" : "--",
      avgPace: formatPace(act.average_speed),
      avgHR: act.average_heartrate ? Math.round(act.average_heartrate) : null,
      maxHR: act.max_heartrate ? Math.round(act.max_heartrate) : null,
      elevGain: act.total_elevation_gain || 0,
      load: act.load || null,
      description: act.description || null,
      splits: splits,
      intervals: intervals,
      bestEfforts: bestEfforts,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
