export async function getStravaAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get Strava token");
  return data.access_token;
}

export async function getStravaActivities(count = 30) {
  const token = await getStravaAccessToken();
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${count}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Failed to fetch activities");
  return data;
}

export function formatPace(metersPerSecond) {
  if (!metersPerSecond) return "—";
  const secsPerKm = 1000 / metersPerSecond;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60).toString().padStart(2, "0");
  return `${mins}:${secs}/km`;
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDistance(meters) {
  return (meters / 1000).toFixed(2) + " km";
}
