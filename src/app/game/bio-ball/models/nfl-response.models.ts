export interface NflTeamResponse {
  timestamp: string
  status: string
  season: Season
  athletes: Athlete[]
  coach: Coach[]
  team: TeamDetails
}

export interface Season {
  year: number
  displayName: string
  type: number
  name: string
}

export interface Athlete {
  position: string
  items: Item[]
}

export interface Item {
  id: string
  uid: string
  guid: string
  alternateIds: AlternateIds
  firstName: string
  lastName: string
  fullName: string
  displayName: string
  shortName: string
  weight: number
  displayWeight: string
  height: number
  displayHeight: string
  age: number
  dateOfBirth: string
  links: Link[]
  birthPlace: BirthPlace
  college: College
  slug: string
  headshot: Headshot
  jersey?: string
  position: Position
  injuries: Injury[]
  teams: Team[]
  contracts: any[]
  experience: Experience
  status: Status
  debutYear?: number
  hand?: Hand
}

export interface AlternateIds {
  sdr: string
}

export interface Link {
  language: string
  rel: string[]
  href: string
  text: string
  shortText: string
  isExternal: boolean
  isPremium: boolean
}

export interface BirthPlace {
  city: string
  state: string
  country: string
}

export interface College {
  id: string
  mascot: string
  name: string
  shortName: string
  abbrev: string
  logos: Logo[]
}

export interface Logo {
  href: string
  width: number
  height: number
  alt: string
  rel: string[]
  lastUpdated: string
}

export interface Headshot {
  href: string
  alt: string
}

export interface Position {
  id: string
  name: string
  displayName: string
  abbreviation: string
  leaf: boolean
  parent?: Parent
}

export interface Parent {
  id: string
  name: string
  displayName: string
  abbreviation: string
  leaf: boolean
}

export interface Injury {
  status: string
  date: string
}

export interface Team {
  $ref: string
}

export interface Experience {
  years: number
}

export interface Status {
  id: string
  name: string
  type: string
  abbreviation: string
}

export interface Hand {
  type: string
  abbreviation: string
  displayValue: string
}

export interface Coach {
  id: string
  firstName: string
  lastName: string
  experience: number
}

export interface TeamDetails {
  id: string
  abbreviation: string
  location: string
  name: string
  displayName: string
  clubhouse: string
  color: string
  logo: string
  recordSummary: string
  seasonSummary: string
  standingSummary: string
}
