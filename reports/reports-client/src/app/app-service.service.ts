import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppService {

  constructor(private http: HttpClient) { }

  apiCall(url = 'getfiles', date: any = ""): Observable<Object> {
    // console.log({date});

    return this.http.get(environment.host + url, { params: { date } });
  }

  getReasons(folder: string, url = 'get_error_reasons/'): Observable<Object> {
    return this.http.get(environment.host + url + folder);
  }

  getReason(folder: string, filename: string, url = 'get_error_reason/'): Observable<Object> {
    return this.http.get(environment.host + url + folder + "/" + filename);
  }

  patchReason(url = 'update_error_reason', data = {}): Observable<Object> {
    return this.http.patch(environment.host + url, data);
  }
}
