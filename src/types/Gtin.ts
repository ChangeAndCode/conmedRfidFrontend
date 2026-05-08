export interface Gtin {
  _id: string;
  value: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GtinListResponse {
  count: number;
  data: Gtin[];
}

export interface GtinMutationPayload {
  value: string;
  isActive?: boolean;
}

export interface GtinMutationResponse {
  message: string;
  data: Gtin;
}
