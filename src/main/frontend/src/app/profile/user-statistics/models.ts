export interface TableRow {
    category: StatCategory;
    stat: number;
}

export enum StatCategory {
    CURRENT_STREAK = "Current Streak",
    MAX_STREAK = "Max Streak",
    TOTAL_WINS = "Total Wins",
    TOTAL_LOSSES = "Total Losses",
    WIN_PERCENTAGE = "Win Percentage",
    AVG_NUMBER_OF_GUESSES_PER_GAME = "Avg Guesses Per Game",
    TIMES_VIEWED_ACTIVE_ROSTER = "Times Viewed Active Roster",
    TIMES_CLICKED_NEW_GAME = "Times Clicked New Game",
}
