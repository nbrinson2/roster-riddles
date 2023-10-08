import { Component, Input } from '@angular/core';
import { UserStatistics } from 'src/app/services/user.service';
import { StatCategory, TableRow } from './models';

const StatisticToTableCategoryMap: { [key in keyof UserStatistics]: StatCategory } = {
  currentStreak: StatCategory.CURRENT_STREAK,
  maxStreak: StatCategory.MAX_STREAK,
  totalWins: StatCategory.TOTAL_WINS,
  totalLosses: StatCategory.TOTAL_LOSSES,
  winPercentage: StatCategory.WIN_PERCENTAGE,
  avgNumberOfGuessesPerGame: StatCategory.AVG_NUMBER_OF_GUESSES_PER_GAME,
  timesViewedActiveRoster: StatCategory.TIMES_VIEWED_ACTIVE_ROSTER,
  timesClickedNewGame: StatCategory.TIMES_CLICKED_NEW_GAME,
}

@Component({
  selector: 'user-statistics',
  templateUrl: './user-statistics.component.html',
  styleUrls: ['./user-statistics.component.scss']
})
export class UserStatisticsComponent {
  @Input()
  set statistics(value: UserStatistics) {
    this.tableData = this.getTableData(value);
  }

  protected tableData!: TableRow[];

  private getTableData(value: UserStatistics): TableRow[] {
    return Object.keys(value).map(key => {
      const categoryKey = key as keyof UserStatistics;
      const category = StatisticToTableCategoryMap[categoryKey];
      const stat = value[categoryKey];
  
      const row: TableRow = { 
        category, 
        stat
      };
  
      return row;
    });
  }
  }
