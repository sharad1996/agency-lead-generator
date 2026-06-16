import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('upsert')
  @Public()
  async upsert(
    @Headers('x-internal-secret') secret: string,
    @Body() dto: UpsertUserDto,
  ) {
    if (secret !== this.config.get<string>('INTERNAL_API_SECRET')) {
      throw new UnauthorizedException('Invalid internal secret');
    }
    const user = await this.usersService.upsertOnSignIn(dto);
    return { id: user.id, role: user.role };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  listUsers(@Query('tenantId') tenantId: string) {
    return this.usersService.listUsers(tenantId);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }
}
