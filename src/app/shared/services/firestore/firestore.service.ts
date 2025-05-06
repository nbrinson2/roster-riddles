// src/app/services/firestore.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FirestoreService {

  constructor(private firestore: Firestore) {  }

}
