#!/bin/zsh
# usage: a-touch.sh <script on stdin>: runs a sendevent script on the emulator (multi-touch protocol B on two virtio devices)
cd "$(dirname $0)"
./a.sh shell sh
