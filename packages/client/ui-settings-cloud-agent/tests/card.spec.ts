import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOUD_AGENT_SETTINGS } from '../src/CloudAgentSettingsCard.tsx'

describe('CloudAgentSettingsCard', () => {
  it('defines default settings with Option B (in-sandbox-agent) and E2B sandbox', () => {
    expect(DEFAULT_CLOUD_AGENT_SETTINGS.executionMode).toBe('in-sandbox-agent')
    expect(DEFAULT_CLOUD_AGENT_SETTINGS.sandboxProvider).toBe('e2b')
    expect(DEFAULT_CLOUD_AGENT_SETTINGS.idleTimeoutMinutes).toBe(20)
    expect(DEFAULT_CLOUD_AGENT_SETTINGS.githubPrivateKeyEnv).toBe('GITHUB_APP_PRIVATE_KEY')
  })
})
