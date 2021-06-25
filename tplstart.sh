#!/bin/bash

# uid=$(stat -c %u ${PWD})
# gid=$(stat -c %g ${PWD})

# groupadd -o -g $gid vyper
# useradd -m -o -u $uid -g $gid vyper

# # Chrome, starting with version 56, refuses to run when launched by root.
# # Therefore, we need to run it as a regular user, taking care
# # to set the uid and gid of that user to match those of the current directory owner.
# # Otherwise protractor could experience problems reading files from the current directory.
# su vyper
# vyper xvfb-run --server-args="-screen 0 ${SCREEN_RES}" -a vyper $@

export DISPLAY=:99.0;Xvfb -ac $DISPLAY &
# vyper /tmp/test/config.js --specs=$1
cd /vyper && vyper /vyper/config.js --specs=/tmp/test/config.js --baseUrl=client_base_url
# chown ccloud:ccloud /vyper/results

#vyper /tmp/uiAutomation/config/config.js --specs=/tmp/uiAutomation/testScripts/sample.spec.js
#vyper /tmp/test/config.js --specs=/tmp/test/sampleTest.spec.js
