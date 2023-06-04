import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment';

export interface UserResponse {
  user: {
    name: string;
  }
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = environment.baseUrl;
  private readonly userEndpoint = '/user';

  constructor(private http: HttpClient) { }

  public getUser(): Observable<UserResponse> {
    const reqUrl = `${this.baseUrl}${this.userEndpoint}`;
    const response = this.http.get<UserResponse>(reqUrl);
    return response;
  }
}
