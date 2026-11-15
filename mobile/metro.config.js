const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Reviewed against Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/config/metro/
// Automatic monorepo discovery requires package-manager workspaces. This repo
// has independent web/mobile lockfiles, so explicitly expose shared source only.
// Watch only the parent folders the app imports. Watching the repo root also
// crawls mobile/node_modules again as ../mobile/node_modules, and TreeFS then
// treats a package such as braces as both a file and a directory.
config.watchFolders = [
  path.resolve(__dirname, "../shared"),
  path.resolve(__dirname, "../src"),
];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
module.exports = config;
