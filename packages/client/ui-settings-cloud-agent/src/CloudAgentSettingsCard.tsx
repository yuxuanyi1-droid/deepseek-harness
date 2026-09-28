import React, { useState } from 'react'

export interface CloudAgentSettingsState {
  executionMode: 'in-sandbox-agent' | 'remote-capability-proxy'
  sandboxProvider: 'e2b' | 'modal' | 'daytona'
  idleTimeoutMinutes: number
  githubAppId: string
  githubPrivateKeyEnv: string
  githubWebhookSecretEnv: string
  e2bApiKeyEnv: string
  modalTokenEnv: string
  daytonaApiUrlEnv: string
}

export interface CloudAgentSettingsCardProps {
  initialState?: Partial<CloudAgentSettingsState>
  onSave?: (newState: CloudAgentSettingsState) => void
  disabled?: boolean
}

export const DEFAULT_CLOUD_AGENT_SETTINGS: CloudAgentSettingsState = {
  executionMode: 'in-sandbox-agent',
  sandboxProvider: 'e2b',
  idleTimeoutMinutes: 20,
  githubAppId: '',
  githubPrivateKeyEnv: 'GITHUB_APP_PRIVATE_KEY',
  githubWebhookSecretEnv: 'GITHUB_WEBHOOK_SECRET',
  e2bApiKeyEnv: 'E2B_API_KEY',
  modalTokenEnv: 'MODAL_TOKEN_ID',
  daytonaApiUrlEnv: 'DAYTONA_SERVER_URL',
}

export function CloudAgentSettingsCard(props: CloudAgentSettingsCardProps) {
  const [state, setState] = useState<CloudAgentSettingsState>({
    ...DEFAULT_CLOUD_AGENT_SETTINGS,
    ...props.initialState,
  })

  const handleChange = <K extends keyof CloudAgentSettingsState>(key: K, value: CloudAgentSettingsState[K]) => {
    const updated = { ...state, [key]: value }
    setState(updated)
    props.onSave?.(updated)
  }

  return (
    <div className="dsh-settings-card cloud-agent-settings">
      <h3 className="settings-title">Cloud Agent & Sandbox Settings</h3>

      {/* Execution Mode Dropdown */}
      <div className="settings-field">
        <label htmlFor="execution-mode-select">Execution Architecture Mode</label>
        <select
          id="execution-mode-select"
          value={state.executionMode}
          disabled={props.disabled}
          onChange={e => handleChange('executionMode', e.target.value as any)}
        >
          <option value="in-sandbox-agent">In-Sandbox Ephemeral Agent (Option B - Default / Recommended)</option>
          <option value="remote-capability-proxy">Remote Capability Seam Proxy (Option A)</option>
        </select>
        <p className="field-hint">
          In-Sandbox Agent runs a lightweight Harness instance directly inside the ephemeral VM/container with minimal tool latency.
        </p>
      </div>

      {/* Cloud Sandbox Provider Dropdown */}
      <div className="settings-field">
        <label htmlFor="sandbox-provider-select">Cloud Sandbox Provider</label>
        <select
          id="sandbox-provider-select"
          value={state.sandboxProvider}
          disabled={props.disabled}
          onChange={e => handleChange('sandboxProvider', e.target.value as any)}
        >
          <option value="e2b">E2B Sandbox (Sub-second Firecracker MicroVM)</option>
          <option value="modal">Modal Sandbox (Serverless Container / GPU)</option>
          <option value="daytona">Daytona Sandbox (Dev Environment Server)</option>
        </select>
        <p className="field-hint">
          Select the cloud infrastructure provider for ephemeral per-session isolation.
        </p>
      </div>

      {/* GitHub App Configuration */}
      <div className="settings-field">
        <label htmlFor="github-app-id">GitHub App ID</label>
        <input
          id="github-app-id"
          type="text"
          value={state.githubAppId}
          placeholder="e.g. 123456"
          disabled={props.disabled}
          onChange={e => handleChange('githubAppId', e.target.value)}
        />
      </div>

      <div className="settings-field">
        <label htmlFor="github-private-key-env">GitHub App Private Key Environment Variable</label>
        <input
          id="github-private-key-env"
          type="text"
          value={state.githubPrivateKeyEnv}
          disabled={props.disabled}
          onChange={e => handleChange('githubPrivateKeyEnv', e.target.value)}
        />
      </div>

      {/* Idle Timeout */}
      <div className="settings-field">
        <label htmlFor="idle-timeout">Idle Timeout (Minutes)</label>
        <input
          id="idle-timeout"
          type="number"
          min="1"
          max="120"
          value={state.idleTimeoutMinutes}
          disabled={props.disabled}
          onChange={e => handleChange('idleTimeoutMinutes', parseInt(e.target.value, 10) || 20)}
        />
      </div>
    </div>
  )
}
