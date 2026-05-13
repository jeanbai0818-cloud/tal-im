import path from 'node:path';

import type { OpenClawPluginDefinition, OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { yachPlugin } from './core/channel/plugin.js';
import { setYachRuntime } from './core/channel/runtime.js';
import { PLUGIN_COMMAND, LEGACY_PLUGIN_COMMANDS } from './core/shared/constants.js';

const NON_GATEWAY_OPENCLAW_ROOT_COMMANDS = new Set([
  'agent', 'memory', 'plugins', 'plugin', 'mcp',
]);

export type YachRegistrationPlan = {
  registerGatewayCommands: boolean;
  registerBackgroundServices: boolean;
  reason: string;
};

function normalizeToken(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeBasename(value: unknown): string {
  const raw = String(value || '').trim();
  return raw ? path.basename(raw).toLowerCase() : '';
}

function isGatewayExecutable(name: string): boolean {
  return name === 'openclaw-gateway' || name === 'openclaw-gateway.exe';
}

function isAuxiliaryExecutable(name: string): boolean {
  return name.startsWith('openclaw-') && !isGatewayExecutable(name);
}

export function resolveYachRegistrationPlan(params?: {
  argv?: readonly string[];
  argv0?: string;
  title?: string;
}): YachRegistrationPlan {
  const argv = Array.isArray(params?.argv) ? [...params.argv] : process.argv;
  const argv0 = params?.argv0 ?? process.argv0;
  const title = params?.title ?? process.title;
  const firstToken = normalizeToken(argv[2]);
  const pluginTokens = new Set([PLUGIN_COMMAND, ...LEGACY_PLUGIN_COMMANDS]);
  const executableNames = [argv0, argv[0], argv[1], title]
    .map(normalizeBasename)
    .filter(Boolean);

  if (pluginTokens.has(firstToken)) {
    return { registerGatewayCommands: false, registerBackgroundServices: false, reason: 'plugin-cli' };
  }

  if (firstToken === 'gateway' || executableNames.some(isGatewayExecutable)) {
    return { registerGatewayCommands: true, registerBackgroundServices: true, reason: 'gateway' };
  }

  if (executableNames.some(isAuxiliaryExecutable)) {
    return { registerGatewayCommands: false, registerBackgroundServices: false, reason: 'openclaw-auxiliary-process' };
  }

  if (NON_GATEWAY_OPENCLAW_ROOT_COMMANDS.has(firstToken)) {
    return { registerGatewayCommands: false, registerBackgroundServices: false, reason: `openclaw-${firstToken}` };
  }

  return {
    registerGatewayCommands: true,
    registerBackgroundServices: false,
    reason: firstToken ? `generic-${firstToken}` : 'unknown-host',
  };
}

const plugin: OpenClawPluginDefinition = {
  id: 'yach-aio',
  name: 'Yach AIO Plugin',
  description: 'Zhiyinlou / 知音楼 plugin with QR auth, session persistence, contacts, org, IM, OKR, weekly reports, docs, mail, schedule, meeting-room, attendance, and intelloft AI flows.',
  register(api: OpenClawPluginApi) {
    const plan = resolveYachRegistrationPlan();
    api.logger.debug?.(`yach plugin registration plan: ${JSON.stringify(plan)}`);

    if (plan.registerGatewayCommands) {
      api.registerChannel?.({ plugin: yachPlugin });
      setYachRuntime(api.runtime as never);
      // TODO: register CLI commands once personal/ and robot/ layers are built
    }

    // TODO: register background daemon service once robot/im monitor is implemented
  },
};

export default plugin;
