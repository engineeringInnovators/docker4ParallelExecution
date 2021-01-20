import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-error-reason',
  templateUrl: './error-reason.component.html',
  styleUrls: ['./error-reason.component.css']
})
export class ErrorReasonComponent implements OnInit {

  @Input('baseUrl') baseUrl = "";
  @Input('counts') counts = [];
  @Output() filterReason = new EventEmitter<any>();

  constructor() { }

  ngOnInit(): void {
  }

  reasonClicked(fileNames) {
    // console.log({fileNames});
    
    this.filterReason.emit(fileNames);
  }

}
