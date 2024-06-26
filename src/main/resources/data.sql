CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    total_games_played INT DEFAULT 0 NOT NULL,
    games_won INT DEFAULT 0 NOT NULL,
    games_lost INT DEFAULT 0 NOT NULL,
    total_guesses_made INT DEFAULT 0 NOT NULL,
    correct_guesses INT DEFAULT 0 NOT NULL,
    incorrect_guesses INT DEFAULT 0 NOT NULL,
    total_hints_used INT DEFAULT 0 NOT NULL,
    total_roster_link_clicks INT DEFAULT 0 NOT NULL,
    total_points INT DEFAULT 0 NOT NULL,
    last_active TIMESTAMP NULL,
    user_role VARCHAR(50),
    locked BOOLEAN DEFAULT FALSE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE NOT NULL,
    times_clicked_new_game INT DEFAULT 0 NOT NULL
);

-- Password: Roster1!
INSERT INTO users (first_name, last_name, email, password_hash, created_at, total_games_played, games_won, games_lost, total_guesses_made, correct_guesses, incorrect_guesses, total_hints_used, total_roster_link_clicks, total_points, last_active, user_role, locked, enabled, times_clicked_new_game)
VALUES 
('Harry', 'Miller', 'harry.miller@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 10, 5, 5, 50, 25, 25, 5, 10, 100, NOW(), 'USER', FALSE, TRUE, 3),
('Larry', 'Smith', 'larry.smith@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 20, 10, 10, 100, 50, 50, 10, 20, 200, NOW(), 'ADMIN', FALSE, TRUE, 5),
('Barry', 'Johnson', 'barry.johnson@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 30, 15, 15, 150, 75, 75, 15, 30, 300, NOW(), 'USER', FALSE, TRUE, 7),
('Perry', 'Brown', 'perry.brown@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 40, 20, 20, 200, 100, 100, 20, 40, 400, NOW(), 'MODERATOR', FALSE, TRUE, 9);



CREATE TABLE sports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sport_name VARCHAR(50) NOT NULL
);

-- Insert seed data into sports table
INSERT INTO sports (id, sport_name) VALUES
(1, 'MLB'),
(2, 'NBA'),
(3, 'NFL'),
(4, 'NHL'),
(5, 'MLS'),
(6, 'PGA');


CREATE TABLE game_types (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_type_name VARCHAR(50) NOT NULL
);

-- Insert seed data into game_types table
INSERT INTO game_types (id, game_type_name) VALUES
(1, 'Roster Riddles');



CREATE TABLE games (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    status VARCHAR(50) NOT NULL,
    remaining_guesses INT NOT NULL,
    number_of_guesses INT NOT NULL DEFAULT 0,
    times_viewed_active_roster INT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL,
    sport_id BIGINT NOT NULL,
    game_type_id BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (sport_id) REFERENCES sports(id),
    FOREIGN KEY (game_type_id) REFERENCES game_types(id)
);

-- Assuming sport_id = 1 and game_type_id = 1 for all games

-- Harry's games (10 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, user_id, sport_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 1, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 1, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 1, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'LOSS', 0, 8, 2, 1, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 1, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'WIN', 0, 7, 1, 1, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'LOSS', 0, 9, 2, 1, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 1, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 1, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 1, 1, 1);

-- Larry's games (20 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, user_id, sport_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 2, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 2, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 2, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 2, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 2, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 2, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 2, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 2, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 2, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 2, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 2, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 2, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 2, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 2, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 2, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 2, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 2, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 2, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 2, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 2, 1, 1);

-- Barry's games (30 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, user_id, sport_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 3, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 3, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 3, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 3, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 3, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 3, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 3, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 3, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 3, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 3, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 3, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 3, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 3, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 3, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 3, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 3, 1, 1),
('2024-06-30 10:00:00', '2024-06-30 10:30:00', 'WIN', 0, 5, 2, 3, 1, 1),
('2024-07-01 11:00:00', '2024-07-01 11:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-07-02 12:00:00', '2024-07-02 12:30:00', 'WIN', 0, 6, 2, 3, 1, 1),
('2024-07-03 13:00:00', '2024-07-03 13:30:00', 'WIN', 0, 8, 2, 3, 1, 1),
('2024-07-04 14:00:00', '2024-07-04 14:30:00', 'WIN', 0, 5, 3, 3, 1, 1),
('2024-07-05 15:00:00', '2024-07-05 15:30:00', 'LOSS', 0, 7, 1, 3, 1, 1),
('2024-07-06 16:00:00', '2024-07-06 16:30:00', 'WIN', 0, 9, 2, 3, 1, 1),
('2024-07-07 17:00:00', '2024-07-07 17:30:00', 'WIN', 0, 6, 3, 3, 1, 1),
('2024-07-08 18:00:00', '2024-07-08 18:30:00', 'LOSS', 0, 8, 2, 3, 1, 1),
('2024-07-09 19:00:00', '2024-07-09 19:30:00', 'WIN', 0, 5, 3, 3, 1, 1);

-- Perry's games (40 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, user_id, sport_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 4, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 4, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 4, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 4, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 4, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 4, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 4, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 4, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 4, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 4, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 4, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 4, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-06-30 10:00:00', '2024-06-30 10:30:00', 'WIN', 0, 5, 2, 4, 1, 1),
('2024-07-01 11:00:00', '2024-07-01 11:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-07-02 12:00:00', '2024-07-02 12:30:00', 'WIN', 0, 6, 2, 4, 1, 1),
('2024-07-03 13:00:00', '2024-07-03 13:30:00', 'WIN', 0, 8, 2, 4, 1, 1),
('2024-07-04 14:00:00', '2024-07-04 14:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-07-05 15:00:00', '2024-07-05 15:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-07-06 16:00:00', '2024-07-06 16:30:00', 'WIN', 0, 9, 2, 4, 1, 1),
('2024-07-07 17:00:00', '2024-07-07 17:30:00', 'WIN', 0, 6, 3, 4, 1, 1),
('2024-07-08 18:00:00', '2024-07-08 18:30:00', 'LOSS', 0, 8, 2, 4, 1, 1),
('2024-07-09 19:00:00', '2024-07-09 19:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-07-10 10:00:00', '2024-07-10 10:30:00', 'WIN', 0, 5, 2, 4, 1, 1),
('2024-07-11 11:00:00', '2024-07-11 11:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-07-12 12:00:00', '2024-07-12 12:30:00', 'WIN', 0, 6, 2, 4, 1, 1),
('2024-07-13 13:00:00', '2024-07-13 13:30:00', 'WIN', 0, 8, 2, 4, 1, 1),
('2024-07-14 14:00:00', '2024-07-14 14:30:00', 'WIN', 0, 5, 3, 4, 1, 1),
('2024-07-15 15:00:00', '2024-07-15 15:30:00', 'LOSS', 0, 7, 1, 4, 1, 1),
('2024-07-16 16:00:00', '2024-07-16 16:30:00', 'WIN', 0, 9, 2, 4, 1, 1),
('2024-07-17 17:00:00', '2024-07-17 17:30:00', 'WIN', 0, 6, 3, 4, 1, 1),
('2024-07-18 18:00:00', '2024-07-18 18:30:00', 'LOSS', 0, 8, 2, 4, 1, 1),
('2024-07-19 19:00:00', '2024-07-19 19:30:00', 'WIN', 0, 5, 3, 4, 1, 1);
