const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const firebase =
    process.env.GOOGLE_SERVICES_JSON ||
    path.join(__dirname, 'google-services.json');
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const allowLan = process.env.ARCHAI_ALLOW_LAN_HTTP === 'true';
  return {
    ...config,
    plugins: [
      ...(config.plugins || []).filter(
        (p) => (Array.isArray(p) ? p[0] : p) !== 'expo-build-properties',
      ),
      [
        'expo-build-properties',
        { android: { usesCleartextTraffic: allowLan } },
      ],
    ],
    android: {
      ...config.android,
      ...(fs.existsSync(firebase) ? { googleServicesFile: firebase } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
