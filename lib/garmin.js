export async function getGarminSleep(days = 7) {
  try {
    const token = await getGarminToken();
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      try {
        const res = await fetch(
          `https://connect.garmin.com/wellness-service/wellness/dailySleepData/${process.env.GARMIN_EMAIL}?date=${dateStr}&nonSleepBufferMinutes=60`,
          { headers: await getGarminHeaders(token) }
        );
        const data = await res.json();
        if (data?.dailySleepDTO) {
          results.push({
            date: dateStr,
            duration: data.dailySleepDTO.sleepTimeSeconds
              ? Math.round(data.dailySleepDTO.sleepTimeSeconds / 3600 * 10) / 10
              : null,
            score: data.dailySleepDTO.sleepScores?.overall?.value || null,
            deep: data.dailySleepDTO.deepSleepSeconds
              ? Math.round(data.dailySleepDTO.deepSleepSeconds / 60) : null,
            rem: data.dailySleepDTO.remSleepSeconds
              ? Math.round(data.dailySleepDTO.remSleepSeconds / 60) : null,
          });
        }
      } catch (e) {}
    }
    return results;
  } catch (e) {
    console.error("Garmin sleep error:", e.message);
    return [];
  }
}

export async function getGarminHRV(days = 7) {
  try {
    const token = await getGarminToken();
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      try {
        const res = await fetch(
          `https://connect.garmin.com/hrv-service/hrv/${dateStr}`,
          { headers: await getGarminHeaders(token) }
        );
        const data = await res.json();
        if (data?.hrvSummary) {
          results.push({
            date: dateStr,
            weeklyAvg: data.hrvSummary.weeklyAvg || null,
            lastNight: data.hrvSummary.lastNight || null,
            status: data.hrvSummary.status || null,
          });
        }
      } catch (e) {}
    }
    return results;
  } catch (e) {
    console.error("Garmin HRV error:", e.message);
    return [];
  }
}

export async function getGarminBodyBattery(days = 7) {
  return [];
}

async function getGarminToken() {
  const params = new URLSearchParams();
  params.append("username", process.env.GARMIN_EMAIL);
  params.append("password", process.env.GARMIN_PASSWORD);
  params.append("embed", "false");

  const res = await fetch("https://connect.garmin.com/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "NK": "NT",
      "origin": "https://sso.garmin.com",
    },
    body: params.toString(),
    redirect: "manual",
  });

  const cookies = res.headers.get("set-cookie") || "";
  return cookies;
}

async function getGarminHeaders(cookies) {
  return {
    "Cookie": cookies,
    "NK": "NT",
    "X-app-ver": "4.64.0.0",
    "Di-Backend": "connectapi.garmin.com",
  };
}
