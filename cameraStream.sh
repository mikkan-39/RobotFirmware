#!/bin/bash
rpicam-vid -t 0 --width 1920 --height 1080 --framerate 30 --inline --rotation 180 --listen -o tcp://0.0.0.0:5556