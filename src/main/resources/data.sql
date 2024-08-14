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
('Guest', 'User', 'guest@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 0, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), 'USER', FALSE, TRUE, 0),
('Harry', 'Miller', 'harry.miller@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 10, 5, 5, 50, 25, 25, 5, 10, 100, NOW(), 'USER', FALSE, TRUE, 3),
('Larry', 'Smith', 'larry.smith@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 20, 10, 10, 100, 50, 50, 10, 20, 200, NOW(), 'USER', FALSE, TRUE, 5),
('Barry', 'Johnson', 'barry.johnson@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 30, 15, 15, 150, 75, 75, 15, 30, 300, NOW(), 'USER', FALSE, TRUE, 7),
('Perry', 'Brown', 'perry.brown@example.com', '$2a$10$KRmLzslk2D4PWinBZ3/TG.HiGRPLj4NWhzwVB0Y7Tb9hXnoCwhgdK', NOW(), 40, 20, 20, 200, 100, 100, 20, 40, 400, NOW(), 'USER', FALSE, TRUE, 9);



CREATE TABLE leagues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    league_name VARCHAR(50) NOT NULL
);

-- Insert seed data into leagues table
INSERT INTO leagues (id, league_name) VALUES
(1, 'MLB'),
(2, 'NFL'),
(3, 'NBA'),
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


-- Sequence for player id based 50 players inserted
CREATE SEQUENCE player_sequence
START WITH 51
INCREMENT BY 1;

CREATE TABLE baseball_players (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country_of_birth VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    league_id BIGINT NOT NULL,
    team VARCHAR(10) NOT NULL,
    batting_hand VARCHAR(10) NOT NULL,
    throwing_hand VARCHAR(10) NOT NULL,
    league_division VARCHAR(50) NOT NULL,
    position VARCHAR(50) NOT NULL,
    FOREIGN KEY (league_id) REFERENCES leagues(id)
);

-- 50 players
INSERT INTO baseball_players (name, country_of_birth, age, league_id, team, batting_hand, throwing_hand, league_division, position)
VALUES
('John Doe', 'USA', 25, 1, 'Yankees', 'R', 'R', 'AL East', 'Pitcher'),
('Jane Smith', 'Canada', 28, 1, 'Blue Jays', 'L', 'L', 'AL East', 'Catcher'),
('Mike Johnson', 'USA', 22, 1, 'Red Sox', 'R', 'L', 'AL East', 'First Base'),
('Emily Davis', 'Dominican Republic', 30, 1, 'Dodgers', 'L', 'R', 'NL West', 'Second Base'),
('Chris Brown', 'Venezuela', 26, 1, 'Giants', 'R', 'R', 'NL West', 'Third Base'),
('Patricia Wilson', 'Cuba', 24, 1, 'Marlins', 'L', 'L', 'NL East', 'Shortstop'),
('David Miller', 'Japan', 29, 1, 'Yankees', 'R', 'R', 'AL East', 'Left Field'),
('Sarah Martinez', 'Mexico', 27, 1, 'Blue Jays', 'L', 'L', 'AL East', 'Center Field'),
('James Anderson', 'USA', 23, 1, 'Red Sox', 'R', 'R', 'AL East', 'Right Field'),
('Mary Thomas', 'South Korea', 31, 1, 'Dodgers', 'R', 'L', 'NL West', 'Pitcher'),
('Robert Taylor', 'Cuba', 25, 1, 'Giants', 'L', 'R', 'NL West', 'Catcher'),
('Linda White', 'USA', 28, 1, 'Marlins', 'R', 'R', 'NL East', 'First Base'),
('Mark Harris', 'Canada', 22, 1, 'Yankees', 'L', 'L', 'AL East', 'Second Base'),
('Karen Clark', 'Dominican Republic', 30, 1, 'Blue Jays', 'R', 'R', 'AL East', 'Third Base'),
('Thomas Lewis', 'Venezuela', 26, 1, 'Red Sox', 'R', 'L', 'AL East', 'Shortstop'),
('Jessica Robinson', 'Cuba', 24, 1, 'Dodgers', 'L', 'R', 'NL West', 'Left Field'),
('Charles Walker', 'Japan', 29, 1, 'Giants', 'R', 'R', 'NL West', 'Center Field'),
('Betty Hall', 'Mexico', 27, 1, 'Marlins', 'L', 'L', 'NL East', 'Right Field'),
('Steven Allen', 'USA', 23, 1, 'Yankees', 'R', 'R', 'AL East', 'Pitcher'),
('Dorothy Young', 'South Korea', 31, 1, 'Blue Jays', 'R', 'L', 'AL East', 'Catcher'),
('Joseph Hernandez', 'Cuba', 25, 1, 'Red Sox', 'L', 'R', 'AL East', 'First Base'),
('Sandra King', 'USA', 28, 1, 'Dodgers', 'R', 'R', 'NL West', 'Second Base'),
('Daniel Wright', 'Canada', 22, 1, 'Giants', 'L', 'L', 'NL West', 'Third Base'),
('Nancy Lopez', 'Dominican Republic', 30, 1, 'Marlins', 'R', 'R', 'NL East', 'Shortstop'),
('Paul Scott', 'Venezuela', 26, 1, 'Yankees', 'R', 'L', 'AL East', 'Left Field'),
('Donna Green', 'Cuba', 24, 1, 'Blue Jays', 'L', 'R', 'AL East', 'Center Field'),
('Kevin Adams', 'Japan', 29, 1, 'Red Sox', 'R', 'R', 'AL East', 'Right Field'),
('Michelle Baker', 'Mexico', 27, 1, 'Dodgers', 'L', 'L', 'NL West', 'Pitcher'),
('Edward Gonzalez', 'USA', 23, 1, 'Giants', 'R', 'R', 'NL West', 'Catcher'),
('Dorothy Nelson', 'South Korea', 31, 1, 'Marlins', 'R', 'L', 'NL East', 'First Base'),
('Brian Carter', 'Cuba', 25, 1, 'Yankees', 'L', 'R', 'AL East', 'Second Base'),
('Karen Mitchell', 'USA', 28, 1, 'Blue Jays', 'R', 'R', 'AL East', 'Third Base'),
('George Perez', 'Canada', 22, 1, 'Red Sox', 'L', 'L', 'AL East', 'Shortstop'),
('Helen Roberts', 'Dominican Republic', 30, 1, 'Dodgers', 'R', 'R', 'NL West', 'Left Field'),
('Ronald Turner', 'Venezuela', 26, 1, 'Giants', 'R', 'L', 'NL West', 'Center Field'),
('Betty Phillips', 'Cuba', 24, 1, 'Marlins', 'L', 'R', 'NL East', 'Right Field'),
('Jason Campbell', 'Japan', 29, 1, 'Yankees', 'R', 'R', 'AL East', 'Pitcher'),
('Shirley Parker', 'Mexico', 27, 1, 'Blue Jays', 'L', 'L', 'AL East', 'Catcher'),
('Albert Evans', 'USA', 23, 1, 'Red Sox', 'R', 'R', 'AL East', 'First Base'),
('Martha Edwards', 'South Korea', 31, 1, 'Dodgers', 'R', 'L', 'NL West', 'Second Base'),
('Henry Collins', 'Cuba', 25, 1, 'Giants', 'L', 'R', 'NL West', 'Third Base'),
('Diane Stewart', 'USA', 28, 1, 'Marlins', 'R', 'R', 'NL East', 'Shortstop'),
('Gary Sanchez', 'Canada', 22, 1, 'Yankees', 'L', 'L', 'AL East', 'Left Field'),
('Julie Morris', 'Dominican Republic', 30, 1, 'Blue Jays', 'R', 'R', 'AL East', 'Center Field'),
('Larry Rogers', 'Venezuela', 26, 1, 'Red Sox', 'R', 'L', 'AL East', 'Right Field'),
('Ruth Reed', 'Cuba', 24, 1, 'Dodgers', 'L', 'R', 'NL West', 'Pitcher'),
('Walter Cook', 'Japan', 29, 1, 'Giants', 'R', 'R', 'NL West', 'Catcher'),
('Beverly Bell', 'Mexico', 27, 1, 'Marlins', 'L', 'L', 'NL East', 'First Base'),
('Carl Bailey', 'USA', 23, 1, 'Yankees', 'R', 'R', 'AL East', 'Second Base'),
('Ruth Rivera', 'South Korea', 31, 1, 'Blue Jays', 'R', 'L', 'AL East', 'Third Base');


CREATE TABLE football_players (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    league_id BIGINT NOT NULL,
    team VARCHAR(10) NOT NULL,
    jersey_number INT NOT NULL,
    college VARCHAR(255) NOT NULL,
    draft_year INT NOT NULL,
    league_division VARCHAR(50) NOT NULL,
    position VARCHAR(50) NOT NULL,
    FOREIGN KEY (league_id) REFERENCES leagues(id)
);


-- 50 players
INSERT INTO football_players (name, age, league_id, team, jersey_number, college, draft_year, league_division, position)
VALUES
('John Doe', 24, 1, 'Falcons', 12, 'University of Alabama', 2021, 'NFC South', 'Quarterback'),
('Mike Smith', 22, 2, 'Giants', 45, 'Ohio State University', 2022, 'NFC East', 'Running Back'),
('David Johnson', 25, 1, 'Cowboys', 32, 'University of Texas', 2020, 'NFC East', 'Wide Receiver'),
('James Brown', 23, 2, 'Patriots', 56, 'Clemson University', 2021, 'AFC East', 'Linebacker'),
('Chris Davis', 21, 3, 'Seahawks', 78, 'University of Oregon', 2023, 'NFC West', 'Tight End'),
('Brian Lee', 26, 1, '49ers', 9, 'LSU', 2019, 'NFC West', 'Defensive Back'),
('Matt Wilson', 22, 3, 'Bears', 10, 'University of Michigan', 2022, 'NFC North', 'Offensive Tackle'),
('Justin Taylor', 24, 2, 'Dolphins', 33, 'University of Florida', 2021, 'AFC East', 'Cornerback'),
('Kevin White', 23, 1, 'Packers', 55, 'University of Wisconsin', 2022, 'NFC North', 'Safety'),
('Eric Harris', 27, 3, 'Broncos', 70, 'University of Colorado', 2018, 'AFC West', 'Center'),
('Adam Martinez', 22, 2, 'Eagles', 17, 'Penn State University', 2023, 'NFC East', 'Guard'),
('Alex Gonzalez', 24, 1, 'Vikings', 44, 'University of Minnesota', 2021, 'NFC North', 'Defensive End'),
('Ryan Lewis', 25, 3, 'Ravens', 21, 'University of Maryland', 2020, 'AFC North', 'Punter'),
('Jacob Hall', 23, 1, 'Raiders', 88, 'University of Nevada', 2022, 'AFC West', 'Kicker'),
('Ethan Clark', 21, 2, 'Rams', 66, 'USC', 2023, 'NFC West', 'Fullback'),
('Kyle Robinson', 26, 1, 'Chiefs', 7, 'University of Missouri', 2019, 'AFC West', 'Long Snapper'),
('Brandon Hill', 22, 2, 'Steelers', 18, 'University of Pittsburgh', 2022, 'AFC North', 'Quarterback'),
('Sean King', 24, 3, 'Bills', 40, 'Syracuse University', 2021, 'AFC East', 'Wide Receiver'),
('Aaron Wright', 23, 1, 'Titans', 61, 'Vanderbilt University', 2022, 'AFC South', 'Running Back'),
('Nathan Green', 27, 2, 'Texans', 99, 'Texas A&M University', 2018, 'AFC South', 'Linebacker'),
('Tyler Scott', 21, 1, 'Browns', 15, 'Ohio University', 2023, 'AFC North', 'Tight End'),
('Dylan Baker', 25, 2, 'Saints', 20, 'Tulane University', 2020, 'NFC South', 'Defensive Back'),
('Cameron Adams', 22, 3, 'Panthers', 11, 'University of North Carolina', 2022, 'NFC South', 'Offensive Tackle'),
('Joshua Nelson', 24, 1, 'Lions', 53, 'University of Michigan State', 2021, 'NFC North', 'Cornerback'),
('Isaiah Carter', 23, 2, 'Buccaneers', 37, 'University of South Florida', 2022, 'NFC South', 'Safety'),
('Mason Mitchell', 27, 1, 'Colts', 75, 'Purdue University', 2018, 'AFC South', 'Center'),
('Jordan Perez', 21, 3, 'Bengals', 12, 'University of Cincinnati', 2023, 'AFC North', 'Guard'),
('Luke Roberts', 24, 2, 'Chargers', 42, 'UCLA', 2021, 'AFC West', 'Defensive End'),
('Hunter Evans', 22, 1, 'Commanders', 14, 'University of Virginia', 2022, 'NFC East', 'Punter'),
('Brayden Murphy', 26, 3, 'Jaguars', 58, 'University of Florida State', 2019, 'AFC South', 'Kicker'),
('Elijah Collins', 23, 2, 'Cardinals', 90, 'Arizona State University', 2022, 'NFC West', 'Fullback'),
('Nicholas Reed', 21, 1, 'Jets', 13, 'Rutgers University', 2023, 'AFC East', 'Long Snapper'),
('Chase Morgan', 24, 3, 'Falcons', 31, 'University of Georgia', 2021, 'NFC South', 'Quarterback'),
('Isaac Bell', 23, 2, 'Cowboys', 77, 'Texas Tech University', 2022, 'NFC East', 'Wide Receiver'),
('Landon Reed', 27, 1, 'Dolphins', 65, 'University of Miami', 2018, 'AFC East', 'Running Back'),
('Christian Hayes', 22, 2, 'Eagles', 16, 'Temple University', 2022, 'NFC East', 'Linebacker'),
('Jonathan Bennett', 21, 3, '49ers', 19, 'Stanford University', 2023, 'NFC West', 'Tight End'),
('Gabriel Brooks', 25, 2, 'Seahawks', 54, 'University of Washington', 2020, 'NFC West', 'Defensive Back'),
('Charles Foster', 22, 3, 'Bears', 67, 'Northwestern University', 2022, 'NFC North', 'Offensive Tackle'),
('Jordan Butler', 24, 1, 'Patriots', 36, 'Boston College', 2021, 'AFC East', 'Cornerback'),
('Austin Sanders', 23, 2, 'Ravens', 85, 'University of Maryland', 2022, 'AFC North', 'Safety'),
('Thomas Flores', 27, 1, 'Packers', 71, 'University of Wisconsin', 2018, 'NFC North', 'Center'),
('Evan Barnes', 21, 3, 'Chiefs', 29, 'Kansas State University', 2023, 'AFC West', 'Guard'),
('Jason Foster', 25, 2, 'Titans', 80, 'University of Tennessee', 2020, 'AFC South', 'Defensive End'),
('Anthony Perry', 24, 1, 'Bills', 22, 'University of New York', 2021, 'AFC East', 'Punter'),
('Henry Barnes', 23, 2, 'Texans', 64, 'Rice University', 2022, 'AFC South', 'Kicker'),
('Christopher Ward', 22, 3, 'Raiders', 10, 'University of Nevada', 2022, 'AFC West', 'Fullback'),
('Blake Ross', 21, 1, 'Rams', 6, 'UCLA', 2023, 'NFC West', 'Long Snapper');



CREATE TABLE games (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    status VARCHAR(50) NOT NULL,
    remaining_guesses INT NOT NULL,
    number_of_guesses INT NOT NULL DEFAULT 0,
    times_viewed_active_roster INT NOT NULL DEFAULT 0,
    player_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    league_id BIGINT NOT NULL,
    game_type_id BIGINT NOT NULL,
    FOREIGN KEY (player_id) REFERENCES baseball_players(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (game_type_id) REFERENCES game_types(id)
);

-- Assuming league_id = 1 and game_type_id = 1 for all games
-- Guest User's games (10 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, player_id, user_id, league_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 1, 1, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 2, 1, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 3, 1, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'LOSS', 0, 8, 2, 4, 1, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 5, 1, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'WIN', 0, 7, 1, 6, 1, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'LOSS', 0, 9, 2, 7, 1, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 8, 1, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 9, 1, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 10, 1, 1, 1);

-- Harry's games (10 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, player_id, user_id, league_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 11, 2, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 12, 2, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 13, 2, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 14, 2, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 15, 2, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 16, 2, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 17, 2, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 18, 2, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 19, 2, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 20, 2, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 1, 2, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 2, 2, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 3, 2, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 4, 2, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 5, 2, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 6, 2, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 7, 2, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 8, 2, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 9, 2, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 10, 2, 1, 1);


-- Larry's games (20 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, player_id, user_id, league_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 21, 3, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 22, 3, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 23, 3, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 24, 3, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 25, 3, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 26, 3, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 27, 3, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 28, 3, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 29, 3, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 30, 3, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 1, 3, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 2, 3, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 3, 3, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 4, 3, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 5, 3, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 6, 3, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 7, 3, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 8, 3, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 9, 3, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 10, 3, 1, 1),
('2024-06-30 10:00:00', '2024-06-30 10:30:00', 'WIN', 0, 5, 2, 11, 3, 1, 1),
('2024-07-01 11:00:00', '2024-07-01 11:30:00', 'LOSS', 0, 7, 1, 12, 3, 1, 1),
('2024-07-02 12:00:00', '2024-07-02 12:30:00', 'WIN', 0, 6, 2, 13, 3, 1, 1),
('2024-07-03 13:00:00', '2024-07-03 13:30:00', 'WIN', 0, 8, 2, 14, 3, 1, 1),
('2024-07-04 14:00:00', '2024-07-04 14:30:00', 'WIN', 0, 5, 3, 15, 3, 1, 1),
('2024-07-05 15:00:00', '2024-07-05 15:30:00', 'LOSS', 0, 7, 1, 16, 3, 1, 1),
('2024-07-06 16:00:00', '2024-07-06 16:30:00', 'WIN', 0, 9, 2, 17, 3, 1, 1),
('2024-07-07 17:00:00', '2024-07-07 17:30:00', 'WIN', 0, 6, 3, 18, 3, 1, 1),
('2024-07-08 18:00:00', '2024-07-08 18:30:00', 'LOSS', 0, 8, 2, 19, 3, 1, 1),
('2024-07-09 19:00:00', '2024-07-09 19:30:00', 'WIN', 0, 5, 3, 20, 3, 1, 1);


-- Barry's games (30 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, player_id, user_id, league_id, game_type_id) VALUES
('2024-06-10 10:00:00', '2024-06-10 10:30:00', 'WIN', 0, 5, 2, 31, 4, 1, 1),
('2024-06-11 11:00:00', '2024-06-11 11:30:00', 'LOSS', 0, 7, 1, 32, 4, 1, 1),
('2024-06-12 12:00:00', '2024-06-12 12:30:00', 'WIN', 0, 6, 2, 33, 4, 1, 1),
('2024-06-13 13:00:00', '2024-06-13 13:30:00', 'WIN', 0, 8, 2, 34, 4, 1, 1),
('2024-06-14 14:00:00', '2024-06-14 14:30:00', 'WIN', 0, 5, 3, 35, 4, 1, 1),
('2024-06-15 15:00:00', '2024-06-15 15:30:00', 'LOSS', 0, 7, 1, 36, 4, 1, 1),
('2024-06-16 16:00:00', '2024-06-16 16:30:00', 'WIN', 0, 9, 2, 37, 4, 1, 1),
('2024-06-17 17:00:00', '2024-06-17 17:30:00', 'WIN', 0, 6, 3, 38, 4, 1, 1),
('2024-06-18 18:00:00', '2024-06-18 18:30:00', 'LOSS', 0, 8, 2, 39, 4, 1, 1),
('2024-06-19 19:00:00', '2024-06-19 19:30:00', 'WIN', 0, 5, 3, 40, 4, 1, 1),
('2024-06-20 10:00:00', '2024-06-20 10:30:00', 'WIN', 0, 5, 2, 41, 4, 1, 1),
('2024-06-21 11:00:00', '2024-06-21 11:30:00', 'LOSS', 0, 7, 1, 42, 4, 1, 1),
('2024-06-22 12:00:00', '2024-06-22 12:30:00', 'WIN', 0, 6, 2, 43, 4, 1, 1),
('2024-06-23 13:00:00', '2024-06-23 13:30:00', 'WIN', 0, 8, 2, 44, 4, 1, 1),
('2024-06-24 14:00:00', '2024-06-24 14:30:00', 'WIN', 0, 5, 3, 45, 4, 1, 1),
('2024-06-25 15:00:00', '2024-06-25 15:30:00', 'LOSS', 0, 7, 1, 46, 4, 1, 1),
('2024-06-26 16:00:00', '2024-06-26 16:30:00', 'WIN', 0, 9, 2, 47, 4, 1, 1),
('2024-06-27 17:00:00', '2024-06-27 17:30:00', 'WIN', 0, 6, 3, 48, 4, 1, 1),
('2024-06-28 18:00:00', '2024-06-28 18:30:00', 'LOSS', 0, 8, 2, 49, 4, 1, 1),
('2024-06-29 19:00:00', '2024-06-29 19:30:00', 'WIN', 0, 5, 3, 50, 4, 1, 1),
('2024-06-30 10:00:00', '2024-06-30 10:30:00', 'WIN', 0, 5, 2, 1, 4, 1, 1),
('2024-07-01 11:00:00', '2024-07-01 11:30:00', 'LOSS', 0, 7, 1, 2, 4, 1, 1),
('2024-07-02 12:00:00', '2024-07-02 12:30:00', 'WIN', 0, 6, 2, 3, 4, 1, 1),
('2024-07-03 13:00:00', '2024-07-03 13:30:00', 'WIN', 0, 8, 2, 4, 4, 1, 1),
('2024-07-04 14:00:00', '2024-07-04 14:30:00', 'WIN', 0, 5, 3, 5, 4, 1, 1),
('2024-07-05 15:00:00', '2024-07-05 15:30:00', 'LOSS', 0, 7, 1, 6, 4, 1, 1),
('2024-07-06 16:00:00', '2024-07-06 16:30:00', 'WIN', 0, 9, 2, 7, 4, 1, 1),
('2024-07-07 17:00:00', '2024-07-07 17:30:00', 'WIN', 0, 6, 3, 8, 4, 1, 1),
('2024-07-08 18:00:00', '2024-07-08 18:30:00', 'LOSS', 0, 8, 2, 9, 4, 1, 1),
('2024-07-09 19:00:00', '2024-07-09 19:30:00', 'WIN', 0, 5, 3, 10, 4, 1, 1),
('2024-07-10 10:00:00', '2024-07-10 10:30:00', 'WIN', 0, 5, 2, 11, 4, 1, 1),
('2024-07-11 11:00:00', '2024-07-11 11:30:00', 'LOSS', 0, 7, 1, 12, 4, 1, 1),
('2024-07-12 12:00:00', '2024-07-12 12:30:00', 'WIN', 0, 6, 2, 13, 4, 1, 1),
('2024-07-13 13:00:00', '2024-07-13 13:30:00', 'WIN', 0, 8, 2, 14, 4, 1, 1),
('2024-07-14 14:00:00', '2024-07-14 14:30:00', 'WIN', 0, 5, 3, 15, 4, 1, 1),
('2024-07-15 15:00:00', '2024-07-15 15:30:00', 'LOSS', 0, 7, 1, 16, 4, 1, 1),
('2024-07-16 16:00:00', '2024-07-16 16:30:00', 'WIN', 0, 9, 2, 17, 4, 1, 1),
('2024-07-17 17:00:00', '2024-07-17 17:30:00', 'WIN', 0, 6, 3, 18, 4, 1, 1),
('2024-07-18 18:00:00', '2024-07-18 18:30:00', 'LOSS', 0, 8, 2, 19, 4, 1, 1),
('2024-07-19 19:00:00', '2024-07-19 19:30:00', 'WIN', 0, 5, 3, 20, 4, 1, 1);


-- Perry's games (10 games)
INSERT INTO games (start_time, end_time, status, remaining_guesses, number_of_guesses, times_viewed_active_roster, player_id, user_id, league_id, game_type_id) VALUES
('2024-07-01 09:00:00', '2024-07-01 09:30:00', 'WIN', 0, 5, 2, 1, 5, 1, 1),
('2024-07-02 10:00:00', '2024-07-02 10:30:00', 'LOSS', 0, 7, 1, 2, 5, 1, 1),
('2024-07-03 11:00:00', '2024-07-03 11:30:00', 'WIN', 0, 6, 2, 3, 5, 1, 1),
('2024-07-04 12:00:00', '2024-07-04 12:30:00', 'LOSS', 0, 8, 2, 4, 5, 1, 1),
('2024-07-05 13:00:00', '2024-07-05 13:30:00', 'WIN', 0, 5, 3, 5, 5, 1, 1),
('2024-07-06 14:00:00', '2024-07-06 14:30:00', 'WIN', 0, 7, 1, 6, 5, 1, 1),
('2024-07-07 15:00:00', '2024-07-07 15:30:00', 'LOSS', 0, 9, 2, 7, 5, 1, 1),
('2024-07-08 16:00:00', '2024-07-08 16:30:00', 'WIN', 0, 6, 3, 8, 5, 1, 1),
('2024-07-09 17:00:00', '2024-07-09 17:30:00', 'LOSS', 0, 8, 2, 9, 5, 1, 1),
('2024-07-10 18:00:00', '2024-07-10 18:30:00', 'WIN', 0, 5, 3, 10, 5, 1, 1);

