const {
  withAndroidManifest,
  withInfoPlist,
  withAppBuildGradle,
} = require("expo/config-plugins");
module.exports = function withSecurity(config) {
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$["android:allowBackup"] = "false";
    app.$["android:fullBackupContent"] = "false";
    app.$["android:usesCleartextTraffic"] = "false";
    return c;
  });
  config = withInfoPlist(config, (c) => {
    c.modResults.NSAppTransportSecurity = {
      ...c.modResults.NSAppTransportSecurity,
      NSAllowsArbitraryLoads: false,
    };
    delete c.modResults.NSMicrophoneUsageDescription;
    return c;
  });
  config = withAppBuildGradle(config, (c) => {
    c.modResults.contents = c.modResults.contents.replace(
      /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1// Release signing must be supplied by the protected build service.",
    );
    return c;
  });
  return config;
};
