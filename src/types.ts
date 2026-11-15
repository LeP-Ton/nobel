export type FieldId = "ai" | "chips" | "energy" | "manufacturing" | "bio";
export type Fields = Record<FieldId, number>;
export interface ResearchCulture {
  autonomy: number;
  horizon: number;
  execution: number;
}
export interface CountrySeed {
  id: string;
  name: string;
  english: string;
  flag: string;
  playable: boolean;
  population: number;
  gdp: number;
  rd: number;
  researchers: number;
  year: string;
  strengths: string;
  challenge: string;
  fields: Fields;
  industry: number;
  attraction: number;
  researchCulture: ResearchCulture;
  color: string;
  coordinates: [number, number];
  sourceIds: string[];
}
export interface Country extends CountrySeed {
  treasury: number;
  budget: number;
  allocations: Fields;
  progress: Fields;
  patents: number;
  influence: number;
  aiProjects: number;
  industryRevenue: number;
}
export interface Source {
  id: string;
  title: string;
  url: string;
  note: string;
}
export interface Scientist {
  id: string;
  name: string;
  country: string;
  field: FieldId;
  institution: string;
  ability: number;
  innovation: number;
  reputation: number;
  management: number;
  description: string;
  simulated: boolean;
}
export interface Institution {
  id: string;
  name: string;
  country: string;
  type: string;
  field: FieldId;
  level: number;
  reputation: number;
  researchers: number;
  description: string;
}
export interface TechTemplate {
  id: string;
  name: string;
  field: FieldId;
  type: "成熟技术" | "前沿科研" | "未知技术";
  description: string;
  requirements: Partial<Fields>;
  funding: number;
  talent: number;
  difficulty: number;
  risk: number;
  duration: number;
  engineering: number;
  potential: number;
}
export type ProjectStatus =
  | "research"
  | "bottleneck"
  | "breakthrough"
  | "engineering"
  | "production"
  | "failed"
  | "terminated";
export interface Project {
  id: string;
  templateId: string;
  name: string;
  field: FieldId;
  status: ProjectStatus;
  progress: number;
  funding: number;
  scientists: string[];
  started: string;
  spent: number;
  risk: number;
  quality: number;
  engineeringProgress: number;
  revenue: number;
  log: string[];
}
export interface GameEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "research" | "industry" | "world" | "talent" | "report" | "award";
  country: string;
  field?: FieldId;
  historical?: boolean;
  sourceId?: string;
}
export interface AnnualReport {
  year: number;
  country: string;
  rank: number;
  score: number;
  breakthroughs: number;
  patents: number;
  revenue: number;
  spent: number;
  fields: Fields;
  summary: string;
}
export interface World {
  version: 1;
  seed: number;
  date: string;
  player: string;
  countries: Country[];
  projects: Project[];
  scientists: Scientist[];
  institutions: Institution[];
  events: GameEvent[];
  reports: AnnualReport[];
  policy: { basic: number; cooperation: boolean; talent: boolean };
  history: { date: string; scores: Record<string, number> }[];
}
export interface ActionResult {
  world: World;
  error?: string;
}
