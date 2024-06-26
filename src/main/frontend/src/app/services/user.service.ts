import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environment';
import { AuthenticationService } from './authentication.service';
import { User } from './models';
import { transformUserResponse } from '../util/data.util';
import { UserResponse } from '../authentication/authentication-models';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = environment.baseUrl;
  private readonly userEndpoint = '/user';
  private user?: User

  constructor(private http: HttpClient, private auth: AuthenticationService) { }

  public getUser(): Observable<User> {
    const headers = this.auth.getHeaders();
    const reqUrl = `${this.baseUrl}${this.userEndpoint}`;
    
    return this.http.get<UserResponse>(reqUrl, { headers }).pipe(
      map(response => transformUserResponse(response))
    );
  }
}
