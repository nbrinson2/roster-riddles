// src/app/services/firestore.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  collectionData,
  CollectionReference
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Cafe {
  id?: string;
  name: string;
  city: string;
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {

  constructor(private firestore: Firestore) {
  }

  /** Stream all cafes, now passing a Query into collectionData */
  getAll(): Observable<Cafe[]> {
    const q = query(collection(this.firestore, 'cafes'));
    return collectionData(q, { idField: 'id' }) as Observable<Cafe[]>;
  }
}
