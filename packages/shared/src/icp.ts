import type { ConfidenceLevel } from "./constants";

export type IcpCompanyCriteria = {
  industries: string[];
  countries: string[];
  regions: string[];
  cities: string[];
  employee_min: number | null;
  employee_max: number | null;
  company_types: string[];
  founding_year_min: number | null;
  founding_year_max: number | null;
};

export type IcpTechnologyCriteria = {
  cms: string[];
  ecommerce: string[];
  analytics: string[];
  marketing: string[];
  infrastructure: string[];
  frameworks: string[];
};

export type IcpBusinessCriteria = {
  services: string[];
  customer_types: string[];
  business_models: string[];
  markets: string[];
  geographic_presence: string[];
};

export type IcpCustomCriterion = {
  name: string;
  description: string;
};

export type IcpInterpretation = {
  name: string;
  summary: string;
  company: IcpCompanyCriteria;
  technology: IcpTechnologyCriteria;
  business: IcpBusinessCriteria;
  signals: string[];
  custom_criteria: IcpCustomCriterion[];
  confidence: ConfidenceLevel;
};

export const emptyCompanyCriteria = (): IcpCompanyCriteria => ({
  industries: [],
  countries: [],
  regions: [],
  cities: [],
  employee_min: null,
  employee_max: null,
  company_types: [],
  founding_year_min: null,
  founding_year_max: null,
});

export const emptyTechnologyCriteria = (): IcpTechnologyCriteria => ({
  cms: [],
  ecommerce: [],
  analytics: [],
  marketing: [],
  infrastructure: [],
  frameworks: [],
});

export const emptyBusinessCriteria = (): IcpBusinessCriteria => ({
  services: [],
  customer_types: [],
  business_models: [],
  markets: [],
  geographic_presence: [],
});

export const emptyInterpretation = (): IcpInterpretation => ({
  name: "",
  summary: "",
  company: emptyCompanyCriteria(),
  technology: emptyTechnologyCriteria(),
  business: emptyBusinessCriteria(),
  signals: [],
  custom_criteria: [],
  confidence: "medium",
});
