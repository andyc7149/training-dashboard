import GarminConnect from "garmin-connect";

let client = null;

async function getGarminClient() {
  if (client) return client;
  const GCClient = new GarminConnect.GarminConnect({
    username: process.env.GARMIN_EMAIL,
    password: process.env.GARMIN_PASSWORD,
  });
  await GCClient.login(process.env.GARMIN_EMAIL, process.env.GARMIN_PASSWORD);
  client = GCClient;
  return client;
}

export async function getGarminSleep(days = 7) {
  try {
    const gc = await getGarminClient();
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      try {
        const sleep = await gc.getSleepData(date);
        if (sleep?.dailySleepDTO) {
          results.push({
            date: dateStr,
            duration: sleep.dailySleepDTO.sleepTimeSeconds
              ? Math.round(sleep.dailySleepDTO.sleepTimeSeconds / 3600 * 10) / 10
              : null,
            score: sleep.dailySleepDTO.sleepScores?.overall?.value || null,
            deep: sleep.dailySleepDTO.deepSleepSeconds
              ? Math.round(sleep.dailySleepDTO.deepSleepSeconds / 60)
              : null,
            rem: sleep.dailySleepDTO.remSleepSeconds
              ? Math.round(sleep.dailySleepDTO.remSleepSeconds / 60)
              : null,
            light: sleep.dailySleepDTO.lightSleepSeconds
              ? Math.round(sleep.dailySleepDTO.lightSleepSeconds / 60)
              : null,
          });
        }
      } catch (e) {}
    }
    return results;
  } catch (e) {
    return [];
  }
}

export async function getGarminHRV(days = 7) {
  try {
    const gc = await getGarminClient();
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      try {
        const hrv = await gc.getHrvData(date);
        if (hrv?.hrvSummary) {
          results.push({
            date: dateStr,
            weeklyAvg: hrv.hrvSummary.weeklyAvg || null,
            lastNight: hrv.hrvSummary.lastNight || null,
            status: hrv.hrvSummary.status || null,
          });
        }
      } catch (e) {}
    }
    return results;
  } catch (e) {
    return [];
  }
}

export async function getGarminBodyBattery(days = 7) {
  try {
    const gc = await getGarminClient();
    const results = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      try {
        const stress = await gc.getStressData(date);
        results.push({
          date: dateStr,
          avgStress: stress?.avgStressLevel || null,
          maxStress: stress?.maxStressLevel || null,
        });
      } catch (e) {}
    }
    return results;
  } catch (e) {
    return [];
  }
}
