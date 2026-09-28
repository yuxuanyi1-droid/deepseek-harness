import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { GitHubAppService } from '../src/github-app.ts'

describe('GitHubAppService', () => {
  it('registers on cordis context as githubApp', () => {
    const ctx = new Context()
    const appService = new GitHubAppService(ctx, { appId: '123456', privateKeyEnv: 'GITHUB_APP_PRIVATE_KEY' })

    expect(ctx.get('githubApp')).toBeDefined()
  })

  it('generates installation tokens', async () => {
    process.env.GITHUB_APP_PRIVATE_KEY = 'mock-private-key-pem-content'
    const ctx = new Context()
    const appService = new GitHubAppService(ctx, { appId: '123456', privateKeyEnv: 'GITHUB_APP_PRIVATE_KEY' })

    const token = await appService.getInstallationToken('inst-99')
    expect(token).toContain('ghs_mock_installation_token_inst-99')
  })

  it('lists authorized repositories and branches for a workspace', async () => {
    const ctx = new Context()
    const appService = new GitHubAppService(ctx, { appId: '123456', privateKeyEnv: 'GITHUB_APP_PRIVATE_KEY' })

    const repos = await appService.listRepositories('inst-99')
    expect(repos).toHaveLength(2)
    expect(repos[0]?.fullName).toBe('deepseek-ai/deepseek-harness')

    const branches = await appService.listBranches('inst-99', 'deepseek-ai', 'deepseek-harness')
    expect(branches).toHaveLength(3)
    expect(branches[0]?.name).toBe('main')
    expect(branches[1]?.name).toBe('dev')
  })
})
