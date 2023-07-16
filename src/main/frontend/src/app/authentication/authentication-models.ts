export interface UserRegisterRequest {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export interface AuthenticationResponse {
    success: boolean;
}

export enum Title {
    LOGIN = 'Login',
    REGISTER = 'Register',
}

export enum RegisterField {
    FIRST_NAME = 'First Name',
    LAST_NAME = 'Last Name',
    EMAIL = 'Email',
    PASSWORD = 'Password',
}

export enum RegisterFormKeys {
    FIRST_NAME = 'firstName',
    LAST_NAME = 'lastName',
    EMAIL = 'email',
    PASSWORD = 'password',    
}

export enum ValidatorSymbol {
    VALID = 'done',
    INVALID = 'close',
}

export enum ValidatorColor {
    ORANGE = 'orange',
    BLUE = 'blue',
}

export enum PasswordCriteria {
    UPPER_CASE = 'One Uppercase, ',
    LOWER_CASE = 'One Lowercase, ',
    ONE_NUMBER = 'One Number, ',
    SPECIAL = 'One Special Char., ',
    MIN_LENGTH = 'Min. 8 Len.',
}
