// Ask hex through Siri: the App Intent and its Siri skill go into the app target itself, where
// Xcode reads App Intents metadata and compiles the skills bundle (both need the iOS 27.3 SDK
// for Siri to see them), and the app's hex address and token go in Info.plist for the intent.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const FILES = [
  { name: 'AskHex.swift', phase: 'Sources', type: 'sourcecode.swift' },
  { name: 'Skills.skillsbundle', phase: 'Resources', type: 'wrapper.skillsbundle' },
];

module.exports = function withSiri(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.HexURL = process.env.EXPO_PUBLIC_HEX_URL ?? '';
    config.modResults.HexToken = process.env.EXPO_PUBLIC_HEX_TOKEN ?? '';
    return config;
  });
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      const app = path.join(config.modRequest.platformProjectRoot, config.modRequest.projectName);
      for (const { name } of FILES) {
        fs.rmSync(path.join(app, name), { recursive: true, force: true });
        fs.cpSync(path.join(__dirname, 'siri', name), path.join(app, name), { recursive: true });
      }
      return config;
    },
  ]);
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const name = config.modRequest.projectName;
    const target = project.findTargetKey(name);
    const group = project.findPBXGroupKey({ name });
    if (!target || !group) throw new Error(`with-siri: no ${name} app target`);
    const phases = project.pbxNativeTargetSection()[target].buildPhases;
    for (const file of FILES) {
      if (project.hasFile(`${name}/${file.name}`)) continue;
      const phase = phases.find(({ comment }) => comment === file.phase);
      const section = file.phase === 'Sources' ? 'PBXSourcesBuildPhase' : 'PBXResourcesBuildPhase';
      const added = project.addFile(`${name}/${file.name}`, group, {
        lastKnownFileType: file.type,
      });
      Object.assign(added, { uuid: project.generateUuid(), target });
      project.addToPbxBuildFileSection(added);
      project.hash.project.objects[section][phase.value].files.push({
        value: added.uuid,
        comment: `${file.name} in ${file.phase}`,
      });
    }
    return config;
  });
};
