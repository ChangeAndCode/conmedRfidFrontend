export interface PrintInterruption {
  _id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrintInterruptionMutationPayload {
  title: string;
}

export interface PrintInterruptionMutationResponse {
  message: string;
  data: PrintInterruption;
}
