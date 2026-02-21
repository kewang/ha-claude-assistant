import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { HAClient } from '../core/ha-client.js';

import { listEntitiesTool, executeListEntities, type ListEntitiesInput } from './list-entities.js';
import { getStateTool, executeGetState, type GetStateInput } from './get-states.js';
import { callServiceTool, executeCallService, type CallServiceInput } from './call-service.js';
import { manageScheduleTool, executeManageSchedule, type ManageScheduleInput } from './manage-schedule.js';
import { getHistoryTool, executeGetHistory, type GetHistoryInput } from './get-history.js';
import { manageEventSubscriptionTool, executeManageEventSubscription, type ManageEventSubscriptionInput } from './manage-event-subscription.js';
import { manageMemoryTool, executeManageMemory, type ManageMemoryInput } from './manage-memory.js';

export const haTools: Tool[] = [
  listEntitiesTool,
  getStateTool,
  callServiceTool,
  manageScheduleTool,
  getHistoryTool,
  manageEventSubscriptionTool,
  manageMemoryTool,
];

export type ToolInput = ListEntitiesInput | GetStateInput | CallServiceInput | ManageScheduleInput | GetHistoryInput | ManageEventSubscriptionInput | ManageMemoryInput;

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
    case 'get_history':
      return executeGetHistory(client, input as GetHistoryInput);
    case 'manage_event_subscription':
      return executeManageEventSubscription(input as ManageEventSubscriptionInput);
    case 'manage_memory':
      return executeManageMemory(input as ManageMemoryInput);
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
  getHistoryTool,
  executeGetHistory,
  manageEventSubscriptionTool,
  executeManageEventSubscription,
  manageMemoryTool,
  executeManageMemory,
};

export type {
  ListEntitiesInput,
  GetStateInput,
  CallServiceInput,
  ManageScheduleInput,
  GetHistoryInput,
  ManageEventSubscriptionInput,
  ManageMemoryInput,
};
