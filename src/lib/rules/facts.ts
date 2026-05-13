import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Facts, Leg } from './types';
import type { RowOf, RowType } from '@/lib/conditions/registry';

type Hydrated = { tables?: { [K in RowType]?: Record<string, RowOf<K>> } };

export function buildFacts(
  profile: PermanentProfile,
  context: TripContext,
  leg: Leg,
  hydrated: Hydrated = {},
): Facts {
  const stayDays = daysBetween(leg.startDate, leg.endDate);
  const endMs = Date.parse(leg.endDate);
  const idpExpiryMs = profile.idpExpiry ? Date.parse(profile.idpExpiry) : -Infinity;
  const idpValid = idpExpiryMs >= endMs;

  return {
    citizenships: profile.citizenships,
    residence: profile.residence,
    controlledMeds: profile.controlledMeds,
    hasMinors: profile.hasMinors,
    idp1949Valid: idpValid && profile.idpConvention === '1949',
    idp1968Valid: idpValid && profile.idpConvention === '1968',
    travelingWithMinors: context.travelingWithMinors,
    drivingAtDestination: context.drivingAtDestination,
    carryingControlledMeds: context.carryingControlledMeds,
    fromCountry: leg.from,
    toCountry: leg.to,
    stayDays,
    leg,
    tables: hydrated.tables ?? {},
  };
}

function daysBetween(start: string, end: string): number {
  const s = Date.parse(start), e = Date.parse(end);
  return Math.max(0, Math.round((e - s) / 86_400_000));
}
