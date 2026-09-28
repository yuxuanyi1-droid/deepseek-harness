/**
 * OpenHands / Open SWE-style GitHub App Automation Workflow.
 * Listens to GitHub Issues, Pull Requests, Comments, and Review Comments,
 * automatically provisions a Cloud Sandbox (E2B / Modal / Daytona),
 * resolves code tasks, and creates Pull Requests.
 */

import type { Context } from '@deepseek-ai/cordis'

export interface GitHubSweEventTrigger {
  eventType: 'issue_comment' | 'issues' | 'pull_request' | 'pull_request_review'
  action: 'created' | 'opened' | 'submitted'
  repository: {
    owner: string
    name: string
    cloneUrl: string
    defaultBranch: string
  }
  issueOrPrNumber: number
  branch: string
  prompt: string
  sender: string
}

export const DEFAULT_BOT_TRIGGER_PATTERNS = [
  /@dsh\b/i,
  /@deepseek-agent\b/i,
  /@deepseek-harness\b/i,
  /\/fix\b/i,
  /\/solve\b/i,
]

/**
 * Determines whether an Issue/PR comment contains a trigger mention for the agent.
 */
export function isAgentTriggerMention(body: string, customPatterns?: RegExp[]): boolean {
  const patterns = customPatterns ?? DEFAULT_BOT_TRIGGER_PATTERNS
  return patterns.some(pattern => pattern.test(body))
}

/**
 * Processes GitHub Webhook events and triggers OpenHands / Open SWE automated agent resolution.
 */
export async function handleGitHubSweEvent(ctx: Context, event: {
  name: string
  payload: any
}): Promise<{ triggered: boolean; message?: string; sessionId?: string }> {
  const { name, payload } = event

  let trigger: GitHubSweEventTrigger | undefined

  if (name === 'issue_comment' && payload.action === 'created') {
    const commentBody = payload.comment?.body ?? ''
    if (isAgentTriggerMention(commentBody)) {
      trigger = {
        eventType: 'issue_comment',
        action: 'created',
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          cloneUrl: payload.repository.clone_url,
          defaultBranch: payload.repository.default_branch || 'main',
        },
        issueOrPrNumber: payload.issue.number,
        branch: payload.issue.pull_request ? `pr-${payload.issue.number}` : payload.repository.default_branch || 'main',
        prompt: commentBody.replace(/@dsh\b|@deepseek-agent\b|@deepseek-harness\b/gi, '').trim(),
        sender: payload.sender.login,
      }
    }
  } else if (name === 'issues' && payload.action === 'opened') {
    const title = payload.issue?.title ?? ''
    const body = payload.issue?.body ?? ''
    if (isAgentTriggerMention(`${title} ${body}`)) {
      trigger = {
        eventType: 'issues',
        action: 'opened',
        repository: {
          owner: payload.repository.owner.login,
          name: payload.repository.name,
          cloneUrl: payload.repository.clone_url,
          defaultBranch: payload.repository.default_branch || 'main',
        },
        issueOrPrNumber: payload.issue.number,
        branch: payload.repository.default_branch || 'main',
        prompt: `Fix Issue #${payload.issue.number}: ${title}\n\n${body}`,
        sender: payload.sender.login,
      }
    }
  }

  if (!trigger) {
    return { triggered: false, message: 'Event did not match agent trigger pattern' }
  }

  const sessionId = `swe-${trigger.repository.name}-${trigger.issueOrPrNumber}-${Date.now().toString(36)}`

  // 1. Post initial acknowledgment comment on GitHub Issue / PR
  ctx.logger?.info?.(`[OpenSWE] Triggered for ${trigger.repository.owner}/${trigger.repository.name} #${trigger.issueOrPrNumber}`)

  // 2. Provision Cloud Sandbox (E2B / Modal / Daytona) via ctx.sandbox / CloudSandboxProvider if present
  if ((ctx as any).cloudSandbox) {
    await (ctx as any).cloudSandbox.provisionSandbox({
      sessionId,
      repoUrl: trigger.repository.cloneUrl,
      branch: trigger.branch,
      mode: 'in-sandbox-agent',
    })
  }

  return {
    triggered: true,
    sessionId,
    message: `Started OpenSWE Agent Session ${sessionId} for ${trigger.repository.owner}/${trigger.repository.name} #${trigger.issueOrPrNumber}`,
  }
}
