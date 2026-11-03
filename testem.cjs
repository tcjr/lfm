'use strict';

// Detect if we are running in Tangled CI or another containerized CI environment
const isCI = !!process.env.CI;

module.exports = {
  test_page: 'tests/index.html?hidepassed',
  cwd: 'dist',
  disable_watching: true,
  // Use Chromium on CI, Chrome locally
  launch_in_ci: [isCI ? 'Chromium' : 'Chrome'],
  launch_in_dev: ['Chrome'],
  browser_start_timeout: 120,
  browser_args: {
    Chrome: {
      ci: [
        '--no-sandbox',
        '--headless',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--mute-audio',
        '--remote-debugging-port=0',
        '--window-size=1440,900',
      ],
    },
    // Add arguments specifically for Chromium on Tangled CI
    Chromium: {
      ci: [
        '--no-sandbox',
        '--headless',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--mute-audio',
        '--remote-debugging-port=0',
        '--window-size=1440,900',
      ],
    },
  },
};
