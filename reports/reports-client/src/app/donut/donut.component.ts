import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-donut',
  templateUrl: './donut.component.html',
  styleUrls: ['./donut.component.css']
})
export class DonutComponent implements OnInit {
  
  @HostBinding('style.--value')
  @Input('value') value = 50;
  @HostBinding('style.--total')
  @Input('total') total = 50;
  @Input('legend') legend = "test";
  @Input('dasharray') dasharray = "25 100";
  @HostBinding('style.--stroke')
  @Input('stroke') stroke: string = "darkred";
  @HostBinding('style.--fill')
  @Input('fill') fill: string = "darkred";

  @Output() filterDates = new EventEmitter<string>();


  constructor() { }

  ngOnInit(): void {
  }

  filterSelected(type) {
    this.filterDates.emit(type);
  }

}
