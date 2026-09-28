/**
 * Cloud Agent Sandbox Provider for DeepSeek Harness.
 * Supports dual execution modes:
 * - Option B (Default): `in-sandbox-agent` (In-Sandbox Ephemeral Agent)
 * - Option A: `remote-capability-proxy` (Remote Capability Seam Proxy)
 *
 * And selectable sandbox backends: `e2b`, `modal`, `daytona`.
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import type { CloudAgentConfig, CloudAgentMode, CloudSandboxBackend, CloudSandboxHandle, CloudSandboxSpec } from './types.ts'
import { E2BSandboxAdapter } from './providers/e2b.ts'
import { ModalSandboxAdapter } from './providers/modal.ts'
import { DaytonaSandboxAdapter } from './providers/daytona.ts'

export * from './types.ts'
export { E2BSandboxAdapter } from './providers/e2b.ts'
export { ModalSandboxAdapter } from './providers/modal.ts'
export { DaytonaSandboxAdapter } from './providers/daytona.ts'

export class CloudSandboxProvider extends SandboxProvider {
  static Config: z<CloudAgentConfig> = z.object({
    executionMode: z.union([z.const('in-sandbox-agent'), z.const('remote-capability-proxy')]).default('in-sandbox-agent'),
    sandboxProvider: z.union([z.const('e2b'), z.const('modal'), z.const('daytona')]).default('e2b'),
    idleTimeoutMinutes: z.natural().default(20),
    githubApp: z.object({
      appId: z.string().default(''),
      privateKeyEnv: z.string().default('GITHUB_APP_PRIVATE_KEY'),
      webhookSecretEnv: z.string().default('GITHUB_WEBHOOK_SECRET'),
    }).default({}),
    e2bApiKeyEnv: z.string().default('E2B_API_KEY'),
    modalTokenEnv: z.string().default('MODAL_TOKEN_ID'),
    daytonaApiUrlEnv: z.string().default('DAYTONA_SERVER_URL'),
  })

  public readonly executionMode: CloudAgentMode
  public readonly sandboxBackend: CloudSandboxBackend
  private readonly activeSandboxes = new Map<string, CloudSandboxHandle>()

  constructor(ctx: Context, config: CloudAgentConfig) {
    super(ctx)
    this.executionMode = config.executionMode ?? 'in-sandbox-agent'
    this.sandboxBackend = config.sandboxProvider ?? 'e2b'

    ctx.effect(() => () => {
      this.teardownAll()
    })
  }

  /**
   * Provisions a new cloud sandbox for a workspace repository/branch.
   */
  async provisionSandbox(spec: Omit<CloudSandboxSpec, 'mode' | 'backend'> & {
    mode?: CloudAgentMode
    backend?: CloudSandboxBackend
  }): Promise<CloudSandboxHandle> {
    const fullSpec: CloudSandboxSpec = {
      ...spec,
      mode: spec.mode ?? this.executionMode,
      backend: spec.backend ?? this.sandboxBackend,
    }

    let handle: CloudSandboxHandle
    switch (fullSpec.backend) {
      case 'e2b':
        handle = await E2BSandboxAdapter.create(fullSpec)
        break
      case 'modal':
        handle = await ModalSandboxAdapter.create(fullSpec)
        break
      case 'daytona':
        handle = await DaytonaSandboxAdapter.create(fullSpec)
        break
      default:
        throw new Error(`Unsupported cloud sandbox backend: ${fullSpec.backend}`)
    }

    this.activeSandboxes.set(String(spec.sessionId), handle)
    return handle
  }

  /**
   * Confine execution for capability seam.
   * - In Option B (`in-sandbox-agent`), command executes directly inside sandbox VM.
   * - In Option A (`remote-capability-proxy`), command is wrapped with remote runner.
   */
  async confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv> {
    signal?.throwIfAborted()

    const sessionIdStr = policy.sessionId ? String(policy.sessionId) : undefined
    const activeHandle = sessionIdStr ? this.activeSandboxes.get(sessionIdStr) : undefined

    if (this.executionMode === 'in-sandbox-agent' && activeHandle) {
      // Option B: In-sandbox execution
      return {
        argv: ['dsh-cloud-runner', '--session', activeHandle.sandboxId, '--', ...argv],
        enforcement: 'full',
        denialSignatures: ['permission denied', 'operation not permitted'],
        runnerFailureRules: [{ fatalSignatures: ['dsh-cloud-runner:'] }],
      }
    } else {
      // Option A: Remote Capability Proxy
      return {
        argv: ['cloud-sandbox-exec', '--backend', this.sandboxBackend, '--', ...argv],
        enforcement: 'full',
        denialSignatures: ['permission denied', 'read-only file system'],
        runnerFailureRules: [{ fatalSignatures: ['cloud-sandbox-exec:'] }],
      }
    }
  }

  private async teardownAll(): Promise<void> {
    for (const handle of this.activeSandboxes.values()) {
      try {
        await handle.destroy()
      } catch (err) {
        this.ctx.logger.warn(`Failed to destroy sandbox ${handle.sandboxId}:`, err)
      }
    }
    this.activeSandboxes.clear()
  }
}

export default CloudSandboxProvider
