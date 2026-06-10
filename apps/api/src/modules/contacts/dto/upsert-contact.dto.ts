export interface UpsertContactDto {
  tenantId: string;
  companyId: string;
  apolloId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
}
