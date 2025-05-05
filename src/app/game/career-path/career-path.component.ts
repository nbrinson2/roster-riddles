import { Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { HintService } from 'src/app/shared/components/hint/hint.service';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';
import { GAME_SERVICE } from '../../shared/utils/game-service.token';
import { TeamAbbreviationToFullNameMap } from '../bio-ball/constants/bio-ball-constants';
import {
  TeamFullName,
  TeamType
} from '../bio-ball/models/bio-ball.models';
import { RosterSelectionService } from '../bio-ball/services/roster-selection/roster-selection.service';
import {
  InputPlaceHolderText
} from '../bio-ball/util/bio-ball.util';
import { CareerPathPlayer, TeamStint } from './models/career-path.models';
import {
  CareerPathEngineService,
  GameState,
} from './services/career-path-engine/career-path-engine.service';

export interface Data {
  players: CareerPathPlayer[];
}

@Component({
  selector: 'career-path',
  templateUrl: './career-path.component.html',
  styleUrl: './career-path.component.scss',
  standalone: false,
})
export class CareerPathComponent {
  public readonly GameState = GameState;

  get selectedPlayers(): CareerPathPlayer[] {
    return this.gameService.selectedPlayers();
  }

  get gameState(): GameState {
    return this.gameService.gameState();
  }

  constructor(
    private route: ActivatedRoute,
    private hintService: HintService,
    private slideUpService: SlideUpService,
    private rosterSelectionService: RosterSelectionService,
    @Inject(GAME_SERVICE) private gameService: CareerPathEngineService
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      const players = (d as Data).players;
      this.gameService.startNewGame(players);
    });
  }

  protected selectTeam(team: TeamStint): void {
    this.hintService.hasShownFirstPlayerHint = true;
    this.gameService.numberOfGuesses++;

    if (this.gameService.gameState() === GameState.LOST) {
      this.gameService.onLose();
      return;
    }

    this.gameService.searchInputPlaceHolderText = `${
      this.gameService.allowedGuesses - this.gameService.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;

    const rosterByYears = this.gameService.allPlayers.filter((player) =>
      player.groups.some((group) =>
        group.stints.some(
          (stint) =>
            stint.teamKey === team.teamKey &&
            stint.from <= team.to &&
            stint.to >= team.from
        )
      )
    );
    const years =
      team.from === team.to ? `${team.from}` : `${team.from}-${team.to}`;
    const teamName = TeamAbbreviationToFullNameMap[
      team.teamKey as TeamType
    ] as TeamFullName;

    this.rosterSelectionService.selectRosterByYears(
      rosterByYears,
      years,
      teamName
    );
  }
}
