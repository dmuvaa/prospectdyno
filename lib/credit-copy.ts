import { CREDIT_COST_COPY, CREDIT_COSTS } from "@prospectdyno/shared";

const EVENT_LABELS: Record<string, string> = {
  company_discovery: CREDIT_COST_COPY.company_discovery,
  website_analysis: CREDIT_COST_COPY.website_analysis,
  qualification: CREDIT_COST_COPY.qualification,
  personalization: CREDIT_COST_COPY.personalization,
  export: CREDIT_COST_COPY.export,
  interpret_icp: CREDIT_COST_COPY.interpret_icp,
  plan_search: CREDIT_COST_COPY.plan_search,
};

export function usageEventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll("_", " ");
}

export function creditRates() {
  return (Object.keys(CREDIT_COSTS) as Array<keyof typeof CREDIT_COSTS>).map((key) => ({
    key,
    label: CREDIT_COST_COPY[key],
    credits: CREDIT_COSTS[key],
  }));
}
