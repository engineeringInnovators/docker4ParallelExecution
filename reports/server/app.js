const
    rootPath = process.env.templateName || "./results";


const
    express = require('express'),
    http = require('http'),
    app = express(),
    fs = require("fs"),
    path = require("path"),
    bodyParser = require('body-parser');

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(bodyParser.json({
    limit: '16mb'
}));

app.use(express.static(path.join(__dirname, 'templates')));
app.use(express.static(path.join(__dirname, 'reports-client')));

app.set('views', path.join(__dirname, 'reports-client'));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');


// Add headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.get('/syncBrowser', async (req, res) => {
    const struc = await readFiles();
    res.json(struc);
    if (struc.code == 200 && struc.new) {
        const data = {
            totalSpecs: struc.data.totalSpecs,
            files: struc.data.all,
            dates: struc.data.dates,
            new: false,
            // new: struc.data.dates.includes("NaN.undefined.NaN NaN:NaN:NaN"),
            lastModified: Date.now()
        }
        fs.writeFileSync('./fileStructure.json', JSON.stringify(data));
    }

});


app.get('/results/:folder/:spec/report.html', (req, res) => {
    if (req.params.folder) {
        app.use(express.static(path.join(__dirname, `results/${decodeURIComponent(req.params.folder)}/${decodeURIComponent(req.params.spec)}`)));
        app.use(express.static(path.join(__dirname, `results/${decodeURIComponent(req.params.folder)}/${decodeURIComponent(req.params.spec)}/assets`)));
    }
    res.render(path.join(__dirname + decodeURIComponent(req.url)))
});


app.get('/results/:folder/:spec/app.js', (req, res) => {
    res.sendFile(__dirname + decodeURIComponent(req.url));
})

app.get('/results/:folder/:spec/:subfolder/:filename', (req, res) => {
    res.sendFile(__dirname + decodeURIComponent(req.url));
})

app.get('/getfiles', async (req, res) => {
    let date = req.query.date || "";
    res.json(await readFiles(date));

})


app.get("*", (req, res, next) => {
    res.render("index.html");
    next();
})

function readFiles(date) {
    return new Promise(async (res, rej) => {
        try {
            let reportJson = await readJsonFile();

            if (!reportJson.toString()) {
                return res({
                    code: 404
                });
            }

            reportJson = JSON.parse(reportJson.toString());

            let metaData = await readJsonFile("./metadata.json");


            date = !date && reportJson.dates.length ? reportJson.dates[0] : date;
            if (date && reportJson.files[date]) {
                metaData = JSON.parse(metaData.toString());
                // console.log(getDate(date, "ddMMMyyyyHHMMSS"));
                if (metaData[getDate(date, "ddMMMyyyyHHMMSS")]) {
                    reportJson.files[date].totalCounts = {
                        ...reportJson.files[date].totalCounts,
                        ...metaData[getDate(date, "ddMMMyyyyHHMMSS")]
                    };
                }
            }
            // console.log({
            //     date
            // });
            return res({
                code: 200,
                data: {
                    files: date ? reportJson.files[date] : reportJson,
                    dates: reportJson.dates,
                    all: reportJson.files,
                    totalSpecs: reportJson.totalSpecs
                },
                // new: true
                new: reportJson.new
            })
        } catch (error) {
            return rej(error);
        }
    });
}

function readJsonFile(fileName = "./fileStructure.json") {
    return new Promise((res, rej) => {
        try {
            return res(fs.readFileSync(fileName));
        } catch (error) {
            return rej(error);
        }
    })
}

/**
 * Get port from environment and store in Express.
 */


const port = process.env.PORT || '8082';
app.set('port', normalizePort(port));

/**
 * Create HTTP server.
 */
const server = http.createServer(app);


/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

if (!fs.existsSync(rootPath)) {
    console.log("Creating results folder");
    fs.mkdirSync(rootPath);
} else {
    console.log("Results folder found");
}

GetFiles().then().catch(console.log);

console.log("Application started. and watching for files");

const watch = require('node-watch');

watch(rootPath, {
    recursive: true,
    filter(f, skip) {
        // console.log({f, co: /results([\\]|[\/])[0-9]{2}[A-z]{3}[0-9]{10}([\\]|[\/]).*([\\]|[\/])report\.html/.test(f)});
        // 04Dec2020104139
        // 'results\\04Dec2020104139\\off-contract - Copy\\report.html'
        // if (/results([\\]|[\/])[0-9]{2}[A-z]{3}[0-9]{10}([\\]|[\/]).*([\\]|[\/])report\.html/.test(f)) return true;
        // // if (!(/results([\\]|[\/])[0-9]{2}[A-z]{3}[0-9]{10}([\\]|[\/])/.test(f))) return false;
        // else {
        //     // console.log(skip);
        //     return skip;
        // }
        return true;
    }
}, async (evt, name) => {
    console.log('%s changed.', name, evt);
    await GetFiles();
});

function getDate(date, format = "dd.MMM.yyyy HH:MM:SS") {
    if (date === 'now') date = new Date();
    else if (typeof date === "string" && date.match(/[0-9]{2}[A-Z][a-z]{2}[0-9]{4}[0-9]{2}[0-9]{2}[0-9]{2}/)) {
        date = date.replace(/([0-9]{2})([A-Z][a-z]{2})([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})/, "$2-$1-$3 $4:$5:$6");
    }
    date = new Date(date);

    if (format) {

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const HH = String(date.getHours()).padStart(2, 0),
            MM = String(date.getMinutes()).padStart(2, 0),
            SS = String(date.getSeconds()).padStart(2, 0),
            dd = String(date.getDate()).padStart(2, 0),
            mm = String(date.getMonth() + 1).padStart(2, 0),
            m = String(date.getMonth() + 1),
            MMM = months[date.getMonth()],
            yyyy = date.getFullYear();

        format = format
            .replace(/dd/g, dd)
            .replace(/mm/g, mm)
            .replace(/m/g, m)
            .replace(/MMM/g, MMM)
            .replace(/yyyy/g, yyyy)
            .replace(/HH/g, HH)
            .replace(/MM/g, MM)
            .replace(/SS/g, SS);

        date = format;
    }

    return date;

}

function GetFiles(path = rootPath) {

    let _struc = {
        totalSpecs: 0,
        files: {},
        new: true,
        lastModified: Date.now(),
        dates: []
    };

    return new Promise(async (resolve, reject) => {

        try {

            const fileStructure = await readJsonFile("./fileStructure.json");

            let topLevel = await GetTopLevelFolder(path);

            for (let i = 0; i < topLevel.length; i++) {
                // console.log({
                //     file: topLevel[i],
                //     IsEmpty: IsEmpty(`${path}/${topLevel[i]}`)
                // });
                if (IsEmpty(`${path}/${topLevel[i]}`)) continue;

                let metaData = await readJsonFile("./metadata.json");
                metaData = JSON.parse(metaData.toString());
                const formatedDate = getDate(topLevel[i]);

                _struc.dates.push(formatedDate);
                console.log({
                    [formatedDate + " - in progress"]: fileStructure.files[formatedDate].totalCounts.inProgress
                });

                if (fileStructure && fileStructure.files && fileStructure.files[formatedDate] && fileStructure.files[formatedDate].totalCounts && !fileStructure.files[formatedDate].totalCounts.inProgress) {
                    _struc.files[formatedDate] = fileStructure.files[formatedDate];
                    _struc.totalSpecs += _struc.files[formatedDate].files.length;
                    continue;
                } else {
                    console.log("Status is in progress for: " + formatedDate);
                }

                _struc.files[formatedDate] = await GetStatDetails(`${path}/${topLevel[i]}`);

                // while(getDate(topLevel[i]) === "NaN.undefined.NaN NaN:NaN:NaN") {}
                const reports = await GetHtmlReportFiles(`${path}/${topLevel[i]}`);
                _struc.files[formatedDate].files = reports.files;




                if (!metaData[topLevel[i]]) {

                    metaData[topLevel[i]] = {
                        "total": 100,
                        "inProgress": 60,
                        "completed": 40,
                        "executionStartTime": 1607600326703,
                        "executionEndTime": 1607600326703,
                        "totalExecutionTime": 15
                    };
                }

                reports.totalCounts = {
                    ...reports.totalCounts,
                    ...metaData[topLevel[i]]
                };

                _struc.files[formatedDate].totalCounts = reports.totalCounts;

                _struc.totalSpecs += _struc.files[formatedDate].files.length;

                // console.log({_____:await GetHtmlReportFiles(`${path}/${topLevel[i]}`)});

            }
            _struc.dates.reverse();

            let currentJson = fs.readFileSync("./fileStructure.json");
            currentJson = currentJson.toString();
            _struc.new = _struc.totalSpecs != currentJson.totalSpecs;
            fs.writeFileSync("./fileStructure.json", JSON.stringify(_struc));

            // console.log(_struc);
            return resolve(_struc);

        } catch (error) {
            return reject(error)
        }
    });

}

function GetHtmlReportFiles(filepath, files = [], totalCounts = {
    totalSpecs: 0,
    passed: 0,
    failed: 0,
    testCases: 0,
    passedTestCases: 0,
    failedTestCases: 0,
    duration: '0h 0min 0s',
    durationInNumber: 0
}) {
    return new Promise(async (resolve, reject) => {
        try {

            let _file = await GetStatDetails(filepath);
            // console.log(files);
            const folderToExclude = ["screenshots", "fonts", "jsons", "assets"];

            if (_file.type === 'folder') {

                fs.readdirSync(filepath)
                    .map(async function (child) {
                        if (!folderToExclude.includes(child)) {
                            return resolve(await GetHtmlReportFiles(`${filepath}/${child}`, files, totalCounts));
                        }

                    });
            } else {
                if (_file.name.includes(".html")) {
                    const reportPath = _file.path.substring(0, _file.path.lastIndexOf("/") + 1) + "combined.json";
                    let reportJson = fs.readFileSync(reportPath);
                    reportJson = reportJson.toString();

                    _file.passed = reportJson.match(/\\"passed\\":true/g, "");
                    _file.passed = _file.passed ? _file.passed.length : 0;
                    _file.failed = reportJson.match(/\\"passed\\":false/g, "");
                    _file.failed = _file.failed ? _file.failed.length : 0;
                    _file.total = _file.failed + _file.passed;

                    totalCounts.testCases += _file.total;
                    totalCounts.passedTestCases += _file.passed;
                    totalCounts.failedTestCases += _file.failed;

                    totalCounts.totalSpecs++;
                    if (_file.failed) totalCounts.failed++;
                    else totalCounts.passed++;

                    _file.duration = await calucateTotalMinTookForExecution(reportJson);
                    _file.durationInNumber = await calucateTotalMinTookForExecution(reportJson, true);
                    // console.log({duration: _file.duration});
                    files.push(_file)
                }
                return resolve({
                    filepath,
                    files,
                    totalCounts
                })
            };

        } catch (error) {
            return reject(error)
        }

    })
}

function GetTopLevelFolder(filepath = rootPath) {
    return new Promise((resolve, reject) => {

        try {

            const file = fs.readdirSync(filepath)
            return resolve(file);

        } catch (error) {
            return reject(error);
        }
    })
}

function IsEmpty(path) {
    return fs.readdirSync(path).length === 0;
}

function calucateTotalMinTookForExecution(json, inNumber = false) {
    return new Promise(async (resolve, reject) => {
        try {
            json = JSON.parse(JSON.parse(json));
            let duration = 0;
            // console.log(json.length);
            for (let i = 0; i < json.length; i++) {
                duration += json[i].duration;
            }
            return resolve(inNumber ? duration : await getDuration(duration));
        } catch (error) {
            return reject("0h 0min 0s")
        }
    })
}

function getDuration(duration) {
    return new Promise((resolve, reject) => {
        if (duration == null) {
            return "NaN";
        }
        const hmsS = duration / 1000;
        const hmsHr = Math.trunc(hmsS / 60 / 60);
        const hmsM = hmsS / 60;
        const hmsMr = Math.trunc(hmsM - hmsHr * 60);
        const hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr * 60);
        return resolve("".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s"));
    });
}


function GetStatDetails(filepath) {

    return new Promise((resolve, reject) => {
        try {

            const stats = fs.lstatSync(filepath);
            return resolve({
                type: stats.isDirectory() ? "folder" : "file",
                name: path.basename(filepath),
                filename: stats.isDirectory() ? path.basename(filepath) : filepath.split("/")[filepath.split("/").length - 2],
                path: filepath,
                dateModified: stats.mtime,
                dateCreated: stats.ctime
            })

        } catch (error) {
            return reject(error)
        }
    })

}



/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port;
    console.log('Listening on ' + bind);
}