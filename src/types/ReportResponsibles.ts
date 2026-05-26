export interface ReportResponsibles {
  isConfigured: boolean;
  manufacturingRepresentativeName: string;
  qualityRepresentativeName: string;
}

export interface ReportResponsiblesMutationPayload {
  manufacturingRepresentativeName: string;
  qualityRepresentativeName: string;
}

export interface ReportResponsiblesMutationResponse {
  message: string;
  data: ReportResponsibles;
}
