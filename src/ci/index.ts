export { failsOnBaseBranch, latestFailurePerWorkflow } from './base'
export type { RunHistoryReader } from './base'
export {
  classifyFailure,
  describeFailure,
  extractErrorLines,
} from './classify'
export type { ClassifiedFailure, FailureKind } from './classify'
export { attemptFix } from './fix'
export { runFixCi } from './run'
export type { RunFixCiOptions } from './run'
export type { FixOptions, FixOutcome, LockfileRepair } from './fix'
