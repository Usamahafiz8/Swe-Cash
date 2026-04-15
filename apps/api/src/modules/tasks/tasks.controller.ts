import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Tasks')
@ApiBearerAuth('user-jwt')
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List all active tasks with user progress and completion state' })
  @ApiOkResponse({ description: 'Tasks with progress, canClaim flag, and reward amounts' })
  getTasks(@CurrentUser() user: RequestUser) {
    return this.tasksService.getTasksForUser(user.id);
  }

  @Post(':id/claim')
  @ApiOperation({ summary: 'Claim reward for a completed task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiOkResponse({ description: 'Reward credited to available balance' })
  claimTask(@CurrentUser() user: RequestUser, @Param('id') taskId: string) {
    return this.tasksService.claim(user.id, taskId);
  }
}
