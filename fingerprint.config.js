module.exports = {
  sourceSkips: [
    'PackageJsonScriptsAll',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
  ],
  extraSources: [
    { type: 'dir', filePath: 'plugins/siri', reasons: ['with-siri copies it into the app'] },
    {
      type: 'dir',
      filePath: 'assets/live-activity',
      reasons: ['with-activity-orbs copies it into the Live Activity'],
    },
  ],
};
