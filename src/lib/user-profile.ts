import type { ProfileExtras, TripContextExtras } from './profile-extras';

export type Citizenship = {
  country: string;            // ISO alpha-2
  passportExpiry: string | null;  // ISO yyyy-mm-dd or null
};

export type Residence = {
  country: string;            // ISO alpha-2
  visaStatus: 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null;
};

export type PermanentProfile = {
  userId: string;
  citizenships: Citizenship[];
  residence: Residence | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;
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
