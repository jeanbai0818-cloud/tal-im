import type { ChannelSetupWizard } from 'openclaw/plugin-sdk/setup-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/plugin-entry';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';
import { getQrCode } from '../auth/qr/client.js';
import { waitForLogin, QrTimeoutError } from '../auth/qr/poller.js';
import { writeQrFiles, printQrToTerminal } from '../auth/qr/render.js';
import { loadIdentity, saveIdentity } from '../session/identity.js';
import { resolveAccount, patchChannelConfig } from '../shared/account.js';
import { DEFAULT_ACCOUNT_ID } from '../shared/constants.js';
import path from 'node:path';

const workspaceDir = path.join(STATE_DIR, 'workspace');

export const yachSetupWizard: ChannelSetupWizard = {
  channel: 'yach',

  status: {
    configuredLabel: 'Yach (知音楼) — 已配置',
    unconfiguredLabel: 'Yach (知音楼) — 未配置',
    resolveConfigured: ({ cfg }) => resolveAccount(cfg).configured,
  },

  prepare: async ({ cfg: _cfg, prompter }) => {
    // ── Step 1: Check for existing identity ───────────────────────────────────
    const existing = await loadIdentity();
    if (existing) {
      const display = existing.name || existing.workcode;
      const rescan = await prompter.confirm({
        message: `已有扫码凭证（${display}）。是否重新扫码登录？`,
        initialValue: false,
      });
      if (!rescan) return;
    }

    // ── Step 2: Fetch QR code ─────────────────────────────────────────────────
    const progress = prompter.progress('正在获取二维码…');
    let qrCode: Awaited<ReturnType<typeof getQrCode>>;
    try {
      qrCode = await getQrCode();
      progress.stop('二维码已生成');
    } catch (err) {
      progress.stop('获取二维码失败，请检查网络连接');
      await prompter.note(
        `${err instanceof Error ? err.message : String(err)}\n\n` +
        '可以跳过扫码，稍后使用 `openclaw config` 重新配置，\n' +
        '或者只配置机器人凭证（AppKey / AppSecret）以启用频道。',
        '扫码失败（非必须步骤）',
      );
      return;
    }

    // ── Step 3: Render QR to terminal ─────────────────────────────────────────
    await printQrToTerminal(qrCode);

    // Write PNG as a bonus (non-fatal)
    const artifacts = await writeQrFiles(workspaceDir, qrCode);
    if (artifacts.pngPath) {
      await prompter.note(`PNG 文件：${artifacts.pngPath}`, '二维码文件（可用图片查看器打开）');
    }

    // ── Step 4: Wait for confirmation ─────────────────────────────────────────
    const scanProgress = prompter.progress('等待手机确认扫码…');
    try {
      const identity = await waitForLogin(qrCode, {
        onProgress: (p) => {
          if (p.event === 'scanned') scanProgress.stop('已扫码，等待确认…');
        },
      });
      scanProgress.stop(`扫码成功！欢迎，${identity.name || identity.workcode}`);
      await saveIdentity(identity);
    } catch (err) {
      scanProgress.stop(err instanceof QrTimeoutError ? '二维码已过期' : '扫码失败');
      await prompter.note(
        `${err instanceof Error ? err.message : '扫码过程出现错误'}\n\n` +
        '可以继续配置机器人凭证（AppKey / AppSecret），\n' +
        '扫码登录可以之后单独完成。',
        '扫码失败（可继续配置机器人）',
      );
    }
  },

  credentials: [
    {
      inputKey: 'appToken',
      providerHint: 'yach',
      credentialLabel: 'AppKey（数字伙伴机器人）',
      envPrompt: '使用环境变量 YACH_APP_KEY',
      keepPrompt: '保留现有 AppKey',
      inputPrompt: '输入知音楼数字伙伴 AppKey',
      helpTitle: '如何获取 AppKey',
      helpLines: [
        '1. 在知音楼侧边栏找到「AI Group」',
        '2. 顶部选择「数字伙伴」→「创建数字伙伴」，选择空白模版 → 编排 → 长链接模式，发布',
        '3. 顶部找到「开发者选项」，复制其中的 AppKey',
      ],
      inspect: ({ cfg }) => {
        const account = resolveAccount(cfg);
        return {
          accountConfigured: account.configured,
          hasConfiguredValue: Boolean(account.appKey),
          resolvedValue: account.appKey,
        };
      },
      applySet: ({ cfg, resolvedValue }) =>
        patchChannelConfig(cfg as OpenClawConfig, { appKey: resolvedValue }),
    },
    {
      inputKey: 'secret',
      providerHint: 'yach',
      credentialLabel: 'AppSecret（数字伙伴机器人）',
      envPrompt: '使用环境变量 YACH_APP_SECRET',
      keepPrompt: '保留现有 AppSecret',
      inputPrompt: '输入知音楼数字伙伴 AppSecret',
      helpTitle: '如何获取 AppSecret',
      helpLines: [
        '1. 在知音楼侧边栏找到「AI Group」',
        '2. 顶部选择「数字伙伴」→「创建数字伙伴」，选择空白模版 → 编排 → 长链接模式，发布',
        '3. 顶部找到「开发者选项」，复制其中的 AppSecret',
      ],
      inspect: ({ cfg }) => {
        const account = resolveAccount(cfg);
        return {
          accountConfigured: account.configured,
          hasConfiguredValue: Boolean(account.appSecret),
          resolvedValue: account.appSecret,
        };
      },
      applySet: ({ cfg, resolvedValue }) =>
        patchChannelConfig(cfg as OpenClawConfig, { appSecret: resolvedValue }),
    },
  ],

  completionNote: {
    title: 'Yach (知音楼) 配置完成',
    lines: [
      '数字伙伴频道已配置完成。',
      '重启网关（openclaw gateway restart）后，机器人将开始接收消息。',
      '',
      '扫码登录（如已完成）：个人身份工具（日程、文档等）现已可用。',
      '如需重新扫码，请重新运行 openclaw config 并选择 Yach 频道。',
    ],
  },
};

// ── Standalone QR re-login helper (used by CLI commands) ─────────────────────

export async function performQrLogin(): Promise<void> {
  const qrCode = await getQrCode();

  await printQrToTerminal(qrCode);
  const identity = await waitForLogin(qrCode);
  await saveIdentity(identity);
  console.log(`扫码成功！欢迎，${identity.name || identity.workcode}`);
}

// Re-export for channel plugin
export { DEFAULT_ACCOUNT_ID };
