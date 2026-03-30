const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require("@expo/config-plugins");

function withAndroidAdMobAppId(config, androidAppId) {
  if (!androidAppId) {
    return config;
  }

  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults;
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);

    const mainApplication =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    mainApplication["meta-data"] = mainApplication["meta-data"] ?? [];

    const existingItem = mainApplication["meta-data"].find(
      (item) =>
        item.$["android:name"] === "com.google.android.gms.ads.APPLICATION_ID",
    );

    if (existingItem) {
      existingItem.$["android:value"] = androidAppId;
      existingItem.$["tools:replace"] = "android:value";
    } else {
      mainApplication["meta-data"].push({
        $: {
          "android:name": "com.google.android.gms.ads.APPLICATION_ID",
          "android:value": androidAppId,
          "tools:replace": "android:value",
        },
      });
    }

    return manifestConfig;
  });
}

function withIosAdMobAppId(config, iosAppId) {
  if (!iosAppId) {
    return config;
  }

  return withInfoPlist(config, (infoPlistConfig) => {
    infoPlistConfig.modResults.GADApplicationIdentifier = iosAppId;
    return infoPlistConfig;
  });
}

function withAdMobAppIds(config, props = {}) {
  const { androidAppId, iosAppId } = props;

  let nextConfig = config;
  nextConfig = withAndroidAdMobAppId(nextConfig, androidAppId);
  nextConfig = withIosAdMobAppId(nextConfig, iosAppId);

  return nextConfig;
}

module.exports = createRunOncePlugin(
  withAdMobAppIds,
  "with-admob-app-ids",
  "1.0.0",
);
