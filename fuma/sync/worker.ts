import {sync} from "@/api/routes/sync.ts";

export { SourceSyncWorkflow } from './workflow';
export { IndexWorkflow } from './index-workflow';
export default {
  fetch: sync.fetch
};
