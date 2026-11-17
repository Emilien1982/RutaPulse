#!/bin/zsh
# adb limited to the emulator emulator-5584 (never the real phone)
exec $HOME/Library/Android/sdk/platform-tools/adb -s emulator-5584 "$@"
