import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsString()
  @IsNotEmpty()
  googleId: string;
}
