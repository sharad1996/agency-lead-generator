import { IsString, IsArray, IsNumber, IsIn, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  opportunityId: string;

  @IsString()
  @IsNotEmpty()
  projectDescription: string;

  @IsArray()
  @IsString({ each: true })
  techStackNeeded: string[];

  @IsNumber()
  @Min(1)
  @Max(36)
  durationMonths: number;

  @IsNumber()
  @Min(1)
  teamSize: number;

  @IsIn(['senior', 'mixed', 'junior'])
  seniorityMix: 'senior' | 'mixed' | 'junior';
}
