import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { handleGitHubSweEvent, isAgentTriggerMention } from '../src/swe-handler.ts'

describe('swe-handler', () => {
  it('detects bot mention trigger patterns', () => {
    expect(isAgentTriggerMention('Please help fix this bug @dsh')).toBe(true)
    expect(isAgentTriggerMention('@deepseek-agent solve this issue')).toBe(true)
    expect(isAgentTriggerMention('/fix memory leak in parser')).toBe(true)
    expect(isAgentTriggerMention('Just a normal comment')).toBe(false)
  })

  it('triggers automated SWE workflow on issue comment mention', async () => {
    const ctx = new Context()

    const event = {
      name: 'issue_comment',
      payload: {
        action: 'created',
        comment: {
          body: '@dsh please refactor the error handling module',
        },
        issue: {
          number: 42,
          pull_request: null,
        },
        repository: {
          owner: { login: 'deepseek-ai' },
          name: 'deepseek-harness',
          clone_url: 'https://github.com/deepseek-ai/deepseek-harness.git',
          default_branch: 'main',
        },
        sender: { login: 'octocat' },
      },
    }

    const res = await handleGitHubSweEvent(ctx, event)
    expect(res.triggered).toBe(true)
    expect(res.sessionId).toContain('swe-deepseek-harness-42-')
  })

  it('ignores non-matching issue comments', async () => {
    const ctx = new Context()

    const event = {
      name: 'issue_comment',
      payload: {
        action: 'created',
        comment: {
          body: 'Looks good to me!',
        },
        issue: {
          number: 42,
        },
        repository: {
          owner: { login: 'deepseek-ai' },
          name: 'deepseek-harness',
          clone_url: 'https://github.com/deepseek-ai/deepseek-harness.git',
        },
        sender: { login: 'octocat' },
      },
    }

    const res = await handleGitHubSweEvent(ctx, event)
    expect(res.triggered).toBe(false)
  })
})
