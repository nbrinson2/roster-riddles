import {
  AfterViewInit,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  Signal,
  signal,
  TemplateRef,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { HintService, HintType } from '../hint/hint.service';
import { HintArrowPosition } from '../hint/hint.component';

export enum RowHeight {
  SMALL = '40px',
  MEDIUM = '60px',
  LARGE = '100px',
}

@Component({
  selector: 'common-table',
  templateUrl: './common-table.component.html',
  styleUrls: ['./common-table.component.scss'],
  standalone: false,
})
export class CommonTableComponent<T> implements AfterViewInit {
  @Input() title!: string;
  @Input() subtitle?: string;
  @Input() columns!: string[];
  @Input() rowHeight: RowHeight = RowHeight.SMALL;
  @Input() set data(value: T[]) {
    this._data = value;
    this._currentData.set([]);
    this.currentPage = 0;
    this.pageSize = 100;
    this.loadMoreData(value);
    this.resetScroll();
  }

  /** Hint config: whether to show, which hint type, arrow position */
  @Input() hintType: HintType = HintType.BIO_BALL_ROSTER_PLAYER_SELECT;
  @Input() arrowPosition: HintArrowPosition = HintArrowPosition.TOP_LEFT;
  @Input() hintTargetRow = 5;

  @Output() rowClick = new EventEmitter<T>();

  /** Reference to the very first row (for hints, etc.) */
  @ViewChild('firstRow', { read: ElementRef, static: true })
  firstRowElement!: ElementRef<HTMLElement>;

  /** Reference to the content container */
  @ViewChild('contentContainer', { read: ElementRef, static: true })
  contentContainer!: ElementRef<HTMLElement>;

  /** Reference to the data rows */
  @ViewChildren('dataRow', { read: ElementRef })
  dataRows!: QueryList<ElementRef<HTMLElement>>;

  /** Parent can supply <ng-template #teamsCell>…</ng-template> */
  @ContentChild('teamsCell', { static: false })
  teamsCellTpl?: TemplateRef<{ $implicit: T }>;

  /** Current page of data */
  get currentData(): Signal<T[]> {
    return this._currentData.asReadonly();
  }

  protected currentTarget!: HTMLElement;

  private _data!: T[];
  private _currentData = signal<T[]>([]);
  private pageSize!: number;
  private currentPage!: number;

  constructor(private hintService: HintService) {}

  ngAfterViewInit() {
    this.dataRows.changes.subscribe(() => {
      const rows = this.dataRows.toArray();
      if (rows.length >= this.hintTargetRow) {
        const targetRow = rows[this.hintTargetRow - 1].nativeElement;
        const cells = targetRow.querySelectorAll('td');
        const middleIndex = Math.floor(cells.length / 2);
        const middleCell = cells[middleIndex] as HTMLElement;
        this.currentTarget = middleCell;

        this.hintService.showHint(this.hintType);
      }
    });

    // in case they were already there
    this.dataRows.notifyOnChanges();
    this.resetScroll();
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 100; // pixels from bottom to trigger load
    const isNearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold;

    if (isNearBottom) {
      this.loadMoreData();
    }
  }

  private resetScroll() {
    setTimeout(() => {
      if (this.contentContainer?.nativeElement) {
        this.contentContainer.nativeElement.scrollTop = 0;
      }
    });
  }

  private loadMoreData(value?: T[]) {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const newData = value?.slice(start, end) ?? this._data.slice(start, end);
    this._currentData.set([...this._currentData(), ...newData]);
    this.currentPage++;
  }
}
