# Shared by ship-js, ship-native and duo: the release checkout is origin/main with its own
# node_modules and .env.local (see .env.example), and the update store sits beside it.
set -euo pipefail

home=${HEX_VOICE_HOME:-$HOME/.local/share/hex-voice}
release=$home/release
updates=$home/updates

die() {
  echo "$*" >&2
  exit 1
}

# npm ci applies patches/ too, so a change to either installs again.
install_modules() {
  local lock
  lock=$({ cat package-lock.json; cat patches/* 2>/dev/null || true; } | git hash-object --stdin)
  [ "$(cat node_modules/.lock 2>/dev/null)" = "$lock" ] && return
  # Callers run this inside && lists, where set -e doesn't stop on failure, so it stops itself. A
  # fresh folder, since npm ci fails on files a native build left inside node_modules.
  rm -rf node_modules
  npm ci --no-audit --no-fund >/dev/null || die "npm ci failed in $PWD"
  # Pods built against the packages that were here would point at their files, so they reinstall.
  rm -f ios/Pods/.inputs
  echo "$lock" >node_modules/.lock
}

refresh_release() {
  local origin
  origin=$(git -C "$(dirname "${BASH_SOURCE[0]}")" remote get-url origin)
  [ -d "$release/.git" ] || git clone -q "$origin" "$release"
  git -C "$release" fetch -q origin main
  git -C "$release" checkout -q --force --detach origin/main
  [ -f "$release/.env.local" ] || die "$release/.env.local is missing: copy .env.example and fill it in"
  (cd "$release" && install_modules)
}

runtime_version() {
  (cd "${1:-$release}" && node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform ios) |
    jq -r .runtimeVersion
}

# pod install re-extracts React Native's prebuilt frameworks, which makes Xcode recompile every
# pod, so it only runs when what it reads has changed. package-lock.json already pins every pod,
# so it resolves without the last Podfile.lock, whose old pins would block a package that moved on.
install_pods() {
  local inputs
  inputs=$({
    cat ios/Podfile ios/Podfile.properties.json package-lock.json
    find modules -type f | sort
    find modules -name '*.podspec' -exec cat {} +
  } | git hash-object --stdin)
  [ "$(cat ios/Pods/.inputs 2>/dev/null)" = "$inputs" ] && return
  rm -f ios/Podfile.lock
  (cd ios && pod install --repo-update) >build/pod-install.log 2>&1 ||
    die "pod install failed, see $PWD/build/pod-install.log on the Mac"
  echo "$inputs" >ios/Pods/.inputs
}

# Runs on the Mac, in a copy of the app: writes its ios folder and installs its pods, so Xcode
# only rebuilds what changed.
prepare_native() {
  export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 PATH=/opt/homebrew/bin:$PATH
  set -a && . ./.env.local && set +a
  install_modules
  # Prebuild only writes its native template into a new ios folder, so a new SDK starts one.
  local sdk
  sdk=$(node -p 'require("expo/package.json").version.split(".")[0]')
  [ "$(cat ios/.sdk 2>/dev/null)" = "$sdk" ] || rm -rf ios
  CI=1 npx expo prebuild --platform ios --no-install --no-clean >/dev/null
  echo "$sdk" >ios/.sdk
  mkdir -p build
  install_pods
}
