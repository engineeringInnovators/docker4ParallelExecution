exports.config = {

  directConnect: true,

  SELENIUM_PROMISE_MANAGER: false,

  capabilities: {
    "browserName": "chrome",
    "acceptInsecureCerts": true,
    "acceptSslCerts": true,
    chromeOptions: {
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-infobars",
        "--disable-extensions",
        "--ignore-certificate-errors",
        "--enable-logging",
        "--incognito",
        // "--headless",              
        "--disable-gpu",
        "--window-size=1920,1200",
        // "--start-maximized"
      ],
      prefs: {
        "profile.password_manager_enabled": false,
        "credentials_enable_service": false,
        "password_manager_enabled": false
      }
    }
  },

  params: {
    clientInterval: 150,
    stepsRetries: 2,
    stepRetriesIntervals: 1000,
    failFast: true,
    dontShowBrowserLogs: false,
    auth: {
      formType: "plain"
    },
    coverage: {
      status: false,
      // coverage_files: ["mm_po_manages1"],
      sourcePath: "./sourceFolder"
    },

  },

  baseUrl: "https://cc3-725.wdf.sap.corp/ui",


  // Framework to use. Jasmine is recommended.
  framework: "jasmine2",

  // Spec patterns are relative to the current working directory when
  // protractor is called.
  specs: [
    "./test.spec.js"
  ],

  allScriptsTimeout: 600000,
  getPageTimeout: 90000,
  idleTimeout: 600000,
  vyperPageLoadTimeout: 50000,

  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 600000
  }
};