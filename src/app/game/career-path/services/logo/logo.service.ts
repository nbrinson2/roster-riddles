// src/app/game/services/logo.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LogoService {
  private cdnBase = 'https://i.logocdn.com/mlb';

  /**
   * Returns the optimal LogoCDN URL for a given team+year.
   * - Prefers SVG if it’s the “current” era.
   * - Falls back to high-res PNG for historical eras.
   */
  getLogoUrl(teamKey: string, year: number): string {
    // sanitize/lowercase your key to match LogoCDN’s slugs
    const key = encodeURIComponent(teamKey.toLowerCase());

    // decide based on “current” threshold—adjust 2024 to whatever your “current” cutoff is
    if (year >= 2024) {
      return `${this.cdnBase}/${year}/${key}.svg`;
    }

    return `${this.cdnBase}/${year}/${key}@3x.png`;
  }
}
