// expo-widgets always adds the push entitlement, even with enablePushNotifications off.
// The app never uses push, and free Apple teams can't sign an app that has it.
// It sits before expo-widgets in app.json because mods run in reverse plugin order.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
