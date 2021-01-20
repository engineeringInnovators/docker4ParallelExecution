import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { AppService } from '../app-service.service';

@Component({
  selector: 'app-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnInit {
  @Input('files') files = [];
  @Output() counts = new EventEmitter<any>();
  host = window.location.href;
  isPopUpOpen = false;
  form: FormGroup;
  selectedFile = {}

  constructor(private appService: AppService) { }

  ngOnInit(): void {
    this.form = new FormGroup({
      errorType: new FormControl(''),
      // otherReason: new FormControl(''),
    })
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes && changes['files'] && String(changes['files'].currentValue) != String(changes['files'].previousValue)) {
      this.files = changes['files'].currentValue;
    }
  }

  errorClicked(file?) {
    // console.log(file);
    this.isPopUpOpen = !this.isPopUpOpen;
    if (file) {
      this.selectedFile = {
        folder: /[0-9]{2}[A-Z]{1}[a-z]{2}[0-9]{10}/.exec(file['path'])[0],
        filename: file['filename']
      }

      this.appService
        .getReason(this.selectedFile['folder'], this.selectedFile['filename'])
        .subscribe(res => {
          if (res && res['code'] === 200) {
            this.form.patchValue({ errorType: res['data']['reason'] });
          }
        })

    }
  }

  updateReason() {
    // console.log(this.form.value);
    if (!this.selectedFile || !this.form.value['errorType']) return;

    let data = { ...this.form.value, ...this.selectedFile };

    this.appService.patchReason("update_error_reason", data).subscribe((res) => {
      if (res && res['code'] === 200) {
        // console.log(res['data']);
        this.counts.emit(res['data']);
        this.form.reset();
        this.errorClicked();

      }
    })
  }

}
