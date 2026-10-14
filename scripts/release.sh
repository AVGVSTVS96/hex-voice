# Shared by ship-js and ship-native: the release checkout is origin/main with its own
# node_modules and .env.local (see .env.example), and the update store sits beside it.
set -euo pipefail

home=${HEX_VOICE_HOME:-$HOME/.local/share/hex-voice}
release=$home/release
updates=$home/updates

die() {
  echo "$*" >&2
  exit 1
}

install_modules() {
  local lock
  lock=$(git hash-object package-lock.json)
  [ "$(cat node_modules/.lock 2>/dev/null)" = "$lock" ] && return
  npm ci --no-audit --no-fund >/dev/null
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
  (cd "$release" && node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform ios) |
    jq -r .runtimeVersion
}
