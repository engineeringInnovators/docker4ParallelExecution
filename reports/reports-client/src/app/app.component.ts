import { Component, ElementRef, ViewChild } from '@angular/core';
import { AppService } from './app-service.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild('from') from: ElementRef;
  @ViewChild('to') to: ElementRef;
  @ViewChild('date') date: ElementRef;

  shortDateFormat = "dd.MMM.yyyy";
  specs = {};
  selectedDate = '';
  dates = [];
  filteredDates = [];
  files = [];
  total = { total: 0, passed: 0, failed: 0, inProgress: 0, executionStartTime: 0,totalExecutionTime:0 };
  showFilter = false;
  filteredText = "all";
  activeIndex= 0;

  constructor(private appService: AppService ) {
    this.getFileStructureJson();

    setInterval(() => {
      this.appService
        .apiCall('syncBrowser')
        .subscribe((res) => {

          if (res && res['code'] === 200 && res['data'] && res['new'] && res['data']['dates'] && res['data']['dates'].length && !res['data']['dates'].includes("NaN.undefined.NaN NaN:NaN:NaN")) {
            console.log(res);

            this.specs = res['data']['all'];
            this.filteredDates = res['data']['dates'];
            this.dates = res['data']['dates'];
            this.files = res['data']['files']['files'];
            this.total = res['data']['files']['totalCounts'];
            this.dateSelected(this.dates[0]);
            this.activeIndex = 0;
          }
        })


    }, 10000);
  }



  getFileStructureJson() {
    this.appService
      .apiCall('getfiles', this.selectedDate)
      .subscribe((res) => {
        if (res['code'] === 200 && res['data'] && res['data']['dates'] && res['data']['dates'].length) {
          this.specs = res['data']['all'];
          this.dates = res['data']['dates'];
          this.filteredDates = res['data']['dates'];
          this.files = res['data']['files']['files'];
          this.total = res['data']['files']['totalCounts']
        } else {
          this.specs = {};
          this.selectedDate = '';
        }
      })


  }

  dateSelected(event = "") {
    console.log(event);

    // this.selectedDate = event;
    if (event == "all") {
      this.filteredDates = this.dates;
      event = this.dates[0];
    } else if (event == 'date') {
      event = this.getDate(this.date.nativeElement.value, this.shortDateFormat);
      this.filteredDates = this.getFilteredDates([event]);
      this.filteredText = event;
      this.clickFilterIcon();
    }



    if (this.specs && this.specs[event]) {
      this.files = this.specs[event].files;
      this.total = this.specs[event]['totalCounts'];
    }
  }

  clickFilterIcon() {
    this.showFilter = !this.showFilter;
  }

  fromToSelected() {
    const from = this.from.nativeElement.value;
    const to = this.to.nativeElement.value;

    if (from && to) {
      const _dates = this.getFromAndToDates(from, to);

      if (_dates.length) {
        this.filteredDates = this.getFilteredDates(_dates);
        this.dateSelected(_dates[0]);
      }


      this.filteredText = this.getDate(from, this.shortDateFormat) + " - " + this.getDate(to, this.shortDateFormat);
      this.clickFilterIcon();
    }
  }


  getFromAndToDates(from_date, to_date) {
    let current_date = new Date(from_date);
    const end_date = new Date(to_date);

    let getTimeDiff = current_date.getTime() - end_date.getTime();

    if (getTimeDiff > 0) return [];

    getTimeDiff = Math.abs(getTimeDiff);
    const date_range = Math.ceil(getTimeDiff / (1000 * 3600 * 24));

    let dates = new Array();

    for (let i = 0; i <= date_range; i++) {
      dates.push(this.getDate(current_date, this.shortDateFormat));
      current_date.setDate(current_date.getDate() + 1);
    }
    return dates;
  }

  selectFilter(filter) {
    let _dates = [];

    switch (filter) {
      case "All": {
        this.dateSelected('all');
        break;
      }
      case "Today": {
        _dates = this.getNumberDates(1);
        break;
      }
      case "Past 2 Days": {
        _dates = this.getNumberDates(2);
        break;
      }
      case "Past 3 Days": {
        _dates = this.getNumberDates(3);
        break;
      }
      case "Past 7 Days": {
        _dates = this.getNumberDates(7);
        break;
      }
    }

    console.log({
      _dates
    });


    if (_dates.length) {
      this.filteredDates = this.getFilteredDates(_dates);
      this.dateSelected(_dates[0]);
    }
    this.filteredText = filter;
    this.clickFilterIcon();

    // document.getElementById("selectedFilter").innerText = filter;
  }

  // markSelectedForFirstDate() {
  //   document.querySelector('[data-date]').classList.add('active');
  // }

  getFilteredDates(_dates = []) {
    console.log(_dates);

    let filtered = [];
    _dates.forEach(_date => {
      this.dates.forEach(date => {
        if (date.includes(_date))
          filtered.push(date);
      })
    });
    return filtered;
  }

  getNumberDates(days = 1) {

    let dates = [];

    for (let i = 0; i < days; i++) {
      dates.push(this.subtractDays(i));
    }

    return dates;
  }

  subtractDays(day = 1) {
    let date = new Date();

    date.setDate(date.getDate() - day);

    return this.getDate(date, this.shortDateFormat);
  }

  // calculatePercentage(passed, total) {
  //   return ((passed / total) * 360);
  // }

  // loadFile(href) {
  //   var xmlhttp = new XMLHttpRequest();
  //   xmlhttp.open("GET", href, false);
  //   xmlhttp.send();
  //   return xmlhttp.responseText;
  // }


  getDate(date, format = "dd.MMM.yyyy HH:MM:SS") {
    if (date === 'now') date = new Date();
    else if (typeof date === "string" && date.match(/[0-9]{2}[A-Z][a-z]{2}[0-9]{4}[0-9]{2}[0-9]{2}[0-9]{2}/)) {
      date = date.replace(/([0-9]{2})([A-Z][a-z]{2})([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})/, "$2-$1-$3 $4:$5:$6");
    }
    date = new Date(date);

    if (format) {

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const HH = String(date.getHours()).padStart(2, "0"),
        MM = String(date.getMinutes()).padStart(2, "0"),
        SS = String(date.getSeconds()).padStart(2, "0"),
        dd = String(date.getDate()).padStart(2, "0"),
        mm = String(date.getMonth() + 1).padStart(2, "0"),
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
}