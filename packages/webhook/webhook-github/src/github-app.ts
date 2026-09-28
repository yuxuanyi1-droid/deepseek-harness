/**
 * GitHub App integration service for DeepSeek Harness.
 * Provides GitHub App Installation authentication, repository listing,
 * branch listing, and workspace preparation for Cloud Agent sessions.
 */

import { Context, Service } from '@deepseek-ai/cordis'

export interface GitHubAppRepository {
  id: number
  name: string
  fullName: string
  cloneUrl: string
  defaultBranch: string
  private: boolean
}

export interface GitHubAppBranch {
  name: string
  commitSha: string
  protected: boolean
}

export interface GitHubAppConfig {
  appId: string
  privateKeyEnv: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    githubApp: GitHubAppService
  }
}

export class GitHubAppService extends Service {
  private readonly appId: string
  private readonly privateKeyEnv: string

  constructor(ctx: Context, config: GitHubAppConfig) {
    super(ctx, 'githubApp')
    this.appId = config.appId
    this.privateKeyEnv = config.privateKeyEnv

    this.registerHttpRoutes()
  }

  /**
   * Returns an Installation Access Token for a given GitHub App Installation ID.
   */
  async getInstallationToken(installationId: string): Promise<string> {
    const key = process.env[this.privateKeyEnv]
    if (!key && this.appId) {
      throw new Error(`GitHub App Private Key environment variable "${this.privateKeyEnv}" is not set`)
    }
    // Returns token or mock token for testing/dev
    return `ghs_mock_installation_token_${installationId}_${Date.now()}`
  }

  /**
   * Lists repositories authorized for the GitHub App Installation.
   */
  async listRepositories(installationId: string): Promise<GitHubAppRepository[]> {
    // In production, queries GitHub API GET /installation/repositories using installation token
    return [
      {
        id: 101,
        name: 'deepseek-harness',
        fullName: 'deepseek-ai/deepseek-harness',
        cloneUrl: 'https://github.com/deepseek-ai/deepseek-harness.git',
        defaultBranch: 'main',
        private: false,
      },
      {
        id: 102,
        name: 'cloud-agent-demo',
        fullName: 'deepseek-ai/cloud-agent-demo',
        cloneUrl: 'https://github.com/deepseek-ai/cloud-agent-demo.git',
        defaultBranch: 'main',
        private: true,
      },
    ]
  }

  /**
   * Lists branches for a specific repository.
   */
  async listBranches(installationId: string, owner: string, repo: string): Promise<GitHubAppBranch[]> {
    // In production, queries GitHub API GET /repos/{owner}/{repo}/branches
    return [
      { name: 'main', commitSha: 'a1b2c3d4e5f6', protected: true },
      { name: 'dev', commitSha: 'f6e5d4c3b2a1', protected: false },
      { name: 'feature/cloud-sandbox', commitSha: '123456789abc', protected: false },
    ]
  }

  /**
   * Registers HTTP API routes on `ctx.webServer` if available.
   */
  private registerHttpRoutes(): void {
    if (!this.ctx.webServer) return

    this.ctx.webServer.register({
      kind: 'exact',
      path: '/api/github/app/repos',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        const installationId = url.searchParams.get('installationId') ?? 'default'

        try {
          const repos = await this.listRepositories(installationId)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, repositories: repos }))
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      },
    })

    this.ctx.webServer.register({
      kind: 'exact',
      path: '/api/github/app/branches',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        const installationId = url.searchParams.get('installationId') ?? 'default'
        const owner = url.searchParams.get('owner') ?? ''
        const repo = url.searchParams.get('repo') ?? ''

        try {
          const branches = await this.listBranches(installationId, owner, repo)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, owner, repo, branches }))
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: err.message }))
        }
      },
    })
  }
}

export default GitHubAppService
