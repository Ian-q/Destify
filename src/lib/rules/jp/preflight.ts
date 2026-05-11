import type { FlowResolver, ResolverOutput } from '../types';

export const resolvePreflightJP: FlowResolver = (f): ResolverOutput => {
  const out: ResolverOutput = {};

  // n-visa — table-driven across citizenships
  for (const c of f.citizenships) {
    const visa = f.tables.visa_exemption?.[`${c}:${f.toCountry}`];
    if (visa && visa.exemptDays !== null && f.stayDays <= visa.exemptDays) {
      out['n-visa'] = {
        choiceId: 'no',
        ruleId:   `jp.preflight.visa.${c.toLowerCase()}-exempt`,
        reason:   `${c} passport, ${f.stayDays}-night stay → visa-exempt up to ${visa.exemptDays} days`,
      };
      break;
    }
  }

  // n-meds — same as rule layer spec
  if (f.carryingControlledMeds && f.controlledMeds.length > 0) {
    out['n-meds'] = {
      choiceId: 'yes-controlled',
      ruleId:   'jp.preflight.meds.controlled',
      reason:   `${f.controlledMeds.join(', ')} requires a Yakkan Shoumei import certificate`,
    };
  } else if (f.carryingControlledMeds === false) {
    out['n-meds'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.meds.none',
      reason:   'No prescription meds declared for this trip',
    };
  }

  // n-kids
  if (f.travelingWithMinors === false) {
    out['n-kids'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.kids.none',
      reason:   'No minors on this trip',
    };
  }

  // n-drive — IDP logic stays in TS
  if (f.drivingAtDestination === false) {
    out['n-drive'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.drive.no',
      reason:   'Not driving in Japan — trains only',
    };
  } else if (f.drivingAtDestination && f.idp1949Valid) {
    out['n-drive'] = {
      choiceId: 'yes',
      ruleId:   'jp.preflight.drive.idp1949',
      reason:   'Driving in Japan; you have a valid 1949-convention IDP',
    };
  }

  return out;
};
