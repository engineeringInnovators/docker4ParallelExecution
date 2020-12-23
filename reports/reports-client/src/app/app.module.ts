import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { CardComponent } from './card/card.component';
import { DatesComponent } from './dates/dates.component';
import { DonutComponent } from './donut/donut.component';


@NgModule({
  declarations: [
    AppComponent,
    CardComponent,
    DatesComponent,
    DonutComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
