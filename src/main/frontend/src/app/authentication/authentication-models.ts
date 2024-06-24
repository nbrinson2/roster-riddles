export interface AuthHeader {
    "Authorization": string;
}

export interface UserRegisterRequest {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export interface UserLoginRequest {
    email: string;
    password: string;
}

export interface RegisterResponse {
    success: string;
}

export interface LoginResponse {
    user_id: number;
    access_token: string;
    first_name: string;
    last_name: string;
    email: string;
    statistics: UserStatisticsResponse;
}

export interface UserStatisticsResponse {
    user_id: number;
    current_streak: number;
    max_streak: number;
    total_wins: number;
    total_losses: number;
    win_percentage: number;
    avg_number_of_guesses_per_game: number;
    times_viewed_active_roster: number;
    times_clicked_new_game: number;
}

export interface ResponseError {
    error: string;
    message: string;
    path: string;
    status: number;
    timestamp: string;
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
