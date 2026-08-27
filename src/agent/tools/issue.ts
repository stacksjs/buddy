/**
 * Reading the issue or pull request a run is about.
 *
 * The text belongs to whoever opened it, which is why this is a tool rather
 * than something spliced into the task. Untrusted content reaches the model
 * only as tool output, wrapped by the runner — a task string carrying an issue
 * body would put a stranger's words in the half of the context the model is
 * told to trust.
 */
import type { GitProvider } from '../../git/provider'
import type { AgentTool, AgentToolOutput } from '../types'

/** Characters of body text handed to the model. */
const MAX_BODY_LENGTH = 20_000

/**
 * Build a tool that reads one specific issue or pull request.
 *
 * Scoped to a single number on purpose. A plan needs the thing it is planning,
 * and a tool that could fetch any issue in the repository would widen what a
 * comment from a stranger can make the agent go and read.
 *
 * @param provider - Provider to read from
 * @param number - Issue or pull request number
 * @param isPullRequest - Whether the number is a pull request
 * @returns A read-tier tool returning the title and body as untrusted data
 * @example
 * ```ts
 * const tools = [...BUILTIN_TOOLS, createReadIssueTool(provider, 42, false)]
 * ```
 */
export function createReadIssueTool(
  provider: GitProvider,
  number: number,
  isPullRequest: boolean,
): AgentTool {
  const noun = isPullRequest ? 'pull request' : 'issue'

  return {
    name: 'read_issue',
    tier: 'read',
    description: `Read the ${noun} this task is about: its title and description.`,
    parameters: { type: 'object', properties: {} },

    async run(_input, context): Promise<AgentToolOutput> {
      try {
        const subject = isPullRequest
          ? (await provider.getPullRequests('all')).find(candidate => candidate.number === number)
          : (await provider.getIssues('all')).find(candidate => candidate.number === number)

        if (!subject)
          return { content: `Could not find ${noun} #${number}.`, isError: true }

        const body = (subject.body ?? '').slice(0, MAX_BODY_LENGTH)
        context.log(`read ${noun} #${number}`)

        return {
          content: `# ${subject.title}\n\n${body || '(no description)'}`,
          // Written by whoever opened it, which on a public repository is
          // anyone at all.
          untrusted: true,
        }
      }
      catch (error) {
        return {
          content: `Could not read ${noun} #${number}: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        }
      }
    },
  }
}
