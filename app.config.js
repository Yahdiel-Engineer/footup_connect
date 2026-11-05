// app.config.js — reprend app.json et l'adapte à l'installation sur iPhone sans compte payant.
// IOS_SIDELOAD=1 (build GitHub Actions + Sideloadly) : un identifiant Apple gratuit ne peut pas
// signer une app qui demande les notifications push, on retire donc expo-notifications.
module.exports = ({ config }) => {
  if (process.env.IOS_SIDELOAD !== '1') return config;
  return {
    ...config,
    plugins: (config.plugins || []).filter(p => (Array.isArray(p) ? p[0] : p) !== 'expo-notifications'),
  };
};
