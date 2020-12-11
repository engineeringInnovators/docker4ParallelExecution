import { Component, Input, OnInit, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnInit {
  @Input('files') files = [];
  host = window.location.href;
  constructor() { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    if(changes && changes['files'] && String(changes['files'].currentValue) !=  String(changes['files'].previousValue)) {
      this.files = changes['files'].currentValue;
    }
  }
  
  calculatePercentage(passed= 0, total= 1) {
    return ((passed / total) * 360);
  }

}
