
export interface BOMPart {
  Part_Number: string;
  Name: string;
  Remarks: string;
  Std_Remarks: string;
  F_Code: number; // 0: Default, 1: Optional Multiple, 2: Mandatory Single, 9: Reference Only
  Ref_des: string;
  Select_pref: number; // Sorting preference
  id: string; // Internal unique ID
  Qty?: number; // Quantity from source file
}

export interface RuleLogic {
  includes: string[];  
  excludes: string[];  
  orGroups: string[][]; 
  raw: string;         
}

export interface ConfigRule {
  id: string;
  targetPartId: string; 
  logic: RuleLogic;
  isActive: boolean;
}

export interface LearningEntry {
  category: string;
  selection: string;
  partNumber: string;
  confirmedCount: number;
  lastUsed: string;
}

export type MachineKnowledge = Record<string, LearningEntry[]>; 

export type TechnicalGlossary = Record<string, string>;

export enum ConfidenceLevel {
  AUTO_VERIFIED = 'AUTO_VERIFIED', // > 90%
  REVIEW_NEEDED = 'REVIEW_NEEDED', // 50-90%
  UNCERTAIN = 'UNCERTAIN'           // < 50%
}

export enum AppScreen {
  BOM_TABLE = 'BOM_TABLE',
  CONFIG = 'CONFIG',
  SELECTION = 'SELECTION',
  BOM_GENERATED = 'BOM_GENERATED',
  MO_PROVISION = 'MO_PROVISION',
  NEURAL_ACADEMY = 'NEURAL_ACADEMY'
}
