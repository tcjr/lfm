'use strict';

const ciBrowserArgs = [
  // --no-sandbox is needed when running Chrome/Chromium inside a container or VM
  process.env.CI ? '--no-sandbox' : null,
  '--headless',
  '--disable-dev-shm-usage',
  '--disable-software-rasterizer',
  '--mute-audio',
  '--remote-debugging-port=0',
  '--window-size=1440,900',
].filter(Boolean);

if (typeof module !== 'undefined') {
  module.exports = {
    test_page: 'tests/index.html?hidepassed',
    cwd: 'dist',
    disable_watching: true,
    launch_in_ci: [process.env.CI_BROWSER || 'Chrome'],
    launch_in_dev: ['Chrome'],
    browser_start_timeout: 120,
    browser_exes: {
      Chrome: ['google-chrome', 'google-chrome-stable', 'chrome', 'chromium-browser', 'chromium'],
    },
    browser_args: {
      Chrome: {
        ci: ciBrowserArgs,
      },
      Chromium: {
        ci: ciBrowserArgs,
      },
    },
    // only emit console logs for failed tests
    tap_quiet_logs: true,
  };
}
