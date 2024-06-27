import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { UserService } from "../services/user.service";
import { User } from "../services/models";


@Injectable({providedIn: 'root'})
export class UserResolver {
    constructor(private userService: UserService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<User> {
         return this.userService.getUser();
    }
}
