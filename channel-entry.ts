import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { yachPlugin } from './core/channel/plugin.js';
import { setYachRuntime } from './core/channel/runtime.js';

// robot/
import { registerContactsTools } from './robot/contacts/tools.js';
import { registerCalendarTools } from './robot/calendar/tools.js';
import { registerImTools } from './robot/im/tools.js';
import { registerChatGroupTools } from './robot/chat-group/tools.js';
import { registerDocsTools as registerRobotDocsTools } from './robot/docs/tools.js';
import { registerOkrTools as registerRobotOkrTools } from './robot/okr/tools.js';
import { registerWeeklyTools as registerRobotWeeklyTools } from './robot/weekly/tools.js';

// personal/
import { registerOkrTools as registerPersonalOkrTools } from './personal/okr/tools.js';
import { registerWeeklyTools as registerPersonalWeeklyTools } from './personal/weekly/tools.js';
import { registerDocsTools as registerPersonalDocsTools } from './personal/docs/tools.js';
import { registerAttendanceTools } from './personal/attendance/tools/index.js';
import { registerOrgTools } from './personal/org/tools.js';
import { registerMailTools } from './personal/mail/tools.js';
import { registerMeetingRoomTools } from './personal/meeting-room/tools.js';

export default defineChannelPluginEntry({
  id: 'yach',
  name: 'Yach',
  description: '知音楼数字伙伴 AI 频道插件，支持流式回复、主动推送、工具调用。',
  plugin: yachPlugin,
  setRuntime: setYachRuntime,
  registerCliMetadata: (_api) => {
    // TODO: register yach commands once personal/ layer is built
  },
  registerFull: (api) => {
    // robot/ — 机器人身份（AppKey/AppSecret）
    registerContactsTools(api);
    registerCalendarTools(api);
    registerImTools(api);
    registerChatGroupTools(api);
    registerRobotDocsTools(api);
    registerRobotOkrTools(api);
    registerRobotWeeklyTools(api);
    // personal/ — 个人身份（扫码登录）
    registerPersonalOkrTools(api);
    registerPersonalWeeklyTools(api);
    registerPersonalDocsTools(api);
    registerAttendanceTools(api);
    registerOrgTools(api);
    registerMailTools(api);
    registerMeetingRoomTools(api);
  },
});
