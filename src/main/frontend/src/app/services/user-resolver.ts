import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { User, UserService } from "./user.service";


@Injectable({providedIn: 'root'})
export class UserResolver {
    constructor(private userService: UserService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<User> {
         return this.userService.getUser();
    }
}
