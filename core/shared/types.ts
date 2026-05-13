/** Personal session identity stored at ~/.openclaw/identity */
export type YachIdentity = {
  userId: string;     // Opaque user ID (e.g. "yach123456" or a long digit string)
  workcode: string;   // Employee work code (e.g. "035063")
  name: string;       // Display name
  token: string;      // JWT access token for API calls
  cloudtoken: string; // Cloud token required by some OAPI endpoints
  gtoken: string;     // AES-128-ECB(workcode + "_" + token) gateway token
  deptid: string;     // Department ID
  createdAt: number;  // Unix ms when this session was established
};

export type YachQrCode = {
  sessionId: string; // Server-assigned randstr
  url: string;       // Full QR scan URL
  expiresAt: number; // Unix ms expiry
};

export type YachQrPollState =
  | { status: 'pending' }
  | { status: 'scanned' }
  | { status: 'confirmed'; identity: YachIdentity }
  | { status: 'expired'; code?: number; message?: string };

export type YachAccountConfig = {
  enabled?: boolean;
  name?: string;
  appKey?: string;
  appSecret?: string;
  baseUrl?: string;
  webhookPath?: string;
  connectionMode?: 'webhook' | 'channel';
  channelAppId?: string;
  replyMode?: 'stream' | 'direct';
  dmPolicy?: 'open' | 'pairing' | 'allowlist' | 'disabled';
  allowFrom?: Array<string | number>;
  groupPolicy?: 'open' | 'allowlist' | 'disabled';
  groupAllowFrom?: Array<string | number>;
  commandAllowFrom?: Array<string | number>;
  chatHistoryEnabled?: boolean;
  chatHistoryLimit?: number;
  toolAuthMode?: 'app' | 'user';
  typingExpression?: string;
  markdownTableMode?: 'code' | 'table';
  textChunkLimit?: number;
  chunkMode?: 'length' | 'newline';
  dynamicAgentCreation?: {
    enabled?: boolean;
    workspaceTemplate?: string;
    agentDirTemplate?: string;
    maxAgents?: number;
  };
  accounts?: Record<string, Omit<YachAccountConfig, 'accounts'>>;
};

export type ResolvedYachAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  appKey?: string;
  appSecret?: string;
  baseUrl: string;
  config: Omit<YachAccountConfig, 'accounts'>;
};
