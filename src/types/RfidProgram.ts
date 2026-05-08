export interface RfidProgram {
  _id: string;
  value: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RfidProgramListResponse {
  count: number;
  data: RfidProgram[];
}

export interface RfidProgramMutationPayload {
  value: string;
  isActive?: boolean;
}

export interface RfidProgramMutationResponse {
  message: string;
  data: RfidProgram;
}
