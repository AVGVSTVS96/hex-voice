const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, (entitlements) => {
    delete entitlements.modResults["aps-environment"];

    return entitlements;
  });
};
