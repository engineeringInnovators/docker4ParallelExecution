import { Component, HostBinding, Input, OnInit } from '@angular/core';

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
  percentage = 50;
  // @HostBinding('style.--value')
  // @Input('value') targetValue: number = 50;
  @HostBinding('style.--stroke')
  @Input('stroke') stroke: string = "darkred";
  @HostBinding('style.--fill')
  @Input('fill') fill: string = "darkred";
  // @HostBinding('style.--total')
  // @Input('fill') targetTotal: number = 50;


  constructor() { }

  ngOnInit(): void {
  }

}
