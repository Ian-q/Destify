import type { ProfileExtras, TripContextExtras } from './profile-extras';

export type PermanentProfile = {
  userId: string;
  citizenships: string[];
  homeCountry: string | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;          // ISO yyyy-mm-dd
  controlledMeds: string[];
  hasMinors: boolean;
  extras: ProfileExtras;
};

export type TripContext = {
  tripId: string;
  travelingWithMinors: boolean;
  drivingAtDestination: boolean;
  carryingControlledMeds: boolean;
  purpose: 'tourism' | 'business' | 'family' | 'study' | null;
  extras: TripContextExtras;
};
