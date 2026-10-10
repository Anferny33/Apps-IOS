#!/bin/sh
# Bedienungshilfen-Baum der Seite aus dem iPhone-Simulator holen: das, was VoiceOver vorlesen würde
# (Rollen, Beschriftungen, Werte, Reihenfolge). Der Simulator hat kein VoiceOver, der XCUITest-Dump
# sieht denselben Baum.
# Voraussetzungen: Xcode, xcodegen (brew install xcodegen), gestarteter Simulator mit der Seite in Safari.
# Aufruf: tests/ax-dump/run.sh <UDID> [Name] [Tipps]
#   Name   Dateiname des Dumps (dump-<Name>.clean.txt), Standard „seite“
#   Tipps  Beschriftungen, mit | getrennt, die vor dem Dump angetippt werden, z. B. "Einstellungen" oder "Radar"
set -e
cd "$(dirname "$0")"
UDID="${1:?UDID des Simulators (xcrun simctl list devices booted)}"; NAME="${2:-seite}"; TAPS="${3:-}"
[ -d AXDump.xcodeproj ] || xcodegen generate --quiet
XR=$(ls dd/Build/Products/*.xctestrun 2>/dev/null | head -1 || true)
if [ -z "$XR" ]; then
    xcodebuild build-for-testing -project AXDump.xcodeproj -scheme AXDump -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath dd -quiet
    XR=$(ls dd/Build/Products/*.xctestrun | head -1)
fi
TEST_RUNNER_AX_OUT="$PWD/dump-$NAME.txt" TEST_RUNNER_AX_TAPS="$TAPS" xcodebuild test-without-building -xctestrun "$XR" \
    -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath dd 2>&1 | grep -E "Test Case .*(passed|failed)" || true
sed -E 's/, 0x[0-9a-f]+//; s/, Focused//' "dump-$NAME.txt" > "dump-$NAME.clean.txt"
echo "Dump: tests/ax-dump/dump-$NAME.clean.txt"
