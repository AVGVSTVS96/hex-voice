// iOS 27 stops apps at launch unless they adopt the UIScene life cycle. Expo 57 ships
// ExpoAppSceneDelegate for this, but its prebuild template still starts React Native
// from the app delegate, so this plugin hands the window over to the scene delegate.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const START =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n {4}window = UIWindow\(frame: UIScreen\.main\.bounds\)\n {4}factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

module.exports = function withSceneLifecycle(config) {
  config = withAppDelegate(config, (config) => {
    let source = config.modResults.contents;
    if (!source.includes('ExpoReactNativeFactoryProvider')) {
      if (!START.test(source))
        throw new Error('with-scene-lifecycle: unexpected AppDelegate.swift');
      source = source
        .replace(
          'class AppDelegate: ExpoAppDelegate {',
          'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
        )
        .replace(START, '');
    }
    config.modResults.contents = source;
    return config;
  });
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });
};
