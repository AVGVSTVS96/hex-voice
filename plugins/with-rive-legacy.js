// Rive 0.5's default iOS backend drops state machine inputs for data binding, and the persona
// files only bind their color, so their states still run through inputs on the legacy backend.
const { withPodfile } = require('expo/config-plugins');

module.exports = function withRiveLegacy(config) {
  return withPodfile(config, (config) => {
    if (!config.modResults.contents.includes('$UseRiveLegacy')) {
      config.modResults.contents = `$UseRiveLegacy = true\n${config.modResults.contents}`;
    }
    return config;
  });
};
