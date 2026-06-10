export interface UpsertCompanyDto {
  tenantId: string;
  apolloId?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack?: string[];
  location?: string;
}
