/**
 * Types and interfaces for the Cloud Agent Sandbox provider.
 */

import type { SessionId } from '@deepseek-ai/dsh-session'

/**
 * Execution Mode:
 * - `in-sandbox-agent`: (Option B / Default) Launches a lightweight Harness agent process inside the spawned sandbox container/MicroVM.
 * - `remote-capability-proxy`: (Option A) Control Plane hosts the Agent loop and proxies filesystem/subprocess/sandbox capabilities to the remote sandbox.
 */
export type CloudAgentMode = 'in-sandbox-agent' | 'remote-capability-proxy'

/**
 * Supported Cloud Sandbox Backends:
 * - `e2b`: E2B Sub-second Firecracker MicroVMs.
 * - `modal`: Modal Serverless Containers.
 * - `daytona`: Daytona Open-source Dev Environment Workspaces.
 */
export type CloudSandboxBackend = 'e2b' | 'modal' | 'daytona'

/** Config schema for Cloud Sandbox Provider */
export interface CloudAgentConfig {
  /** Execution mode. Default: 'in-sandbox-agent' */
  executionMode?: CloudAgentMode
  /** Cloud sandbox backend selection. Default: 'e2b' */
  sandboxProvider?: CloudSandboxBackend
  /** Idle timeout in minutes before automatically tearing down the sandbox. Default: 20 */
  idleTimeoutMinutes?: number
  /** GitHub App settings for workspace integration */
  githubApp?: {
    appId: string
    privateKeyEnv?: string
    webhookSecretEnv?: string
  }
  /** Provider API Keys / Endpoint configurations */
  e2bApiKeyEnv?: string
  modalTokenEnv?: string
  daytonaApiUrlEnv?: string
}

/** Specification for provisioning a cloud sandbox */
export interface CloudSandboxSpec {
  sessionId: SessionId
  repoUrl: string
  branch: string
  githubToken?: string
  mode: CloudAgentMode
  backend: CloudSandboxBackend
}

/** Command execution result within a cloud sandbox */
export interface CloudExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

/** Handle representing a live provisioned cloud sandbox */
export interface CloudSandboxHandle {
  sessionId: SessionId
  sandboxId: string
  backend: CloudSandboxBackend
  workspacePath: string
  mode: CloudAgentMode
  execCommand(cmd: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<CloudExecResult>
  destroy(): Promise<void>
}
