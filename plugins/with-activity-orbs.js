const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const TARGET = "ExpoWidgetsTarget";
const CATALOG = "Orbs.xcassets";

module.exports = function withActivityOrbs(config) {
  const copied = withDangerousMod(config, [
    "ios",
    (native) => {
      const target = path.join(native.modRequest.platformProjectRoot, TARGET, CATALOG);
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(path.join(native.modRequest.projectRoot, "assets/live-activity", CATALOG), target, {
        recursive: true,
      });

      return native;
    },
  ]);

  return withXcodeProject(copied, (xcode) => {
    const project = xcode.modResults;
    const target = project.findTargetKey(TARGET);
    const group = project.findPBXGroupKey({ name: TARGET });

    if (!target || !group) {
      throw new Error(`with-activity-orbs: no ${TARGET} target to add orbs to`);
    }

    if (project.hasFile(CATALOG)) {
      return xcode;
    }

    const { buildPhases } = project.pbxNativeTargetSection()[target];
    const phase = buildPhases.find(({ comment }) => comment === "Resources");

    const resources = phase
      ? project.hash.project.objects.PBXResourcesBuildPhase[phase.value]
      : project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target).buildPhase;

    const file = project.addFile(CATALOG, group, { lastKnownFileType: "folder.assetcatalog" });
    Object.assign(file, { uuid: project.generateUuid(), target });
    project.addToPbxBuildFileSection(file);
    resources.files.push({ value: file.uuid, comment: `${CATALOG} in Resources` });

    return xcode;
  });
};
