async function getGarminClient() {
  const loginRes = await fetch("https://connect.garmin.com/signin", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(process.env.GARMIN_EMAIL)}&password=${encodeURIComponent(process.env.GARMIN_PASSWORD)}`,
    redirect: "manual",
  });
  const cookies = loginRes.headers.get("set-cookie");
  return cookies;
}

export async function getGarminSleep(days = 7) {
  return [];
}

export async function getGarminHRV(days = 7) {
  return [];
}

export async function getGarminBodyBattery(days = 7) {
  return [];
}
