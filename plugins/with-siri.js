const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const FILES = [
  { name: "AskHex.swift", phase: "Sources", type: "sourcecode.swift" },
  { name: "AskAttributes.swift", phase: "Sources", type: "sourcecode.swift" },
  { name: "Skills.skillsbundle", phase: "Resources", type: "wrapper.skillsbundle" },
];

const WIDGETS = "ExpoWidgetsTarget";

const WIDGET_FILES = [
  { name: "AskAttributes.swift", phase: "Sources", type: "sourcecode.swift" },
  { name: "AskActivity.swift", phase: "Sources", type: "sourcecode.swift" },
];

const copy = (files, folder) => {
  for (const { name } of files) {
    fs.rmSync(path.join(folder, name), { recursive: true, force: true });
    fs.cpSync(path.join(__dirname, "siri", name), path.join(folder, name), { recursive: true });
  }
};

const addToTarget = (project, targetName, groupOf, files, filePath) => {
  const target = project.findTargetKey(targetName);
  const group = project.findPBXGroupKey(groupOf);

  if (!target || !group) {
    throw new Error(`with-siri: no ${targetName} target`);
  }

  const phases = project.pbxNativeTargetSection()[target].buildPhases;

  for (const file of files) {
    if (project.hasFile(filePath(file.name))) {
      continue;
    }

    const phase = phases.find(({ comment }) => comment === file.phase);
    const section = file.phase === "Sources" ? "PBXSourcesBuildPhase" : "PBXResourcesBuildPhase";

    const added = project.addFile(filePath(file.name), group, {
      lastKnownFileType: file.type,
    });

    Object.assign(added, { uuid: project.generateUuid(), target });
    project.addToPbxBuildFileSection(added);
    project.hash.project.objects[section][phase.value].files.push({
      value: added.uuid,
      comment: `${file.name} in ${file.phase}`,
    });
  }
};

module.exports = function withSiri(config) {
  const addressed = withInfoPlist(config, (infoPlist) => {
    infoPlist.modResults.HexURL = process.env.EXPO_PUBLIC_HEX_URL ?? "";
    infoPlist.modResults.HexToken = process.env.EXPO_PUBLIC_HEX_TOKEN ?? "";

    return infoPlist;
  });

  const copied = withDangerousMod(addressed, [
    "ios",
    (native) => {
      const root = native.modRequest.platformProjectRoot;
      copy(FILES, path.join(root, native.modRequest.projectName));

      const widgets = path.join(root, WIDGETS);
      copy(WIDGET_FILES, widgets);

      const index = path.join(widgets, "index.swift");
      const bundle = fs.readFileSync(index, "utf-8");

      if (!bundle.includes("AskActivity()")) {
        fs.writeFileSync(
          index,
          bundle.replace("WidgetLiveActivity()", "AskActivity()\n    WidgetLiveActivity()"),
        );
      }

      return native;
    },
  ]);

  return withXcodeProject(copied, (xcode) => {
    const project = xcode.modResults;
    const name = xcode.modRequest.projectName;

    addToTarget(project, name, { name }, FILES, (file) => `${name}/${file}`);
    addToTarget(project, WIDGETS, { path: WIDGETS }, WIDGET_FILES, (file) => file);

    return xcode;
  });
};
