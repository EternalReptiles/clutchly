// Expo config. Static settings are in app.json; the name, identifiers and version come from brand.json so the
// app name is a single value. (Expo passes app.json in as `config`.)
import type { ConfigContext, ExpoConfig } from 'expo/config';
import brand from './brand.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const name = brand.name;
  return {
    ...config,
    name, slug: brand.slug, scheme: brand.scheme, version: brand.version,
    ios: {
      ...config.ios,
      bundleIdentifier: brand.iosBundleId,
      config: { usesNonExemptEncryption: false }, // only standard HTTPS: no export-compliance paperwork
      infoPlist: { ...config.ios?.infoPlist, ITSAppUsesNonExemptEncryption: false },
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
          { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        ],
      },
    },
    android: {
      ...config.android,
      package: brand.androidPackage,
      blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW'],
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-camera', {
        cameraPermission: `${name} uses the camera to photograph your animals and scan their QR labels.`,
        microphonePermission: false, recordAudioAndroid: false,
      }],
      ['expo-image-picker', {
        photosPermission: `${name} uses your photos so you can add pictures of your animals.`,
        cameraPermission: `${name} uses the camera to photograph your animals and scan their QR labels.`,
        microphonePermission: false,
      }],
    ],
    extra: { ...config.extra, eas: { ...(config.extra?.eas ?? {}) } },
    // The web app is published under a path of the website (e.g. /app); scripts/build_web.mjs sets WEB_BASE_URL.
    ...(process.env.WEB_BASE_URL ? { experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } } : {}),
  };
};
