import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

import { listEntitiesTool, executeListEntities, type ListEntitiesInput } from './list-entities.js';
import { getStateTool, executeGetState, type GetStateInput } from './get-states.js';
import { callServiceTool, executeCallService, type CallServiceInput } from './call-service.js';
import { manageScheduleTool, executeManageSchedule, type ManageScheduleInput } from './manage-schedule.js';

export const haTools: Tool[] = [
  listEntitiesTool,
  getStateTool,
  callServiceTool,
  manageScheduleTool,
];

export type ToolInput = ListEntitiesInput | GetStateInput | CallServiceInput | ManageScheduleInput;

export async function executeTool(
  client: HAClient,
  toolName: string,
  input: unknown
): Promise<string> {
  switch (toolName) {
    case 'list_entities':
      return executeListEntities(client, input as ListEntitiesInput);
    case 'get_state':
      return executeGetState(client, input as GetStateInput);
    case 'call_service':
      return executeCallService(client, input as CallServiceInput);
    case 'manage_schedule':
      return executeManageSchedule(input as ManageScheduleInput);
    default:
      return JSON.stringify({
        success: false,
        error: `Unknown tool: ${toolName}`,
      });
  }
}

export {
  listEntitiesTool,
  executeListEntities,
  getStateTool,
  executeGetState,
  callServiceTool,
  executeCallService,
  manageScheduleTool,
  executeManageSchedule,
};

export type {
  ListEntitiesInput,
  GetStateInput,
  CallServiceInput,
  ManageScheduleInput,
};
