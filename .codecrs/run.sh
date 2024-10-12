#!/bin/sh
#
# This script is used to run your program 

set -e # Exit on failure

exec node app/main.js "$@"
