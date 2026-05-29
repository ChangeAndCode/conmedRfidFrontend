export type ResponsibleArea = 'manufactura' | 'calidad';

export type Responsible = {
  _id: string;
  name: string;
  area: ResponsibleArea;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ResponsibleMutationPayload = {
  name: string;
  area: ResponsibleArea;
};

export type ResponsibleMutationResponse = {
  message: string;
  data: Responsible;
};

export type ResponsiblesListResponse = {
  data: Responsible[];
};