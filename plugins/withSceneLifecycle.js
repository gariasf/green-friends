// iOS 27 refuses to launch an app built with its SDK unless the app adopts the UIKit scene life
// cycle. SDK 57's `expo` already ships the scene delegate (ExpoAppSceneDelegate); only its
// template still starts React Native in the app delegate's own window. This backports the wiring
// Expo SDK 58's template carries: the scene manifest, and an app delegate that hands its React
// Native factory to the scene delegate instead of starting it.
// ponytail: delete this plugin when upgrading to SDK 58, whose template does the same.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            // Expo's delegate by its Objective-C name: it creates the window and starts React Native.
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });
  return withAppDelegate(config, (config) => {
    const source = config.modResults.contents;
    // A prebuild over an existing ios/ runs this on the already edited file.
    if (!source.includes('ExpoReactNativeFactoryProvider')) {
      config.modResults.contents = replace(
        replace(
          source,
          'class AppDelegate: ExpoAppDelegate {',
          'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
        ),
        WINDOW,
        '    // The scene delegate creates the window and starts React Native.\n',
      );
    }
    return config;
  });
};

function replace(source, from, to) {
  if (!source.includes(from)) {
    throw new Error(
      `withSceneLifecycle: AppDelegate.swift no longer contains\n${from}\nThe Expo template changed: check whether this backport is still needed.`,
    );
  }
  return source.replace(from, to);
}
