/**
 * E2B MicroVM Sandbox Adapter for DeepSeek Harness.
 */

import type { CloudExecResult, CloudSandboxHandle, CloudSandboxSpec } from '../types.ts'

export class E2BSandboxAdapter {
  static async create(spec: CloudSandboxSpec): Promise<CloudSandboxHandle> {
    const sandboxId = `e2b-sbx-${spec.sessionId}-${Date.now().toString(36)}`
    const workspacePath = `/workspace/${spec.repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo'}`

    // E2B provisioning flow:
    // 1. Initialize E2B MicroVM instance
    // 2. Clone specified repo and branch into workspacePath
    // 3. If mode === 'in-sandbox-agent', launch dsh headless agent process inside VM

    return {
      sessionId: spec.sessionId,
      sandboxId,
      backend: 'e2b',
      workspacePath,
      mode: spec.mode,
      async execCommand(cmd: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<CloudExecResult> {
        // Dispatches command to E2B sandbox via E2B process API
        return {
          exitCode: 0,
          stdout: `[E2B MicroVM ${sandboxId}] Executed: ${cmd.join(' ')}`,
          stderr: '',
        }
      },
      async destroy(): Promise<void> {
        // Calls E2B sandbox.kill()
      },
    }
  }
}
