# App Store

The App Store build is the local-only app (ADR-0012, spec #106): a build that carries no app token, so it has no Sync, no Pairing links and no Identify. The owner's own builds (the device recipe, with `.env.local`) carry the token and keep all three. `HAS_APP_TOKEN` in `src/ui/useSync.ts` is the switch.

## Store build

Each step ends where its check passes.

1. **Version.** Raise `ios.buildNumber` in `app.json` for every upload, since App Store Connect refuses a number it has seen. Raise `version` too for a new release.
2. **Prebuild.** `CI=1 npx expo prebuild --platform ios` whenever native config changed (`app.json`, plugins, a native dependency); it installs the pods too. Done when `ios/GreenFriends/Info.plist` shows the new `CFBundleVersion`.
3. **Checks.** `npx expo install --check`, then the test, lint and typecheck commands, all passing.
4. **Archive**, with `.env.local` unread:

   ```bash
   EXPO_NO_DOTENV=1 xcodebuild -workspace ios/GreenFriends.xcworkspace -scheme GreenFriends \
     -configuration Release -destination 'generic/platform=iOS' \
     -archivePath <scratch>/GreenFriends.xcarchive -allowProvisioningUpdates \
     DEVELOPMENT_TEAM=<team id> CODE_SIGN_STYLE=Automatic archive
   ```

5. **Token check.** This must print `0`. A `1` means the token is in the bundle: delete the archive and find out how `.env.local` got read.

   ```bash
   grep -ac "$(cat ~/.green-friends-app-token)" \
     <scratch>/GreenFriends.xcarchive/Products/Applications/GreenFriends.app/main.jsbundle
   ```

   It prints a count, never the token. Hermes keeps ASCII strings as they are, so the hex token is found whenever it's there.

   **Metro's cache.** Xcode's bundling phase runs Metro with `--reset-cache` (`react-native-xcode.sh`), so an archive never reuses a cached transform. A bundle made by hand with `npx expo export:embed` is different: without `--reset-cache` it keeps whatever the last bundle inlined, and after an owner build that is the token, even under `EXPO_NO_DOTENV=1` (seen 2026-10-16).

   **A dev server always has the token.** In development, `expo/virtual/env` reads the `.env*` files through a `require.context`, whatever `EXPO_NO_DOTENV` says. To see the App Store build's screens on the simulator, move `.env.local` out of the repo for the run and put it back after. Only production bundles, like the archive's, follow `EXPO_NO_DOTENV`.
6. **Upload**, once the app record exists in App Store Connect:

   ```bash
   xcodebuild -exportArchive -archivePath <scratch>/GreenFriends.xcarchive \
     -exportOptionsPlist <scratch>/ExportOptions.plist -exportPath <scratch>/export -allowProvisioningUpdates
   ```

   `ExportOptions.plist` is a plist dict with `method` `app-store-connect`, `destination` `upload` and `teamID` `<team id>`; write it to the scratchpad when needed. With `destination` `export` instead, the same command only writes the `.ipa`.

   **The agreement.** An export that fails with `PLA Update available`, followed by `No signing certificate "iOS Distribution" found`, means Apple has a newer Program License Agreement than the account holder accepted. It stops Xcode from creating the distribution certificate. The owner accepts it at developer.apple.com, under Account, and then the export goes through (seen 2026-10-16).
7. **TestFlight.** The build shows in App Store Connect's TestFlight once processed; install it from TestFlight on the owner's iPhone to check it. Then put the owner's own build back on: a store or TestFlight build hides Sync there, though the key and status stay.

## App Store Connect state

These are the choices behind the listing (spec #106), so a change to the app keeps them true:

- **App Privacy:** Data Not Collected. That stays true only while the store build makes no network request.
- **Export compliance:** answered by `ITSAppUsesNonExemptEncryption` (`ios.config.usesNonExemptEncryption: false`). The only encryption is expo-crypto's AES, through CryptoKit, which is the operating system's.
- **Availability:**
  - Northern-hemisphere storefronts only, while the growing-month range defaults to March–October.
  - No Mac and no Apple Vision Pro, since neither is tested.
  - iPhone only (`supportsTablet: false`) on iOS 26 or later (`ios.deploymentTarget`).
- **Releases** are manual. Phased release only applies to updates (1.0 reaches everyone at once), so each update after 1.0 turns it on. Crash reports come from Xcode Organizer.
