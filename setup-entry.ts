import { defineSetupPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { yachPlugin } from './core/channel/plugin.js';

export default defineSetupPluginEntry(yachPlugin);
