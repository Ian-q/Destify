import type { RowOf, RowType } from '@/lib/conditions/registry';

export type Leg = {
  from: string; to: string;
  startDate: string; endDate: string;
};

export type Facts = {
  citizenships: string[];
  controlledMeds: string[];
  hasMinors: boolean;
  idp1949Valid: boolean;
  idp1968Valid: boolean;
  travelingWithMinors: boolean;
  drivingAtDestination: boolean;
  carryingControlledMeds: boolean;
  fromCountry: string;
  toCountry: string;
  stayDays: number;
  tables: { [K in RowType]?: Record<string, RowOf<K>> };
};

export type ResolvedChoice = {
  choiceId: string;
  ruleId: string;
  reason: string;
};

export type ResolverOutput = Record<string, ResolvedChoice>;
export type FlowResolver = (facts: Facts) => ResolverOutput;
