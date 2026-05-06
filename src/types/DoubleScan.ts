export interface DoubleScanResolvedPartConfigOption {
  id: string;
  partNumber: string;
  description?: string;
  rfidProgram?: string;
  filterLabel?: string;
  expectedGtin?: string;
  expectedLotLength?: number;
  lotTrimRight?: number;
}

export interface ResolveFirstDoubleScanResponse {
  message: string;
  data: {
    firstBarcodeRaw: string;
    gtin: string;
    options: DoubleScanResolvedPartConfigOption[];
    autoSelectedPartConfigId?: string;
  };
}

export interface CreateDoubleScanPayload {
  partConfigId: string;
  firstBarcodeRaw: string;
  secondBarcodeRaw: string;
  serviceOrder?: string;
  createdBy?: string;
  notes?: string;
}

export interface DoubleScanReadResponse {
  _id: string;
  partNumber: string;
  rfidProgram: string;
  gtin: string;
  lot: string;
  manufactureDate: string;
  filterLabel?: string;
  rulesApplied?: string[];
}

export interface CreateDoubleScanResponse {
  message: string;
  data?: DoubleScanReadResponse;
}
