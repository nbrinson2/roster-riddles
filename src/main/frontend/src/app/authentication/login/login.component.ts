import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { RegisterFormKeys } from '../authentication-models';

@Component({
  selector: 'login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  @Input() loginIsValid = false;
  @Output() goToRegisterEvent = new EventEmitter();
  @Output() validateEvent = new EventEmitter<FormGroup>();
  @Output() loginEvent = new EventEmitter<FormGroup>();

  protected loginForm!: FormGroup;

  constructor(private authenticationService: AuthenticationService,
    private formBuilder: FormBuilder) { }

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      [RegisterFormKeys.EMAIL]: [''],
      [RegisterFormKeys.PASSWORD]: [''],
    });
  }

  protected onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.validateEvent.emit(this.loginForm);

    if (!this.loginIsValid) {
      return;
    }

    this.loginEvent.emit(this.loginForm);
  }

  protected goToRegister() {
    this.goToRegisterEvent.emit();
  }

  protected validate(): void {
    this.validateEvent.emit(this.loginForm);
  }
}
