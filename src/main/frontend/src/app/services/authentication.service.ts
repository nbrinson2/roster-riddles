import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment';
import { AuthenticationResponse, UserRegisterRequest } from '../authentication/authentication-models';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private readonly baseUrl = environment.baseUrl;
  private readonly registerEndpoint = '/auth/register';
  private readonly loginEndpoint = '/auth/login';

  constructor(private http: HttpClient) { }

  public register(request: UserRegisterRequest): Observable<AuthenticationResponse> {
    const reqUrl = `${this.baseUrl}${this.registerEndpoint}`;
    const response = this.http.post<AuthenticationResponse>(reqUrl, request);

    return response;
  }
}
