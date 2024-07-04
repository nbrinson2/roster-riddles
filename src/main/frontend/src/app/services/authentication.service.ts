import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from 'src/environment';
import { LoginResponse, RegisterResponse, UserLoginRequest, UserRegisterRequest, UserResponse } from '../authentication/authentication-models';
import { User } from './models';
import { transformUserResponse } from '../util/data.util';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  get activeUser(): Signal<User> {
    return this._user.asReadonly();
  }

  private readonly baseUrl = environment.baseUrl;
  private readonly registerEndpoint = '/auth/register';
  private readonly loginEndpoint = '/auth/login';
  private token = '';
  private _user = signal<User>({id: 1} as User);

  constructor(private http: HttpClient) { }

  public register(request: UserRegisterRequest): Observable<RegisterResponse> {
    const reqUrl = `${this.baseUrl}${this.registerEndpoint}`;
    return this.http.post<RegisterResponse>(reqUrl, request);
  }

  public login(request: UserLoginRequest): Observable<User> {
    const reqUrl = `${this.baseUrl}${this.loginEndpoint}`;
    return this.http.post<LoginResponse>(reqUrl, request).pipe(
      map(data => {
        const userResponse: UserResponse = data.user;
        const user: User = transformUserResponse(userResponse);
        this._user.set(user);
        this.token = data.access_token;

        return user;
      })
    );
  }

  public getHeaders() {
    return { 'Authorization': 'Bearer ' + this.token };
  }
}
