# Cloud Agent & Multi-Backend Sandbox Integration Proposal

English | [中文](#chinese-translation)

This document specifies the technical architecture and implementation design for transforming **DeepSeek Harness** (`dsh`) into a Cloud Agent platform with GitHub App integration and selectable sandbox execution environments.

---

## 1. Executive Summary

DeepSeek Harness (`dsh`) is designed on a plugin-first paradigm powered by [Cordis](https://github.com/cordiverse/cordis). System capabilities—such as filesystem access (`ctx.fs`), subprocess execution (`ctx.subprocess`), process confinement (`ctx.sandbox`), and webhooks (`ctx.webhookRuntime`)—are abstract capability seams.

To enable Cloud Agent capabilities:
1. **GitHub App Integration**: Authenticate with GitHub App credentials, list authorized repositories/branches, and bind GitHub repositories directly as session workspaces.
2. **Dual Execution Modes**: Support both **Option B: In-Sandbox Ephemeral Agent** (default) and **Option A: Remote Capability Seam Proxy**, with a dropdown setting for user/administrator selection.
3. **Selectable Cloud Sandbox Providers**: Seamlessly provision and orchestrate **E2B**, **Modal**, or **Daytona** sandboxes per chat session.

---

## 2. Configuration & UI Dropdown Design

### 2.1 Settings Schema (`dsh-cloud-agent` plugin)

The Cloud Agent configuration defines the execution mode, default provider, and GitHub App credentials:

```typescript
export interface CloudAgentSettings {
  /** Execution mode selection. Default: 'in-sandbox-agent' (Option B) */
  executionMode: 'in-sandbox-agent' | 'remote-capability-proxy'

  /** Selected cloud sandbox backend. Default: 'e2b' */
  sandboxProvider: 'e2b' | 'modal' | 'daytona'

  /** Sandbox inactivity timeout in minutes before auto-teardown. Default: 20 */
  idleTimeoutMinutes: number

  /** GitHub App settings */
  githubApp: {
    appId: string
    privateKeyEnv: string
    webhookSecretEnv: string
  }
}
```

### 2.2 Settings Card UI Dropdown

In the Web UI / Desktop Settings, a dedicated Cloud Agent settings card renders dropdown options:

- **Execution Architecture (`executionMode`)**:
  - `In-Sandbox Ephemeral Agent (Recommended / Default)`: Launches a lightweight `dsh` headless instance inside the spawned sandbox container/VM. Minimal latency for file operations and tool executions.
  - `Remote Capability Seam Proxy`: Control Plane hosts the Agent loop; proxies `ctx.fs`, `ctx.subprocess`, and `ctx.sandbox` over RPC/SSH to the remote sandbox.
- **Sandbox Provider (`sandboxProvider`)**:
  - `E2B Sandbox (Firecracker MicroVM)`
  - `Modal Sandbox (Serverless Container)`
  - `Daytona Sandbox (Dev Environment Server)`

---

## 3. Dual Execution Mode Implementation

### 3.1 Option B: In-Sandbox Ephemeral Agent Instance (Default)

```
+-------------------------------------------------------------------------------+
|                             Control Plane (Gateway)                           |
|  - Web UI / Chat Client                                                       |
|  - GitHub App Auth & Session Metadata                                         |
|  - Cloud Sandbox Orchestrator (Provisions VM/Container)                        |
|  - Event Bridge (Pipes SSE / WebSocket streams between Client and Sandbox)    |
+---------------------------------------+---------------------------------------+
                                        |
                            (JSON-RPC / WebSocket)
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       Ephemeral Sandbox (E2B / Modal / Daytona)               |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   |  dsh Headless / SDK Agent Process                                     |   |
|   |  - Workspace: /workspace/repo-name (Git Clone of chosen branch)       |   |
|   |  - Local ctx.fs & ctx.subprocess (Native execution inside Sandbox)    |   |
|   |  - Tools: bash, file_read, file_write, etc.                           |   |
|   +-----------------------------------------------------------------------+   |
+-------------------------------------------------------------------------------+
```

#### Execution Flow:
1. User selects repository `owner/repo`, branch `feature/xyz`, and initiates a chat session.
2. Control Plane Cloud Sandbox Orchestrator calls the selected provider (`E2B` / `Modal` / `Daytona`) to provision a sandbox.
3. Sandbox environment initializes, injects `GITHUB_TOKEN`, and clones the repository:
   ```sh
   git clone --depth 1 -b feature/xyz https://x-access-token:${GITHUB_TOKEN}@github.com/owner/repo.git /workspace
   ```
4. Sandbox starts a lightweight `dsh` headless process (`dsh headless --session-id <id>`).
5. Task inputs / messages are forwarded over WebSocket/JSON-RPC. The agent loop and all tool operations run locally inside the sandbox with zero network round-trip delay.

---

### 3.2 Option A: Remote Capability Seam Proxy

```
+-------------------------------------------------------------------------------+
|                              Control Plane (Host)                             |
|  - dsh Agent Loop (Runs on Control Plane Server)                             |
|  - Proxied Services:                                                          |
|    - ctx.fs -> RemoteFsProxy                                                  |
|    - ctx.subprocess -> RemoteSubprocessProxy                                  |
|    - ctx.sandbox -> RemoteSandboxProxy                                        |
+---------------------------------------+---------------------------------------+
                                        |
                             (gRPC / HTTP / SSH Tunnel)
                                        |
                                        v
+-------------------------------------------------------------------------------+
|                       Ephemeral Sandbox (E2B / Modal / Daytona)               |
|  - Filesystem (/workspace/repo-name)                                         |
|  - Remote Runner Agent / SSH Daemon / gRPC Subprocess Execution Server        |
+-------------------------------------------------------------------------------+
```

#### Execution Flow:
1. Control Plane executes the primary `dsh` Agent Loop.
2. `RemoteFsProxy` overrides `ctx.fs` to dispatch `readFile`, `writeFile`, `stat` over gRPC/HTTP to the remote sandbox.
3. `RemoteSubprocessProxy` overrides `ctx.subprocess` to spawn commands (`bash`, `terminal`) directly inside the remote sandbox container.
4. Confinement policy (`ctx.sandbox`) delegates execution limits to the remote sandbox environment boundary.

---

## 4. Cloud Sandbox Adapters

The system defines an abstract `CloudSandboxProvider` service:

```typescript
export interface CloudSandboxHandle {
  sessionId: string
  sandboxId: string
  workspacePath: string
  execCommand(cmd: string[], options?: ExecOptions): Promise<ExecResult>
  close(): Promise<void>
}

export abstract class CloudSandboxProvider extends Service {
  abstract provision(spec: {
    sessionId: string
    repoUrl: string
    branch: string
    githubToken: string
    mode: 'in-sandbox-agent' | 'remote-capability-proxy'
  }): Promise<CloudSandboxHandle>
}
```

### 4.1 E2B Sandbox (`dsh-sandbox-e2b`)
- **Backend**: E2B MicroVM (`@e2b/code-interpreter`).
- **Features**: Sub-second startup, Firecracker VM isolation, built-in command execution & filesystem API.

### 4.2 Modal Sandbox (`dsh-sandbox-modal`)
- **Backend**: Modal Containers (`modal.Sandbox.create`).
- **Features**: Serverless container execution, GPU/CPU scaling, custom Docker images.

### 4.3 Daytona Sandbox (`dsh-sandbox-daytona`)
- **Backend**: Daytona Dev Environment Server (`@daytonaio/sdk`).
- **Features**: Native Git repository & branch workspace creation, standardized Dev Containers, SSH/PTY terminal connection.

---

<a id="chinese-translation"></a>

## 中文说明 (Chinese Summary)

本设计规范阐述了将 **DeepSeek Harness** 改造成支持 GitHub App 集成与多云沙箱（E2B / Modal / Daytona）的 Cloud Agent 架构方案：

1. **设置项与 UI 选择下拉框**：
   - 支持设置 `executionMode`：默认为 `in-sandbox-agent`（方案 B：沙箱内运行 Agent 实例），可选 `remote-capability-proxy`（方案 A：控制面 Agent + 远程能力代理）。
   - 支持设置 `sandboxProvider`：可选 `e2b`、`modal`、`daytona`。
2. **方案 B（默认）：In-Sandbox Ephemeral Agent 实例**：
   - 控制面进行 GitHub 鉴权与沙箱调度；沙箱创建后自动 Clone 指定仓库和分支，并在沙箱内部启动轻量 `dsh headless` 进程。
   - 具有极低的时延与极强的工具执行性能。
3. **方案 A：控制面宿主 + 远程代理 (Remote Capability Seam Proxy)**：
   - Agent Loop 运行在控制面，将 `ctx.fs`、`ctx.subprocess`、`ctx.sandbox` 等能力缝隙重定向/代理至远端沙箱容器中执行。
