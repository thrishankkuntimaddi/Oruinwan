// Route registry. Everything except Home is code-split so the first screen loads fast.
import { lazy } from 'react';

const pick = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const chats = () => import('../features/chats/index.js');
const tasks = () => import('../features/tasks/index.js');
const notes = () => import('../features/notes/index.js');
const settings = () => import('../features/settings/index.jsx');
const more = () => import('../features/more/index.jsx');

export const TAB_ROOTS = {
  chats: pick(chats, 'ChatsScreen'),
  ai: pick(() => import('../features/ai/AiScreen.jsx'), 'AiScreen'),
  tasks: pick(tasks, 'TasksScreen'),
  notes: pick(notes, 'NotesScreen'),
};

export const ROUTES = {
  conversation: pick(chats, 'ConversationScreen'),
  thread: pick(chats, 'ThreadScreen'),
  channelInfo: pick(chats, 'ChannelInfoScreen'),
  newMessage: pick(chats, 'NewMessageScreen'),
  browseChannels: pick(chats, 'BrowseChannelsScreen'),
  profile: pick(chats, 'ProfileScreen'),
  task: pick(tasks, 'TaskScreen'),
  note: pick(notes, 'NoteScreen'),
  knowledge: pick(more, 'KnowledgeScreen'),
  page: pick(more, 'PageScreen'),
  files: pick(more, 'FilesScreen'),
  notifications: pick(more, 'NotificationsScreen'),
  search: pick(more, 'SearchScreen'),
  integrations: pick(more, 'IntegrationsScreen'),
  workspace: pick(more, 'WorkspaceScreen'),
  settings: pick(settings, 'SettingsScreen'),
  'settings.profile': pick(settings, 'ProfileSettings'),
  'settings.security': pick(settings, 'SecuritySettings'),
  'settings.devices': pick(settings, 'DevicesSettings'),
  'settings.notifications': pick(settings, 'NotificationSettings'),
  'settings.appearance': pick(settings, 'AppearanceSettings'),
  'settings.privacy': pick(settings, 'PrivacySettings'),
  'settings.ai': pick(settings, 'AiSettings'),
  'settings.updates': pick(settings, 'UpdateSettings'),
  'settings.server': pick(settings, 'ServerSettings'),
  'settings.data': pick(settings, 'DataSettings'),
  'settings.about': pick(settings, 'AboutSettings'),
};
