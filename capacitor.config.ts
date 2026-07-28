import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell. The app bundles a COPY of the built game (dist/) rather
 * than loading the website — Apple rejects apps that are just a wrapped
 * remote URL, and bundling means the game works offline. The consequence:
 * game changes reach the app only through a sync (`npm run ios`), never
 * automatically.
 *
 * The appId is the iOS bundle identifier. Changing it later means a new app
 * as far as Apple is concerned, so it should be settled before the first
 * App Store upload.
 */
const config: CapacitorConfig = {
  appId: "com.davengai.monstermuncher",
  appName: "Monster Muncher",
  webDir: "dist",
  ios: {
    // The game draws its own cream page edge to edge; letting the webview
    // scroll would rubber-band the whole world on drag.
    scrollEnabled: false,
    backgroundColor: "#fff4da",
  },
};

export default config;
