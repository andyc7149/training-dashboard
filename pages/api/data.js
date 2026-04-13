import { getStravaActivities, formatPace, formatDuration, formatDistance } from "../../lib/strava";
import { getGarminSleep, getGarminHRV, getGarminBodyBattery } from "../../lib/garmin";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const [stravaRaw, sleep, hrv, stress] = await Promise.allSettled([
      getStravaActivities(30),
      getGarminSleep(7),
      getGarminHRV(7),
      getGarminBodyBattery(7),
    ]);

    const activities = stravaRaw.status === "fulfilled"
      ? stravaRaw.value.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          date: a.start_date_local?.slice(0, 10),
          distance: formatDistance(a.distance),
          pace: formatPace(a.average_speed),
          duration: formatDuration(a.moving_time),
          elevation: a.total_elevation_gain,
          hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          kudos: a.kudos_count,
        }))
      : [];

    res.status(200).json({
      activities,
      sleep: sleep.status === "fulfilled" ? sleep.value : [],
      hrv: hrv.status === "fulfilled" ? hrv.value : [],
      stress: stress.status === "fulfilled" ? stress.value : [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
