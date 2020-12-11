const shortDateFormat = "dd.MMM.yyyy";

function loadSpecFiles(date, elem) {
    const card = loadFile("card.html");



    let spec = JSON.parse(loadFile("fileStructure.json"));

    console.log({
        date
    });

    let content = "";

    console.log({
        spec: spec.files[date]
    });

    if (spec.files[date]) {
        for (let i = 0; i < spec.files[date].files.length; i++) {
            content += card
                .replace("{{SPEC_NUMBER}}", i + 1)
                .replace(/{{CLASS}}/g, spec.files[date].files[i].failed ? "failed" : "passed")
                .replace("{{LINK}}", spec.files[date].files[i].path)
                .replace("{{FILE_NAME}}", spec.files[date].files[i].filename)
                .replace(/{{PASSED}}/g, spec.files[date].files[i].passed)
                .replace(/{{TOTAL}}/g, spec.files[date].files[i].total)
                .replace(/{{FAILED}}/g, spec.files[date].files[i].failed)
                .replace(/{{PERCENTAGE}}/g, calculatePercentage(spec.files[date].files[i].passed, spec.files[date].files[i].total))
                .replace("{{DATE_CREATED}}", getDate(spec.files[date].files[i].dateCreated, "MMM dd, yyyy HH:MM"))
                .replace("{{DATE_MODIFIED}}", getDate(spec.files[date].files[i].dateModified, "MMM dd, yyyy HH:MM"));
        }
    }

    document.getElementsByClassName("container")[0].innerHTML = content;

    document.getElementById("TOTAL_SPECS").innerHTML = spec.files[date] ? spec.files[date].totalCounts.totalSpecs : 0;
    document.getElementById("TOTAL_SPECS_PASSED").innerHTML = spec.files[date] ? spec.files[date].totalCounts.passed : 0;
    document.getElementById("TOTAL_SPECS_FAILED").innerHTML = spec.files[date] ? spec.files[date].totalCounts.failed : 0;
    // document.getElementById("TEST_CASES").innerHTML = spec.files[date] ? spec.files[date].totalCounts.testCases : 0;
    // document.getElementById("TEST_CASES_PASSED").innerHTML = spec.files[date] ? spec.files[date].totalCounts.passedTestCases : 0;
    // document.getElementById("TEST_CASES_FAILED").innerHTML = spec.files[date] ? spec.files[date].totalCounts.failedTestCases : 0;

    let allElements = Array.from(document.querySelectorAll('li.date.active'))
    for (let element of allElements) {
        element.classList.remove('active')
    }

    if (elem)
        elem.classList.add('active');
    else
        markSelectedForFirstDate();

    clickFilterIcon(true);

}

function dateSelected(event = {}, datesArr = [], custom = false) {

    const selectedDate = event.value === 'all' ? "all" : getDate(event.value, shortDateFormat);
    let dates = loadFile("dates.html");

    const struc = JSON.parse(loadFile("fileStructure.json"));

    let filteredDate = "",
        firstDate = "";

    for (let i = Object.keys(struc.files).length - 1; i >= 0; i--) {
        const date = getDate(Object.keys(struc.files)[i], shortDateFormat);
        console.log({
            date,
            selectedDate
        });

        // console.log(selectedDate, date,selectedDate === date);

        if (selectedDate === date || selectedDate === 'all' || datesArr.includes(date)) {
            if (!firstDate) firstDate = Object.keys(struc.files)[i];
            filteredDate += dates
                .replace(/{{DATE}}/g, Object.keys(struc.files)[i])
                .replace("{{DATE_INDEX}}", i);
        }

    }

    document.getElementsByClassName("dates")[0].innerHTML = filteredDate;

    console.log({
        firstDate
    });
    if (firstDate)
        loadSpecFiles(firstDate)
    else {
        document.getElementsByClassName("dates")[0].innerHTML = "<li style='text-align:center; width: 100%;'>Reports not found</li>"
        document.getElementsByClassName("container")[0].innerHTML = "";
        document.getElementById("TOTAL_SPECS").innerHTML = 0;
        document.getElementById("TOTAL_SPECS_PASSED").innerHTML = 0;
        document.getElementById("TOTAL_SPECS_FAILED").innerHTML = 0;
        // document.getElementById("TEST_CASES").innerHTML = 0;
        // document.getElementById("TEST_CASES_PASSED").innerHTML = 0;
        // document.getElementById("TEST_CASES_FAILED").innerHTML = 0;
    }

    if (custom) {
        document.getElementById("selectedFilter").innerText = getDate(event.value, shortDateFormat);
    }

    clickFilterIcon(true);
}

function clickFilterIcon(close = false) {
    if (document.getElementById('filter-ul').style.display === "none" && !close)
        document.getElementById('filter-ul').style.display = "block";
    else document.getElementById('filter-ul').style.display = "none";
}

function fromToSelected() {
    const from = document.getElementById("from").value;
    const to = document.getElementById("to").value;


    if (from && to) {
        const dates = getFromAndToDates(from, to);

        if (dates.length)
            dateSelected({}, dates);


        document.getElementById("selectedFilter").innerText = getDate(from, shortDateFormat) + " - " + getDate(to, shortDateFormat);
    }
}


function getFromAndToDates(from_date, to_date) {
    let current_date = new Date(from_date);
    const end_date = new Date(to_date);

    let getTimeDiff = current_date.getTime() - end_date.getTime();

    if (getTimeDiff > 0) return [];

    getTimeDiff = Math.abs(getTimeDiff);
    const date_range = Math.ceil(getTimeDiff / (1000 * 3600 * 24));

    let dates = new Array();

    for (let i = 0; i <= date_range; i++) {
        dates.push(getDate(current_date, shortDateFormat));
        current_date.setDate(current_date.getDate() + 1);
    }
    return dates;
}

function selectFilter(filter) {
    let dates = [];


    switch (filter) {
        case "All": {
            dateSelected({
                value: 'all'
            });
            break;
        }
        case "Today": {
            dates = getNumberDates();
            break;
        }
        case "Past 2 Days": {
            dates = getNumberDates(2);
            break;
        }
        case "Past 3 Days": {
            dates = getNumberDates(3);
            break;
        }
        case "Past 7 Days": {
            dates = getNumberDates(7);
            break;
        }
    }

    console.log({
        dates
    });


    if (dates.length)
        dateSelected({}, dates);

    document.getElementById("selectedFilter").innerText = filter;
}

function markSelectedForFirstDate() {
    document.querySelector('[data-date]').classList.add('active');
}

function getNumberDates(days = 1) {

    let dates = [];

    for (let i = 0; i < days; i++) {
        dates.push(subtractDays(i));
    }

    return dates;
}

function subtractDays(day = 1) {
    let date = new Date();

    date.setDate(date.getDate() - day);

    return getDate(date, shortDateFormat);
}

function calculatePercentage(passed, total) {
    return ((passed / total) * 360);
}

function loadFile(href) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", href, false);
    xmlhttp.send();
    return xmlhttp.responseText;
}


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