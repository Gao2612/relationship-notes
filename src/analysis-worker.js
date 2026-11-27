// Web Worker 入口：只打包分析所需的纯模块，由 build.mjs 构建成字符串 ANALYSIS_WORKER_SOURCE。
import { analyzeDailyTimeline, analyzeConversation, timelineDayCount } from './analysis.js';
import { analyzePeriodsCached, analyzeRelationshipCached } from './affinity/index.js';
import { analyzeInteractionMetrics, analyzeInteractionEvidence } from './interaction-metrics.js';
import { buildRelationStage } from './relation-stage.js';
import { runWorkerJob } from './analysis-offload.js';

const E = {
  analyzeDailyTimeline,
  analyzeConversation,
  timelineDayCount,
  analyzePeriodsCached,
  analyzeRelationshipCached,
  analyzeInteractionMetrics,
  analyzeInteractionEvidence,
  buildRelationStage
};
self.onmessage = event => runWorkerJob(E, event.data, message => self.postMessage(message));
