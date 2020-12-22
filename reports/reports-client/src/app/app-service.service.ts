import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor(private http: HttpClient) { }

  apiCall(url = 'getfiles', date:any = ""): Observable<Object> {
    // console.log({date});
    
    return this.http.get(environment.host + url, { params: { date } });
  }
}
