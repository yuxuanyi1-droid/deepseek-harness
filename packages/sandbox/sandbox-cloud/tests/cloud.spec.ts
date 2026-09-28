import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import CloudSandboxProvider from '../src/index.ts'

describe('CloudSandboxProvider', () => {
  it('initializes with default executionMode as in-sandbox-agent and e2b backend', () => {
    const ctx = new Context()
    const provider = new CloudSandboxProvider(ctx, {})

    expect(provider.executionMode).toBe('in-sandbox-agent')
    expect(provider.sandboxBackend).toBe('e2b')
  })

  it('provisions an E2B sandbox for a workspace repo and branch', async () => {
    const ctx = new Context()
    const provider = new CloudSandboxProvider(ctx, { executionMode: 'in-sandbox-agent', sandboxProvider: 'e2b' })

    const handle = await provider.provisionSandbox({
      sessionId: 'test-session-1' as SessionId,
      repoUrl: 'https://github.com/deepseek-ai/deepseek-harness',
      branch: 'main',
    })

    expect(handle.backend).toBe('e2b')
    expect(handle.mode).toBe('in-sandbox-agent')
    expect(handle.workspacePath).toContain('deepseek-harness')

    const res = await handle.execCommand(['echo', 'hello'])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain('E2B MicroVM')
  })

  it('provisions Modal and Daytona sandboxes when requested', async () => {
    const ctx = new Context()
    const provider = new CloudSandboxProvider(ctx, {})

    const modalHandle = await provider.provisionSandbox({
      sessionId: 'test-session-2' as SessionId,
      repoUrl: 'https://github.com/deepseek-ai/deepseek-harness',
      branch: 'dev',
      backend: 'modal',
    })
    expect(modalHandle.backend).toBe('modal')

    const daytonaHandle = await provider.provisionSandbox({
      sessionId: 'test-session-3' as SessionId,
      repoUrl: 'https://github.com/deepseek-ai/deepseek-harness',
      branch: 'feat/test',
      backend: 'daytona',
    })
    expect(daytonaHandle.backend).toBe('daytona')
  })

  it('confines commands for Option B (in-sandbox-agent) and Option A (remote-capability-proxy)', async () => {
    const ctxB = new Context()
    const providerB = new CloudSandboxProvider(ctxB, { executionMode: 'in-sandbox-agent' })

    const handle = await providerB.provisionSandbox({
      sessionId: 'test-session-4' as SessionId,
      repoUrl: 'https://github.com/deepseek-ai/deepseek-harness',
      branch: 'main',
    })

    const confinedB = await providerB.confine(['ls', '-la'], {
      mode: 'workspace-write',
      workspaceRoot: handle.workspacePath,
      sessionId: 'test-session-4' as SessionId,
    })
    expect(confinedB.argv[0]).toBe('dsh-cloud-runner')

    const ctxA = new Context()
    const providerA = new CloudSandboxProvider(ctxA, { executionMode: 'remote-capability-proxy' })

    const confinedA = await providerA.confine(['ls', '-la'], {
      mode: 'workspace-write',
      workspaceRoot: '/workspace',
      sessionId: 'test-session-5' as SessionId,
    })
    expect(confinedA.argv[0]).toBe('cloud-sandbox-exec')
  })
})
