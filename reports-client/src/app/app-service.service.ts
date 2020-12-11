import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor(private http: HttpClient) { }
  
  apiCall(url = 'getfiles', date = ""): Observable<Object> {
    return this.http.get('http://localhost:8082/'+url,{params: {date}});
  }
}
