import { createPluginRuntimeStore } from 'openclaw/plugin-sdk/runtime-store';
import type { PluginRuntime } from 'openclaw/plugin-sdk/core';

const { setRuntime: setYachRuntime, getRuntime: getYachRuntime } =
  createPluginRuntimeStore<PluginRuntime>('Yach runtime not initialized');

export { getYachRuntime, setYachRuntime };
