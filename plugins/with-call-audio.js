// WebRTC applies its own audio session configuration every time a call's audio starts,
// so the call's session is set here, before React Native loads. Mixing with others lets
// music from another app keep playing during a call instead of interrupting it.
const { withAppDelegate } = require('expo/config-plugins');

const LAUNCH =
  '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)';

const CALL_AUDIO = `    let callAudio = RTCAudioSessionConfiguration.webRTC()
    callAudio.mode = AVAudioSession.Mode.videoChat.rawValue
    callAudio.categoryOptions = [.mixWithOthers, .defaultToSpeaker, .allowBluetoothHFP]
    RTCAudioSessionConfiguration.setWebRTC(callAudio)

`;

module.exports = function withCallAudio(config) {
  return withAppDelegate(config, (config) => {
    let source = config.modResults.contents;
    if (!source.includes('RTCAudioSessionConfiguration')) {
      if (!source.includes(LAUNCH))
        throw new Error('with-call-audio: unexpected AppDelegate.swift');
      source = `import AVFoundation\nimport WebRTC\n${source}`.replace(LAUNCH, CALL_AUDIO + LAUNCH);
    }
    config.modResults.contents = source;
    return config;
  });
};
