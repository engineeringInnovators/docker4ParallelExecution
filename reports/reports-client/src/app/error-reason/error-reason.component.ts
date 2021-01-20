import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-error-reason',
  templateUrl: './error-reason.component.html',
  styleUrls: ['./error-reason.component.css']
})
export class ErrorReasonComponent implements OnInit {

  @Input('baseUrl') baseUrl = "";
  @Input('counts') counts = [];

  constructor() { }

  ngOnInit(): void {
  }

}
