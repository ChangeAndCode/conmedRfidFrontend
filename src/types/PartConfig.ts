export type ReadingMode = 'manual' | 'single_scan' | 'double_scan';

export interface PartConfig {
  _id: string;
  partNumber: string;
  description?: string;
  readingMode: ReadingMode;
  rfidProgram?: string;
  expectedGtin?: string;
  filterLabel?: string;
  expectedLotLength?: number;
  lotTrimRight?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface PartConfigListResponse {
  count: number;
  data: PartConfig[];
}

export interface PartConfigMutationPayload {
  partNumber: string;
  description?: string;
  readingMode: ReadingMode;
  rfidProgram?: string;
  expectedGtin?: string;
  filterLabel?: string;
  expectedLotLength?: number;
  lotTrimRight?: number;
  isActive?: boolean;
  notes?: string;
}

export interface PartConfigMutationResponse {
  message: string;
  data: PartConfig;
}
