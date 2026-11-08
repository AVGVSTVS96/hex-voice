// expo-widgets builds the Live Activity extension without resources, so this adds the orb
// stills (made by `npm run activity-orbs`) to it as an asset catalog the extension compiles.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const TARGET = 'ExpoWidgetsTarget';
const CATALOG = 'Orbs.xcassets';

module.exports = function withActivityOrbs(config) {
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const target = path.join(config.modRequest.platformProjectRoot, TARGET, CATALOG);
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(path.join(config.modRequest.projectRoot, 'assets/live-activity', CATALOG), target, {
        recursive: true,
      });
      return config;
    },
  ]);
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const target = project.findTargetKey(TARGET);
    const group = project.findPBXGroupKey({ name: TARGET });
    if (!target || !group)
      throw new Error(`with-activity-orbs: no ${TARGET} target to add orbs to`);
    if (project.hasFile(CATALOG)) return config;
    const phase = project
      .pbxNativeTargetSection()
      [target].buildPhases.find(({ comment }) => comment === 'Resources');
    const resources = phase
      ? project.hash.project.objects.PBXResourcesBuildPhase[phase.value]
      : project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target).buildPhase;
    const file = project.addFile(CATALOG, group, { lastKnownFileType: 'folder.assetcatalog' });
    Object.assign(file, { uuid: project.generateUuid(), target });
    project.addToPbxBuildFileSection(file);
    resources.files.push({ value: file.uuid, comment: `${CATALOG} in Resources` });
    return config;
  });
};
