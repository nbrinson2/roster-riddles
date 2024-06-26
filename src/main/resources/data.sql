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
('John', 'Doe', 'john.doe@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 10, 5, 5, 50, 25, 25, 5, 10, 100, NOW(), 'USER', FALSE, TRUE, 3),
('Jane', 'Smith', 'jane.smith@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 20, 10, 10, 100, 50, 50, 10, 20, 200, NOW(), 'ADMIN', FALSE, TRUE, 5),
('Alice', 'Johnson', 'alice.johnson@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 30, 15, 15, 150, 75, 75, 15, 30, 300, NOW(), 'USER', FALSE, TRUE, 7),
('Bob', 'Brown', 'bob.brown@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 40, 20, 20, 200, 100, 100, 20, 40, 400, NOW(), 'MODERATOR', FALSE, TRUE, 9);
