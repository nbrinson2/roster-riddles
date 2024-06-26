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
    access_token: string;
    refresh_token: string;
    user: UserResponse;
}

export interface UserResponse {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
    total_games_played: number;
    games_won: number;
    games_lost: number;
    total_guesses_made: number;
    total_roster_link_clicks: number;
    last_active: string;
    user_role: string;
    locked: boolean;
    enabled: boolean;
    times_clicked_new_game: number;
    current_streak: number;
    max_streak: number;
    win_percentage: number;
    avg_number_of_guesses_per_game: number;
    times_viewed_active_roster: number;
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
