import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  ContentChild,
  TemplateRef,
  OnInit,
  Signal,
  signal,
  AfterViewInit
} from '@angular/core';

export enum RowHeight {
  SMALL = '40px',
  MEDIUM = '60px',
  LARGE = '100px',
}

@Component({
  selector: 'common-table',
  templateUrl: './common-table.component.html',
  styleUrls: ['./common-table.component.scss'],
  standalone: false
})
export class CommonTableComponent<T> implements AfterViewInit {
  /** Heading above the table */
  @Input() title!: string;

  /** Subtitle above the table */
  @Input() subtitle?: string;

  /** The list of keys in T to show as columns */
  @Input() columns!: string[];

  /** The height of the rows */
  @Input() rowHeight: RowHeight = RowHeight.SMALL;

  /** The actual row data */
  @Input() set data(value: T[]) {
    this._data = value;
    this._currentData.set([]);
    this.currentPage = 0;
    this.pageSize = 100;
    this.loadMoreData(value);
    this.resetScroll();
  }

  /** Fires when a row is clicked */
  @Output() rowClick = new EventEmitter<T>();

  /** Reference to the very first row (for hints, etc.) */
  @ViewChild('firstRow', { read: ElementRef, static: true })
  firstRowElement!: ElementRef<HTMLElement>;

  /** Reference to the content container */
  @ViewChild('contentContainer', { read: ElementRef, static: true })
  contentContainer!: ElementRef<HTMLElement>;

  /** Parent can supply <ng-template #teamsCell>…</ng-template> */
  @ContentChild('teamsCell', { static: false })
  teamsCellTpl?: TemplateRef<{ $implicit: T }>;

  /** Current page of data */
  get currentData(): Signal<T[]> {
    return this._currentData.asReadonly();
  }

  private _data!: T[];
  private _currentData = signal<T[]>([]);
  private pageSize!: number;
  private currentPage!: number;

  ngAfterViewInit() {
    this.resetScroll();
  }

  private resetScroll() {
    setTimeout(() => {
      if (this.contentContainer?.nativeElement) {
        this.contentContainer.nativeElement.scrollTop = 0;
      }
    });
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const threshold = 100; // pixels from bottom to trigger load
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    
    if (isNearBottom) {
      this.loadMoreData();
    }
  }

  private loadMoreData(value?: T[]) {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const newData = value?.slice(start, end) ?? this._data.slice(start, end);
    this._currentData.set([...this._currentData(), ...newData]);
    this.currentPage++;
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }
}
