#!/bin/zsh
# usage: a-mock.sh <lat> <lon> [accuracy m] : position of the mock "fused" provider of the emulator emulator-5584
# (the real GPS provider of the emulator is off while only a BALANCED request exists: see LISEZMOI.md)
cd "$(dirname $0)"
./a.sh shell appops set com.android.shell android:mock_location allow
./a.sh shell cmd location providers add-test-provider fused >/dev/null 2>&1
./a.sh shell cmd location providers set-test-provider-enabled fused true
./a.sh shell cmd location providers set-test-provider-location fused --location $1,$2 --accuracy ${3:-30}
