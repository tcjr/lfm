'use strict';

const isCI = !!process.env.CI;

module.exports = {
  test_page: 'tests/index.html?hidepassed',
  cwd: 'dist',
  disable_watching: true,
  // Force testem to bind to the local loopback explicitly
  host: '127.0.0.1',
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
      ].filter(Boolean),
    },
    Chromium: {
      ci: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--headless=new',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--mute-audio',
        '--remote-debugging-port=0',
        // Prevents Chromium from getting stuck looking for system window managers/DBus
        '--disable-ext-v8-runner',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1440,900',
      ],
    },
  },
};
