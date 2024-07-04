import { Component, Input } from '@angular/core'
import { StatCategory, TableRow } from './models'
import { UserStatistics } from 'src/app/services/models'

const StatisticToTableCategoryMap: {
  [key in keyof UserStatistics]: StatCategory
} = {
  currentStreak: StatCategory.CURRENT_STREAK,
  maxStreak: StatCategory.MAX_STREAK,
  gamesWon: StatCategory.TOTAL_WINS,
  gamesLost: StatCategory.TOTAL_LOSSES,
  winPercentage: StatCategory.WIN_PERCENTAGE,
  avgNumberOfGuessesPerGame: StatCategory.AVG_NUMBER_OF_GUESSES_PER_GAME,
  timesViewedActiveRoster: StatCategory.TIMES_VIEWED_ACTIVE_ROSTER,
  timesClickedNewGame: StatCategory.TIMES_CLICKED_NEW_GAME,
  totalGamesPlayed: StatCategory.TOTAL_GAMES_PLAYED,
  totalGuessesMade: StatCategory.TOTAL_GUESSES_MADE,
  totalRosterLinkClicks: StatCategory.TOTAL_ROSTER_LINK_CLICKS,
}

@Component({
  selector: 'user-statistics',
  templateUrl: './user-statistics.component.html',
  styleUrls: ['./user-statistics.component.scss'],
})
export class UserStatisticsComponent {
  @Input()
  set statistics(value: UserStatistics) {
    this.tableData = this.getTableData(value)
  }

  protected tableData!: TableRow[]

  private getTableData(value: UserStatistics): TableRow[] {
    return Object.keys(value).map((key) => {
      const categoryKey = key as keyof UserStatistics
      const category = StatisticToTableCategoryMap[categoryKey]
      const stat =
        categoryKey === 'winPercentage' ||
        categoryKey === 'avgNumberOfGuessesPerGame'
          ? value[categoryKey].toFixed(3)
          : value[categoryKey]

      const row: TableRow = {
        category,
        stat,
      }

      return row
    })
  }
}
