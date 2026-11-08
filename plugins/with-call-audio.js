const { withAppDelegate } = require("expo/config-plugins");

const REACT_NATIVE_LAUNCH =
  "    return super.application(application, didFinishLaunchingWithOptions: launchOptions)";

const WEBRTC_AUDIO_DEFAULTS = `    let callAudio = RTCAudioSessionConfiguration.webRTC()
    callAudio.mode = AVAudioSession.Mode.videoChat.rawValue
    callAudio.categoryOptions = [.mixWithOthers, .defaultToSpeaker, .allowBluetoothHFP]
    RTCAudioSessionConfiguration.setWebRTC(callAudio)

`;

module.exports = function withCallAudio(config) {
  return withAppDelegate(config, (appDelegate) => {
    let source = appDelegate.modResults.contents;

    if (!source.includes("RTCAudioSessionConfiguration")) {
      if (!source.includes(REACT_NATIVE_LAUNCH)) {
        throw new Error("with-call-audio: unexpected AppDelegate.swift");
      }

      source = `import AVFoundation\nimport WebRTC\n${source}`.replace(
        REACT_NATIVE_LAUNCH,
        WEBRTC_AUDIO_DEFAULTS + REACT_NATIVE_LAUNCH,
      );
    }

    appDelegate.modResults.contents = source;

    return appDelegate;
  });
};
