import { AttributeHeader } from '../models';

export const MlbHeaders: AttributeHeader[] = [
  { name: 'TEAM', colSpan: 1, class: 'team-column' },
  { name: 'LG./DIV.', colSpan: 2, class: 'lg-div-column' },
  { name: 'B', colSpan: 1, class: 'b-column' },
  { name: 'T', colSpan: 1, class: 't-column' },
  { name: 'BORN', colSpan: 2, class: 'born-column' },
  { name: 'AGE', colSpan: 1, class: 'age-column' },
  { name: 'POS.', colSpan: 1, class: 'pos-column' },
];

export const NflHeaders: AttributeHeader[] = [
  { name: 'TEAM', colSpan: 1, class: 'team-column' },
  { name: 'LG./DIV.', colSpan: 2, class: 'lg-div-column' },
  { name: '#', colSpan: 1, class: 'jersey-number-column' },
  { name: 'COLLEGE', colSpan: 2, class: 'college-column' },
  { name: 'DRAFT', colSpan: 1, class: 'draft-year-column' },
  { name: 'AGE', colSpan: 1, class: 'age-column' },
  { name: 'POS', colSpan: 1, class: 'pos-column' },
];

