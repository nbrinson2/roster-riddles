import { Component, EventEmitter, Output } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';
import { Title, UserRegisterRequest, RegisterField, RegisterFormKeys, ValidatorColor, ValidatorSymbol, PasswordCriteria, UserLoginRequest, ResponseError, RegisterResponse } from './authentication-models';
import { FormBuilder, FormGroup } from '@angular/forms';
import { User } from '../shared/models/models';
import { HttpErrorResponse } from '@angular/common/http';

interface Validator {
  name: RegisterField;
  symbol: ValidatorSymbol;
  color: string;
}

interface PasswordCriteriaObject {
  name: PasswordCriteria;
  color: ValidatorColor;
}

@Component({
  selector: 'authentication',
  templateUrl: './authentication.component.html',
  styleUrls: ['./authentication.component.scss']
})
export class AuthenticationComponent {

  @Output() openProfile = new EventEmitter<User>();

  protected activationRequired = false;
  protected registerForm!: FormGroup;
  protected title = Title.LOGIN;
  protected isValid = false;
  protected isLogin = true;
  protected loginIsValid = false;
  protected passwordCriteria: PasswordCriteriaObject[] = [
    { name: PasswordCriteria.UPPER_CASE, color: ValidatorColor.ORANGE },
    { name: PasswordCriteria.LOWER_CASE, color: ValidatorColor.ORANGE },
    { name: PasswordCriteria.ONE_NUMBER, color: ValidatorColor.ORANGE },
    { name: PasswordCriteria.SPECIAL, color: ValidatorColor.ORANGE },
    { name: PasswordCriteria.MIN_LENGTH, color: ValidatorColor.ORANGE },
  ];
  protected validators: Validator[] = [
    { name: RegisterField.FIRST_NAME, symbol: ValidatorSymbol.INVALID, color: ValidatorColor.ORANGE },
    { name: RegisterField.LAST_NAME, symbol: ValidatorSymbol.INVALID, color: ValidatorColor.ORANGE },
    { name: RegisterField.EMAIL, symbol: ValidatorSymbol.INVALID, color: ValidatorColor.ORANGE },
    { name: RegisterField.PASSWORD, symbol: ValidatorSymbol.INVALID, color: ValidatorColor.ORANGE },
  ];

  // Regular expression that requires one upper case letter, 
  // one lower case letter, one numeric digit, one special character, 
  // and length at least 8 characters
  private passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
  private emailPattern = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;

  constructor(private authenticationService: AuthenticationService,
    private formBuilder: FormBuilder) { }

  ngOnInit(): void {
    this.registerForm = this.formBuilder.group({
      [RegisterFormKeys.FIRST_NAME]: [''],
      [RegisterFormKeys.LAST_NAME]: [''],
      [RegisterFormKeys.EMAIL]: [''],
      [RegisterFormKeys.PASSWORD]: [''],
    });
  }

  protected changeFormTemplate(): void {
    this.isLogin = !this.isLogin;
    this.title = this.isLogin ? Title.LOGIN : Title.REGISTER;
    this.registerForm.reset();
    this.loginIsValid = false;
    this.isValid = false;
    this.passwordCriteria = this.passwordCriteria.map(criteria => {
      return { ...criteria, color: ValidatorColor.ORANGE };
    });

    this.validators = this.validators.map(validator => {
      return { ...validator, symbol: ValidatorSymbol.INVALID, color: ValidatorColor.ORANGE };
    });

  }

  protected validateLogin(form: FormGroup): void {
    const email = form.value.email;
    const password = form.value.password;
    const isValueEmpty = email === '' || email === undefined || email === null ||
      password === '' || password === null || password === undefined;

    if (this.emailPattern.test(email) && this.passwordPattern.test(password) && !isValueEmpty) {
      this.loginIsValid = true;
    }
  }

  protected loginUser(form: FormGroup): void {
    const request: UserLoginRequest = form.value;
    this.authenticationService.login(request).subscribe({
      next: (user: User) => {
        this.openProfile.emit(user);
      },
      error: (response: HttpErrorResponse) => {
        const error: ResponseError = response.error;
        console.error(error);
      },
    });
  }

  protected registerUser(request: UserRegisterRequest): void {
    this.authenticationService.register(request).subscribe({ 
      next: (response: RegisterResponse) => {
        if (response.success) {
          this.activationRequired = true;
          this.changeFormTemplate();
        }
      },
      error: (response: HttpErrorResponse) => {
        const error: ResponseError = response.error;
        console.error(error);
      }
  });
  }

  protected onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    const request: UserRegisterRequest = this.registerForm.value;
    this.registerUser(request);
  }

  protected validateAndSetColor(registerField: string): void {
    const value = this.registerForm.get(registerField)?.value;
    const isValueEmpty = value === '' || value === undefined || value === null;

    switch (registerField) {
      case RegisterFormKeys.FIRST_NAME:
        const firstNameValidator = this.validators.find(validator => validator.name === RegisterField.FIRST_NAME);
        if (!firstNameValidator) {
          return;
        }

        if (!isValueEmpty) {
          firstNameValidator.color = ValidatorColor.BLUE;
          firstNameValidator.symbol = ValidatorSymbol.VALID
        } else {
          firstNameValidator.color = ValidatorColor.ORANGE;
          firstNameValidator.symbol = ValidatorSymbol.INVALID;
        }
        break;
      case RegisterFormKeys.LAST_NAME:
        const lastNameValidator = this.validators.find(validator => validator.name === RegisterField.LAST_NAME);
        if (!lastNameValidator) {
          return;
        }

        if (!isValueEmpty) {
          lastNameValidator.color = ValidatorColor.BLUE;
          lastNameValidator.symbol = ValidatorSymbol.VALID;
        } else {
          lastNameValidator.color = ValidatorColor.ORANGE;
          lastNameValidator.symbol = ValidatorSymbol.INVALID;
        }
        break;
      case RegisterFormKeys.EMAIL:
        const emailValidator = this.validators.find(validator => validator.name === RegisterField.EMAIL);
        if (!emailValidator) {
          return;
        }

        if (this.emailPattern.test(value) && !isValueEmpty) {
          emailValidator.color = ValidatorColor.BLUE;
          emailValidator.symbol = ValidatorSymbol.VALID;
        } else {
          emailValidator.color = ValidatorColor.ORANGE;
          emailValidator.symbol = ValidatorSymbol.INVALID;
        }
        break;
      case RegisterFormKeys.PASSWORD:
        const passwordValidator = this.validators.find(validator => validator.name === RegisterField.PASSWORD);
        if (!passwordValidator) {
          return;
        }

        this.updatePasswordCriteriaColors(value);

        if (this.passwordPattern.test(value) && !isValueEmpty) {
          passwordValidator.color = ValidatorColor.BLUE;
          passwordValidator.symbol = ValidatorSymbol.VALID;
        } else {
          passwordValidator.color = ValidatorColor.ORANGE;
          passwordValidator.symbol = ValidatorSymbol.INVALID;
        }
        break;
      default:
        return;
    }

    this.checkIsValid();
  }

  private updatePasswordCriteriaColors(formValue: string): void {
    const upperCasePattern = /[A-Z]/;     // Matches any uppercase letter
    const lowerCasePattern = /[a-z]/;     // Matches any lowercase letter
    const numericalPattern = /[0-9]/;     // Matches any number
    const specialCharacterPattern = /[\!\@\#\$\%\^\&\*\(\)\-\_\=\+\[\]\{\}\\\|\;\'\:\"\,\.\/\<\>\?]/;     // Matches any special character
    const minLength = /.{8,}/;     // Matches any character (.) at least 8 times ({8,})

    if (upperCasePattern.test(formValue)) {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.UPPER_CASE)!.color = ValidatorColor.BLUE;
    } else {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.UPPER_CASE)!.color = ValidatorColor.ORANGE;
    }

    if (lowerCasePattern.test(formValue)) {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.LOWER_CASE)!.color = ValidatorColor.BLUE;
    } else {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.LOWER_CASE)!.color = ValidatorColor.ORANGE;
    }

    if (numericalPattern.test(formValue)) {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.ONE_NUMBER)!.color = ValidatorColor.BLUE;
    } else {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.ONE_NUMBER)!.color = ValidatorColor.ORANGE;
    }

    if (specialCharacterPattern.test(formValue)) {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.SPECIAL)!.color = ValidatorColor.BLUE;
    } else {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.SPECIAL)!.color = ValidatorColor.ORANGE;
    }

    if (minLength.test(formValue)) {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.MIN_LENGTH)!.color = ValidatorColor.BLUE;
    } else {
      this.passwordCriteria.find(p => p.name === PasswordCriteria.MIN_LENGTH)!.color = ValidatorColor.ORANGE;
    }
  }

  private checkIsValid(): void {
    this.isValid = this.passwordCriteria.every(criteria => criteria.color === ValidatorColor.BLUE) &&
      this.validators.every(validator => validator.color === ValidatorColor.BLUE);
  }
}
