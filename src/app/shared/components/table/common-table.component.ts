import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';

@Component({
  selector: 'common-table',
  templateUrl: './common-table.component.html',
  styleUrls: ['./common-table.component.scss'],
  standalone: false
})
export class CommonTableComponent<T> implements AfterViewInit {
  /** Heading above the table */
  @Input() title = '';

  /** The list of keys in T to show as columns */
  @Input() columns: string[] = [];

  /** The actual row data */
  @Input() data: T[] = [];

  /** Fires when a row is clicked */
  @Output() rowClick = new EventEmitter<T>();

  /** Reference to the very first row (for hints, etc.) */
  @ViewChild('firstRow', { read: ElementRef, static: true })
  firstRowElement!: ElementRef<HTMLElement>;

  ngAfterViewInit() {
    // now firstRowElement is available
  }

  onRowClick(row: T) {
    this.rowClick.emit(row);
  }
}
