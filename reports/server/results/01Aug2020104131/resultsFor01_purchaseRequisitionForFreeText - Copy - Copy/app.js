var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {
    "showTotalDurationIn": "header",
    "totalDurationFormat": "hms",
    "columnSettings": {
        "displayTime": true,
        "displayBrowser": true,
        "displaySessionId": true,
        "displayOS": true,
        "inlineScreenshots": true
    }
};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23624,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606469754215,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001f0008-0035-00fa-00a2-00f3008400c4.png",
        "timestamp": 1606469761978,
        "duration": 3830
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23624,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\0060008a-0049-00ea-0048-000b009000e0.png",
        "timestamp": 1606469766585,
        "duration": 5255
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 23624,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}"
        ],
        "trace": [
            "Error: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}\n    at Locator.scrollToElement (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\locator.js:226:13)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at enterpriseContractManagementOverview.scrollToLegalTransaction (C:\\Siva-Office\\enterpriseContractManagement\\modules\\enterpriseContractManagementOverview.js:35:9)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:26:9)\nFrom: Task: Run it(\"Step 3: Scroll to Total Legal Transaction Status\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:24:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606469818717,
                "type": ""
            }
        ],
        "timestamp": 1606469807352,
        "duration": 82737
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14260,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606469902233,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0064003d-0086-000b-0018-0068000a00a6.png",
        "timestamp": 1606469909303,
        "duration": 5038
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 14260,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00f7008a-004e-00cf-006a-00fd00880087.png",
        "timestamp": 1606469915156,
        "duration": 5688
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14260,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}"
        ],
        "trace": [
            "Error: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}\n    at Locator.scrollToElement (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\locator.js:226:13)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at enterpriseContractManagementOverview.scrollToLegalTransaction (C:\\Siva-Office\\enterpriseContractManagement\\modules\\enterpriseContractManagementOverview.js:35:9)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:26:9)\nFrom: Task: Run it(\"Step 3: Scroll to Total Legal Transaction Status\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:24:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606469960530,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00240043-001b-0050-0004-009000f2000a.png",
        "timestamp": 1606469946064,
        "duration": 102101
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606471807737,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\009d008e-0055-00ce-0043-009d00480011.png",
        "timestamp": 1606471816100,
        "duration": 3680
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 16668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606471897230,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0040002c-00f9-00b1-00dd-005a00cc0045.png",
        "timestamp": 1606471836427,
        "duration": 62830
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17704,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606472004668,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\003f0084-004a-00d5-0074-00e3004d00fe.png",
        "timestamp": 1606472012349,
        "duration": 4879
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17704,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\0001000a-0081-0096-0091-0079002d00a7.png",
        "timestamp": 1606472038084,
        "duration": 6539
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17704,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}"
        ],
        "trace": [
            "Error: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}\n    at Locator.scrollToElement (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\locator.js:226:13)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at enterpriseContractManagementOverview.scrollToLegalTransaction (C:\\Siva-Office\\enterpriseContractManagement\\modules\\enterpriseContractManagementOverview.js:35:9)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:26:9)\nFrom: Task: Run it(\"Step 3: Scroll to Total Legal Transaction Status\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:24:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606472083726,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\002e00da-001f-0097-00e0-00cb001400d8.png",
        "timestamp": 1606472062505,
        "duration": 87633
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606472171788,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00690029-00b0-003e-0066-008c00b300fe.png",
        "timestamp": 1606472179438,
        "duration": 3875
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00b90036-0027-00c0-0025-004900a800e3.png",
        "timestamp": 1606472184064,
        "duration": 6160
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10564,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}"
        ],
        "trace": [
            "Error: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}\n    at Locator.scrollToElement (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\locator.js:226:13)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at enterpriseContractManagementOverview.scrollToLegalTransaction (C:\\Siva-Office\\enterpriseContractManagement\\modules\\enterpriseContractManagementOverview.js:35:9)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:26:9)\nFrom: Task: Run it(\"Step 3: Scroll to Total Legal Transaction Status\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:24:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606472215352,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e50052-007e-00c9-00de-00e40038005d.png",
        "timestamp": 1606472196842,
        "duration": 60053
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4976,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606472274932,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00740069-00b2-0052-00d2-00910034007b.png",
        "timestamp": 1606472283575,
        "duration": 4409
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4976,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00010012-0042-00b6-00b4-00fb00ed00eb.png",
        "timestamp": 1606472288651,
        "duration": 7414
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4976,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}"
        ],
        "trace": [
            "Error: scrollToElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.ovp.cards.generic.Card\",\"metadata\":\"sap.m.Text\",\"id\":\"*ovpCT\",\"text\":\"Legal Transaction Status for Current Quarter\"}}\n    at Locator.scrollToElement (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\locator.js:226:13)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at enterpriseContractManagementOverview.scrollToLegalTransaction (C:\\Siva-Office\\enterpriseContractManagement\\modules\\enterpriseContractManagementOverview.js:35:9)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:26:9)\nFrom: Task: Run it(\"Step 3: Scroll to Total Legal Transaction Status\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:24:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606472327105,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:50:42.103659 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606472443045,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001b0056-00e3-0076-00ce-005800960080.png",
        "timestamp": 1606472313387,
        "duration": 128494
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606472465713,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0050001f-00de-003a-0074-0090001b0025.png",
        "timestamp": 1606472473227,
        "duration": 3085
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00b3009a-00a6-00b4-0086-00e000ff00d8.png",
        "timestamp": 1606472476975,
        "duration": 5836
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606472650172,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:06.863969 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650173,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:06.916139 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650173,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:06.925655 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:06.931310 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:06.983350 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.023215 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.045135 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606472650174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.074889 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.107679 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.151155 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.163830 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650176,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.212495 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650176,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.237425 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650176,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.598790 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.616010 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.809875 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606472650177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:07.922735 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606472650178,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:11.258570 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606472651311,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:11.266780 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606472651311,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:54:11.268219 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606472651312,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606472655813,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\000c001d-0080-0066-0066-00ce005c00c2.png",
        "timestamp": 1606472507308,
        "duration": 149324
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606472696703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606472696703,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e00093-00ba-00f8-0094-00a500ba0044.png",
        "timestamp": 1606472657195,
        "duration": 79928
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\004d00b0-00b5-002a-00a4-006400d800f6.png",
        "timestamp": 1606472758008,
        "duration": 61545
    },
    {
        "description": "Step 6: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15180,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Expected '49' to be '0'."
        ],
        "trace": [
            "Error: Failed expectation\n    at Assertion.expectEqual (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\assertion.js:420:33)\n    at manageLegalTransactions.AssertLegalTransactions (C:\\Siva-Office\\enterpriseContractManagement\\modules\\manageLegalTransactions.js:191:36)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:48:13)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-manage%22%2C%22LegalTransaction-manage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606472822526,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 15:57:16.085020 neither metadata nor custom information for filter 'customParameter' -  \"",
                "timestamp": 1606472836088,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001c00d8-000c-007b-0039-00ee00b100a7.png",
        "timestamp": 1606472826320,
        "duration": 27292
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606473033518,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006500d7-00b6-00df-0069-0086004b004d.png",
        "timestamp": 1606473041448,
        "duration": 3548
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606473112742,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00fc00a9-00cd-003e-0033-00510025007c.png",
        "timestamp": 1606473067992,
        "duration": 45528
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:08.846159 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606473197482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.426560 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.483889 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197483,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.497254 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197483,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.503750 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.541995 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.584084 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.621824 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197484,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.672274 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197485,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.715294 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197485,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.729709 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197485,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.773510 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197486,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.805530 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197486,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.842530 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197486,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.871850 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.893860 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473197487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:11.919514 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473197487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:12.921235 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473197488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:12.922975 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473197488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:12.924080 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473197488,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606473198543,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e300c1-009d-00e8-006f-002800810066.png",
        "timestamp": 1606473145602,
        "duration": 53240
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:03:25.807810 XHR logon for FLP plugin failed -  sap.ushell.services.PluginManager\"",
                "timestamp": 1606473228601,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606473228601,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\004f0047-009e-0003-0079-003a009700fe.png",
        "timestamp": 1606473203188,
        "duration": 37765
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Cancelled from Pie Chart |Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "timestamp": 1606473260868,
        "duration": 4538
    },
    {
        "description": "Step 6: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 2616,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\0001001d-005a-0055-0075-0072009b0090.png",
        "timestamp": 1606473326628,
        "duration": 7597
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606473562433,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0049009b-0006-0083-00b3-002100b4003f.png",
        "timestamp": 1606473562415,
        "duration": 8195
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00b400c9-0090-002c-0090-00f40030008f.png",
        "timestamp": 1606473571367,
        "duration": 4507
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606473710975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:39.204320 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606473710975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.095824 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710976,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.244419 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710976,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.277274 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710976,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.292114 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.462344 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:41.599864 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710977,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:42.263489 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710978,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:42.307040 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710978,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:42.651524 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710979,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:42.761199 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710979,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:42.992574 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:43.061455 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:43.369955 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:43.410264 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710981,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:43.697659 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606473710981,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:43.751060 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606473710982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:45.996260 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473710982,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:46.000129 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473710983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 16:11:46.002820 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606473710983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606473710984,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001300dd-000a-00a6-0008-009400ad00e8.png",
        "timestamp": 1606473595480,
        "duration": 119905
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606473737880,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0002005d-00fd-0085-0082-005300fe0058.png",
        "timestamp": 1606473715783,
        "duration": 22084
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Cancelled from Pie Chart |Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606473743890,
                "type": ""
            }
        ],
        "timestamp": 1606473759728,
        "duration": 9112
    },
    {
        "description": "Step 6: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 17516,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\007300b7-00c9-00e0-00f8-00ba00c30067.png",
        "timestamp": 1606473829145,
        "duration": 13529
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606477609801,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0003000a-00d0-00a0-008a-00fc00de00df.png",
        "timestamp": 1606477619247,
        "duration": 4640
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606477713582,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\005100b9-0098-00b1-0066-00fc008c002b.png",
        "timestamp": 1606477652921,
        "duration": 61381
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:17.895459 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606477839584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:19.906635 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:19.988554 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.007250 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839587,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.017514 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839587,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.097520 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839588,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.198294 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839588,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.264360 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839589,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.293610 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839589,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.359719 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.380969 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839591,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.835155 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839591,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:20.919000 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839592,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:21.145364 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839593,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:21.277514 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839593,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:21.438175 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606477839594,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:21.508455 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606477839595,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:22.188635 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606477839595,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:22.192155 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606477839596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:20:22.194790 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606477839597,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606477839597,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00bc008b-00bc-00a5-00ee-00d40036000b.png",
        "timestamp": 1606477716543,
        "duration": 124298
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606477861313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606477861315,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00460046-00eb-007a-0033-006a009b003a.png",
        "timestamp": 1606477841360,
        "duration": 42806
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00d600ca-007a-00da-0067-003a008f0040.png",
        "timestamp": 1606477888368,
        "duration": 65068
    },
    {
        "description": "Step 6: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 13884,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Failed: getValue() failed with Error: getDisplayedElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.suite.ui.generic.template.ListReport.view.ListReport\",\"metadata\":\"sap.m.Title\",\"id\":\"*listReport-header\"}}"
        ],
        "trace": [
            "Error: getValue() failed with Error: getDisplayedElement(): No visible element found with selector: {\"elementProperties\":{\"viewName\":\"sap.suite.ui.generic.template.ListReport.view.ListReport\",\"metadata\":\"sap.m.Title\",\"id\":\"*listReport-header\"}}\n    at wrappedReject (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:100:24)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Step 6: Assert - Legal transactions count with pie chart\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4486:26)\n    at QueueRunner.run (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4402:20)\n    at runNext (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4446:20)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4453:13\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4356:12\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:45:5)\n    at addSpecsToSuite (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1181:25)\n    at Env.describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1145:7)\n    at describe (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4593:18)\n    at Object.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:14:1)\n    at Module._compile (internal/modules/cjs/loader.js:1063:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)\n    at Module.load (internal/modules/cjs/loader.js:928:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:769:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "screenshots\\00ee0028-0068-00fd-00b2-00e000fc007d.png",
        "timestamp": 1606477970421,
        "duration": 35843
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606478029227,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e100d9-0035-009a-008d-005b008a00d6.png",
        "timestamp": 1606478042733,
        "duration": 5614
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00f40070-0020-00bf-00da-001b00db005e.png",
        "timestamp": 1606478049135,
        "duration": 6759
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606478192063,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:11.173725 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606478192065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:14.203645 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:14.381280 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192066,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:15.202274 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:15.231955 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192068,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:16.590935 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192068,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:16.860530 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:16.916084 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192070,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:16.976235 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192071,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:17.147034 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192072,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:17.231659 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606478192072,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:17.848885 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192073,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:17.972439 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.044629 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.118405 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.196120 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192076,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.264780 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606478192077,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.811334 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606478192078,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.815064 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606478192078,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:26:18.816689 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606478192079,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606478192080,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606478194534,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006f0096-00df-0054-0003-009e00e800a5.png",
        "timestamp": 1606478076725,
        "duration": 121664
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606478198789,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://siteintercept.qualtrics.com/dxjsmodule/CoreModule.js?Q_CLIENTVERSION=1.39.0&Q_CLIENTTYPE=web 0 'webkitRequestAnimationFrame' is vendor-specific. Please use the standard 'requestAnimationFrame' instead.",
                "timestamp": 1606478210649,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001200b3-0072-00ea-0072-00b700050098.png",
        "timestamp": 1606478199220,
        "duration": 35627
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00b5006c-0095-0072-0067-003d00620075.png",
        "timestamp": 1606478255714,
        "duration": 51553
    },
    {
        "description": "Step 6: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 23668,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Expected '49' to be '0'."
        ],
        "trace": [
            "Error: Failed expectation\n    at Assertion.expectEqual (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\assertion.js:420:33)\n    at manageLegalTransactions.AssertLegalTransactions (C:\\Siva-Office\\enterpriseContractManagement\\modules\\manageLegalTransactions.js:191:36)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesOVPApp.spec.js:48:13)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-manage%22%2C%22LegalTransaction-manage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606478308007,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-27 17:28:48.961620 neither metadata nor custom information for filter 'customParameter' -  \"",
                "timestamp": 1606478329013,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\008600d0-007a-00c1-00b7-001e00730054.png",
        "timestamp": 1606478329240,
        "duration": 44930
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28044,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606623090217,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\002800a3-0061-0056-00ea-0004007100fa.png",
        "timestamp": 1606623100684,
        "duration": 3574
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28044,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\004300a8-00c0-00bb-00d0-003800f300f9.png",
        "timestamp": 1606623121797,
        "duration": 7826
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 28044,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606623136552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:45.124899 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606623165170,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.683324 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623166774,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.738264 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623166775,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.757495 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.765479 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.809564 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166811,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.861219 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.896879 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623166900,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.938560 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166941,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.969455 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623166972,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:46.989584 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623166991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.294540 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623167296,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.332885 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623167417,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.417679 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623167419,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.441274 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623167541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.612645 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623167700,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:47.663340 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623167701,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:48.341284 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623168344,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:48.344000 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623168346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:42:48.345300 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623168349,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606623170417,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00bc0038-006b-0082-0039-007a006a001e.png",
        "timestamp": 1606623134550,
        "duration": 36342
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27384,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606623301117,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00740084-0066-0092-002a-005000be0008.png",
        "timestamp": 1606623309050,
        "duration": 4407
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27384,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00000054-0097-00ce-00ea-00e800f300cf.png",
        "timestamp": 1606623314154,
        "duration": 5778
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27384,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606623325938,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:53.437050 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606623353447,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.017094 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623355104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.131745 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623355136,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.166215 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623355171,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.182465 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623355186,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.315139 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623355318,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.424945 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623355428,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.508560 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623355579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:55.556844 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623355580,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.072399 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623356127,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.087344 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623356127,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.313834 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623356321,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.408100 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623356456,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.602649 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623356647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.644090 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623356648,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.929094 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623356933,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:56.990824 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623357069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:57.869135 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623357947,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:57.872889 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623357947,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:45:57.874520 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623357948,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006f00b4-0081-0089-0056-0013000c00df.png",
        "timestamp": 1606623328066,
        "duration": 32116
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27384,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606623360726,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606623364649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606623365166,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0056006a-0007-000b-006d-000f004100c7.png",
        "timestamp": 1606623360881,
        "duration": 51067
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 27384,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00990004-00e4-00bd-00ba-00e6006c0034.png",
        "timestamp": 1606623425003,
        "duration": 52259
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19548,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606623562340,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00c0006d-0001-0084-00de-006e009c0087.png",
        "timestamp": 1606623570379,
        "duration": 4544
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19548,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00ad0075-009f-0043-0077-004800b700a1.png",
        "timestamp": 1606623575785,
        "duration": 5563
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19548,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606623591163,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:19.483830 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606623619503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:21.188104 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623621279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:21.314939 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623621319,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:21.337550 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623621437,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:21.346899 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623621438,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:22.015875 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623622083,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:22.814104 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623622820,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:22.874879 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623622881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:22.934895 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623622943,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.010584 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623623017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.069264 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623623076,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.227689 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623234,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.330939 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.405280 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.471229 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623475,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.552300 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623557,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:23.635104 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623623639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:24.291070 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623624298,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:24.305205 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623624310,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:50:24.306965 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623624311,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00bd00a5-008e-00ea-0032-004000f80001.png",
        "timestamp": 1606623587326,
        "duration": 40394
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19548,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606623628279,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006c00c4-006e-0051-00cf-004a00c20045.png",
        "timestamp": 1606623628349,
        "duration": 1076
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19548,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606623642570,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606623642570,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006100eb-00a8-0093-00c3-0088009500ee.png",
        "timestamp": 1606623629921,
        "duration": 48991
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606623746053,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00a300b2-002f-0097-0045-008e00f700f9.png",
        "timestamp": 1606623754654,
        "duration": 3735
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00d3000e-00b4-0084-0074-000d00e300c1.png",
        "timestamp": 1606623759930,
        "duration": 6744
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606623776649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:22.904850 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606623802909,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.564139 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623804650,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.671129 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623804676,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.693594 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623804700,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.703719 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623804708,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.753120 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623804813,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.838604 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623804936,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.890409 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623804937,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.915479 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623804938,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.945149 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623804950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:24.978919 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623805074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:25.027370 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623805075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:25.060695 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623805075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:25.725949 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623805732,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:25.758129 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623805764,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:26.105350 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606623806111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:26.154159 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606623806160,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:26.843229 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623806867,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:26.845909 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623806868,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:53:26.847120 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606623806868,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00cb0037-00e2-00f8-0018-0090002e0038.png",
        "timestamp": 1606623773993,
        "duration": 36712
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606623811418,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00750053-001f-00f3-0011-002700de0092.png",
        "timestamp": 1606623811607,
        "duration": 1156
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606623823907,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606623823908,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00c0004a-00f3-00bb-00b8-005c005e0073.png",
        "timestamp": 1606623813282,
        "duration": 24648
    },
    {
        "description": "Step 6: Navigate the Legal Transactions on clicking Open Issues legend|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-manage%22%2C%22LegalTransaction-manage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606623877533,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e3008b-0096-008c-00af-00bb00b80028.png",
        "timestamp": 1606623839335,
        "duration": 38182
    },
    {
        "description": "Step 7: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 11960,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Expected '49' to be '0'."
        ],
        "trace": [
            "Error: Failed expectation\n    at Assertion.expectEqual (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\assertion.js:420:33)\n    at manageLegalTransactions.AssertLegalTransactions (C:\\Siva-Office\\enterpriseContractManagement\\modules\\manageLegalTransactions.js:191:36)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesFromLegendOVPApp.spec.js:54:13)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-29 09:54:56.324110 neither metadata nor custom information for filter 'customParameter' -  \"",
                "timestamp": 1606623896334,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00ab00ac-008d-0006-00cf-0090003600d0.png",
        "timestamp": 1606623896418,
        "duration": 25242
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606698217555,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\006b0059-00b1-009f-0026-00bd000e0042.png",
        "timestamp": 1606698224659,
        "duration": 3705
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00930001-0091-008a-00bc-00cd00ee00fa.png",
        "timestamp": 1606698256441,
        "duration": 7176
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606698276037,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:10.891969 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606698310922,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.049395 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.081794 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.090979 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.096004 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.126399 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312141,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.163985 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312256,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.172879 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312256,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.177445 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.209195 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312258,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.227510 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312258,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.239635 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312259,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.265919 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698312267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.362820 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312365,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:12.378034 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698312379,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:13.076895 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698313156,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:13.081149 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698313156,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:15.258489 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698315328,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:15.263649 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698315329,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:35:15.264540 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698315330,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00a1004e-0031-000f-005e-00bc00a60032.png",
        "timestamp": 1606698270741,
        "duration": 45491
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606698321890,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606698321891,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606698323363,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00cd008e-0047-001f-005b-0081007200e5.png",
        "timestamp": 1606698316822,
        "duration": 16474
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for On Track from Pie Chart |Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\009f005c-0039-009e-0001-002f00bb0067.png",
        "timestamp": 1606698335270,
        "duration": 32162
    },
    {
        "description": "Step 6: Navigate the Legal Transactions on clicking On Track legend|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00d600e8-00e5-00a5-0063-002e00ef002c.png",
        "timestamp": 1606698380047,
        "duration": 44637
    },
    {
        "description": "Step 7: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status On Track",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 4620,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Expected '12' to be '0'."
        ],
        "trace": [
            "Error: Failed expectation\n    at Assertion.expectEqual (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\assertion.js:420:33)\n    at manageLegalTransactions.AssertLegalTransactions (C:\\Siva-Office\\enterpriseContractManagement\\modules\\manageLegalTransactions.js:191:36)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOnTrackFromLegendOVPApp.spec.js:54:13)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-manage%22%2C%22LegalTransaction-manage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606698438019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:37:13.162225 neither metadata nor custom information for filter 'customParameter' -  \"",
                "timestamp": 1606698438019,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\007b007c-003a-002e-002c-006d00350003.png",
        "timestamp": 1606698425579,
        "duration": 31463
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606698734877,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\001d0047-00b4-00c9-00ee-007e00e40009.png",
        "timestamp": 1606698741834,
        "duration": 3465
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\000600f0-001f-00c1-0062-001d007e00a6.png",
        "timestamp": 1606698745702,
        "duration": 4862
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606698762439,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:17.748574 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606698797816,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.691514 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799780,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.723754 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.749945 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.756054 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799782,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.759739 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799782,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.789820 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799791,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.817129 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.832764 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.862135 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799894,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.882909 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799895,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.912129 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799913,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.937540 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698799939,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:19.989764 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698799991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.017489 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698800019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.044989 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606698800047,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.065469 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606698800067,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.931750 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698800953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.933540 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698800953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 06:43:20.934715 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606698800954,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\005a0031-0059-006a-0008-006700d40052.png",
        "timestamp": 1606698757595,
        "duration": 45521
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606698804042,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00b5005e-00a7-0067-0058-008800000086.png",
        "timestamp": 1606698803491,
        "duration": 863
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Cancelled from Pie Chart |Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\004c0009-003c-006d-00c6-00e700ed0049.png",
        "timestamp": 1606698804693,
        "duration": 5
    },
    {
        "description": "Step 6: Navigate the Legal Transactions on clicking Cancelled legend|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00a900b4-0058-00f2-0004-000e00e10075.png",
        "timestamp": 1606698805073,
        "duration": 7
    },
    {
        "description": "Step 7: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Cancelled",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 6660,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606698815675,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606698815675,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00ae00b4-0033-00b9-006d-0061002e001e.png",
        "timestamp": 1606698805650,
        "duration": 10008
    },
    {
        "description": "Step 1: Navigate to Enterprise Contract Management Overview|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1606719435242,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\00e900f2-0052-003e-00f4-005800410072.png",
        "timestamp": 1606719442398,
        "duration": 2636
    },
    {
        "description": "Step 2: Login|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00bd0042-00ae-0048-008c-00d7004f003b.png",
        "timestamp": 1606719445441,
        "duration": 5244
    },
    {
        "description": "Step 3: Scroll to Total Legal Transaction Status|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 286 Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user's experience. For more help, check https://xhr.spec.whatwg.org/.",
                "timestamp": 1606719529927,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:34.331995 Controller Extension Provider: Error 'TypeError: Cannot read property 'getManifestObject' of null' thrown in sap.ui.fl.PreprocessorImpl; extension provider ignored. -  \"",
                "timestamp": 1606719574424,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.685274 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.722445 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575723,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.740905 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card02Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575743,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.746969 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card01Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575748,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.750709 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card05Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575752,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.795875 CustomData with key aria-label should be written to HTML of Element sap.m.Text#card06Original--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575797,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.820885 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575822,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.842185 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575843,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.855879 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStampsCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575857,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.858985 CustomData with key aria-label should be written to HTML of Element sap.m.Text#docStatusCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575860,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.875794 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.891715 CustomData with key aria-label should be written to HTML of Element sap.m.Text#pendinTasksCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.932169 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575965,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.969114 Value '' is not valid for type 'sap.m.DeviationIndicator'. -  \"",
                "timestamp": 1606719575970,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.978469 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskCompletionCardOriginal_Tab1--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575979,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:35.988645 CustomData with key aria-label should be written to HTML of Element sap.m.Text#taskProcessingTimeCardOriginal--ovpUoMTitle but the value is not a string. -  FioriElements: OVP.ui.CustomData\"",
                "timestamp": 1606719575989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:36.738830 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606719576769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:36.743514 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606719576769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:29:36.744165 formatter function sap.ovp.cards.AnnotationHelper.setAlignmentForDataPoint not found! -  \"",
                "timestamp": 1606719576769,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/copilot/ui/Component-preload.js - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606719584281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ccf-715.wdf.sap.corp/sap/opu/odata/sap/ESH_SEARCH_SRV/InteractionEventLists - Failed to load resource: the server responded with a status of 403 ()",
                "timestamp": 1606719648563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 399 Refused to execute inline script because it violates the following Content Security Policy directive: \"script-src 'self' https://ui5.sap.com https://*.int.sap.hana.ondemand.com https://*.int.sap.eu2.hana.ondemand.com https://siteintercept.qualtrics.com https://*.siteintercept.qualtrics.com https://*.api.here.com https://litmus.com https://*.hereapi.cn 'unsafe-eval' \". Either the 'unsafe-inline' keyword, a hash ('sha256-/VHKz8NwB3zHYoprWeMgKKIIeMjEg3qPSCTj6N9YSNE='), or a nonce ('nonce-...') is required to enable inline execution.\n",
                "timestamp": 1606719648564,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-displayOverviewPage%22%2C%22LegalTransaction-displayOverviewPage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 401 (Unauthorized)",
                "timestamp": 1606719648564,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\0051009a-00f8-00a0-00bc-001400ed00b9.png",
        "timestamp": 1606719469914,
        "duration": 184776
    },
    {
        "description": "Step 4: Get legends from the Pie Chard|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00e0007b-00cb-0099-0029-00a800f000e7.png",
        "timestamp": 1606719655029,
        "duration": 783
    },
    {
        "description": "Step 5: Get the Legal Transaction Count for Open Issues from Pie Chart |Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\00400056-004d-00ba-007b-00ba00c8001d.png",
        "timestamp": 1606719656123,
        "duration": 7790
    },
    {
        "description": "Step 6: Navigate the Legal Transactions on clicking Open Issues legend|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "screenshots\\004500b6-00f4-0081-0019-00ad008a00c0.png",
        "timestamp": 1606719664273,
        "duration": 2457
    },
    {
        "description": "Step 7: Assert - Legal transactions count with pie chart|Validate Total Legal transactions for OVM Application - Status Open Issues",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "87.0.4280.66"
        },
        "message": [
            "Expected '49' to be '0'."
        ],
        "trace": [
            "Error: Failed expectation\n    at Assertion.expectEqual (C:\\Users\\C5311489\\AppData\\Roaming\\npm\\node_modules\\vyperForAll\\reuse\\ui5\\common\\modules\\assertion.js:420:33)\n    at manageLegalTransactions.AssertLegalTransactions (C:\\Siva-Office\\enterpriseContractManagement\\modules\\manageLegalTransactions.js:191:36)\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\n    at UserContext.<anonymous> (C:\\Siva-Office\\enterpriseContractManagement\\testScripts\\e2e\\totalLegalTransactionStatusOpenIssuesFromLegendOVPApp.spec.js:59:13)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://help.sap.com/webassistant/DRAFT/catalogue?%7B%22product%22%3A%22SAP_S4HANA_CLOUD%22%2C%22version%22%3A%222102.500%22%2C%22system%22%3A%5Bnull%2C%22%22%5D%2C%22appUrl%22%3A%5B%22LegalTransaction-manage%22%2C%22LegalTransaction-manage!whatsnew%22%5D%2C%22locale%22%3A%22en-US%22%2C%22profile%22%3A%2220001467%22%7D - Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
                "timestamp": 1606719685892,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sapui5nightly184.int.sap.eu2.hana.ondemand.com/resources/sap/ushell_abap/bootstrap/evo/abap.js 62:2487 \"2020-11-30 12:31:32.420014 neither metadata nor custom information for filter 'customParameter' -  \"",
                "timestamp": 1606719692442,
                "type": ""
            }
        ],
        "screenShotFile": "screenshots\\004700ea-00d7-00ba-00bb-00c300070047.png",
        "timestamp": 1606719667216,
        "duration": 36450
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
      if (a.instanceId < b.instanceId) return -1;
      else if (a.instanceId > b.instanceId) return 1;

      if (a.timestamp < b.timestamp) return -1;
      else if (a.timestamp > b.timestamp) return 1;

      return 0;
    });

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });