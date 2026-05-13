import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { punchOffDuty, attendanceDoctor } from '../src/client.js';

export function registerAttendanceTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_attendance_punch_offduty',
    label: '知音楼下班打卡',
    description:
      '以当前登录用户身份执行知音楼下班打卡（需已完成扫码登录）。' +
      '可选传入地址，不传则使用考勤系统返回的默认位置。' +
      '注意：此工具仅支持下班打卡，不支持上班打卡。',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: '打卡地址（可选），如"北京市昌平区安居路靠近好未来大楼"，不传则自动使用默认位置',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { address?: string };
      try {
        const output = await punchOffDuty(p.address);
        return textResult(`✅ 下班打卡完成:\n${output}`, null);
      } catch (err) {
        return textResult(`下班打卡失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_attendance_doctor',
    label: '知音楼考勤环境诊断',
    description:
      '诊断考勤打卡环境（Python 运行时、桌面 bridge、会话状态等），不执行真实打卡。' +
      '出现打卡失败时可先运行此工具排查问题。',
    parameters: {
      type: 'object',
      properties: {},
    },
    async execute(_toolCallId: string, _rawParams: unknown) {
      try {
        const output = await attendanceDoctor();
        return textResult(output, null);
      } catch (err) {
        return textResult(`诊断失败: ${String(err)}`, null);
      }
    },
  });
}
