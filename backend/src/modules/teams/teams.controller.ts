import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { Team } from './entities/team.entity';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create team' })
  create(@Body() teamData: Partial<Team>) {
    return this.teamsService.create(teamData);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by ID' })
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team' })
  update(@Param('id') id: string, @Body() teamData: Partial<Team>) {
    return this.teamsService.update(id, teamData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete team' })
  remove(@Param('id') id: string) {
    return this.teamsService.remove(id);
  }
}
