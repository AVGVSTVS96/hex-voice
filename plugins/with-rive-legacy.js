const { withPodfile } = require('expo/config-plugins');

module.exports = function withRiveLegacy(config) {
  return withPodfile(config, (podfile) => {
    if (!podfile.modResults.contents.includes('$UseRiveLegacy')) {
      podfile.modResults.contents = `$UseRiveLegacy = true\n${podfile.modResults.contents}`;
    }

    return podfile;
  });
};
