const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const FILES = [
  { name: "AskHex.swift", phase: "Sources", type: "sourcecode.swift" },
  { name: "Skills.skillsbundle", phase: "Resources", type: "wrapper.skillsbundle" },
];

module.exports = function withSiri(config) {
  const addressed = withInfoPlist(config, (infoPlist) => {
    infoPlist.modResults.HexURL = process.env.EXPO_PUBLIC_HEX_URL ?? "";
    infoPlist.modResults.HexToken = process.env.EXPO_PUBLIC_HEX_TOKEN ?? "";

    return infoPlist;
  });

  const copied = withDangerousMod(addressed, [
    "ios",
    (native) => {
      const app = path.join(native.modRequest.platformProjectRoot, native.modRequest.projectName);

      for (const { name } of FILES) {
        fs.rmSync(path.join(app, name), { recursive: true, force: true });
        fs.cpSync(path.join(__dirname, "siri", name), path.join(app, name), { recursive: true });
      }

      return native;
    },
  ]);

  return withXcodeProject(copied, (xcode) => {
    const project = xcode.modResults;
    const name = xcode.modRequest.projectName;
    const target = project.findTargetKey(name);
    const group = project.findPBXGroupKey({ name });

    if (!target || !group) {
      throw new Error(`with-siri: no ${name} app target`);
    }

    const phases = project.pbxNativeTargetSection()[target].buildPhases;

    for (const file of FILES) {
      if (project.hasFile(`${name}/${file.name}`)) {
        continue;
      }

      const phase = phases.find(({ comment }) => comment === file.phase);
      const section = file.phase === "Sources" ? "PBXSourcesBuildPhase" : "PBXResourcesBuildPhase";

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

    return xcode;
  });
};
