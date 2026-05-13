import type { RowOf, RowType } from '@/lib/conditions/registry';
import type { Citizenship, Residence } from '@/lib/user-profile';

export type Leg = {
  from: string; to: string;
  startDate: string; endDate: string;
};

export type Facts = {
  citizenships: Citizenship[];
  residence: Residence | null;
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
  leg: Leg;
  tables: { [K in RowType]?: Record<string, RowOf<K>> };
};

export type ResolvedChoice = {
  choiceId: string;
  ruleId: string;
  reason: string;
};

export type ResolvedInfo = {
  title: string;
  desc: string;
  meta?: string;
  state: 'pass' | 'warn' | 'fail';
  ruleId: string;
  reason: string;
};

export type ResolverOutput = {
  choices: Record<string, ResolvedChoice>;
  info:    Record<string, ResolvedInfo>;
};

export type FlowResolver = (facts: Facts) => ResolverOutput;
