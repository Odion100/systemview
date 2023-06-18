const http = require("http");

module.exports = async function appIsRunning(appUrls) {
  let allAppsRunning = true;
  const pingApps = appUrls.map(
    (url) =>
      new Promise((resolve, reject) => {
        http.get(url, resolve).on("error", reject);
      })
  );
  try {
    const responses = await Promise.all(pingApps);
    responses.forEach((res, index) => {
      if (res.statusCode !== 200) {
        allAppsRunning = false;
        console.log(`App ${index + 1} is not running`);
      }
    });
  } catch (err) {
    console.error("Error pinging apps:", err.message);
    allAppsRunning = false;
  }

  return allAppsRunning;
};
