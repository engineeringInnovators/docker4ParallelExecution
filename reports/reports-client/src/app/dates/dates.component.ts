import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-dates',
  templateUrl: './dates.component.html',
  styleUrls: ['./dates.component.css']
})
export class DatesComponent implements OnInit, OnChanges {

  @Input('activeIndex') activeIndex = 0;
  @Input('dates') dates = [];
  @Output() dateSelected = new EventEmitter<string>();

  // dates = [];

  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    if(changes && changes['dates'] && String(changes['dates'].currentValue) !=  String(changes['dates'].previousValue)) {
      this.dates = changes['dates'].currentValue;
    }
    if(changes && changes['activeIndex'] && String(changes['activeIndex'].currentValue) !=  String(changes['activeIndex'].previousValue)) {
      this.activeIndex = changes['activeIndex'].currentValue;
    }
  }

  ngOnInit(): void {
  }

  loadSpecFiles(date, index){
    if(index == this.activeIndex) return;
    this.dateSelected.emit(date);
    this.activeIndex = index;
  }


}
