// Route registry. Everything except Home is code-split so the first screen loads fast.
import { lazy } from 'react';

const pick = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));

const chats = () => import('../features/chats/index.js');
const tasks = () => import('../features/tasks/index.js');
const notes = () => import('../features/notes/index.js');
const settings = () => import('../features/settings/index.jsx');
const more = () => import('../features/more/index.jsx');
const knowledge = () => import('../features/knowledge/screens.jsx');
const meetings = () => import('../features/meetings/screens.jsx');
const admin = () => import('../features/admin/screens.jsx');
const roadmap = () => import('../features/roadmap/screens.jsx');
const design = () => import('../features/design/screens.jsx');
const automations = () => import('../features/automations/screens.jsx');

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
  saved: pick(chats, 'SavedScreen'),
  task: pick(tasks, 'TaskScreen'),
  planning: pick(tasks, 'PlanningScreen'),
  sprint: pick(tasks, 'SprintScreen'),
  note: pick(notes, 'NoteScreen'),
  knowledge: pick(knowledge, 'KnowledgeScreen'),
  page: pick(knowledge, 'PageScreen'),
  files: pick(more, 'FilesScreen'),
  file: pick(() => import('../features/files/FileScreen.jsx'), 'FileScreen'),
  notifications: pick(more, 'NotificationsScreen'),
  search: pick(() => import('../features/search/SearchScreen.jsx'), 'SearchScreen'),
  integrations: pick(more, 'IntegrationsScreen'),
  agents: pick(() => import('../features/agents/AgentsScreen.jsx'), 'AgentsScreen'),
  huddles: pick(() => import('../features/huddles/HuddlesScreen.jsx'), 'HuddlesScreen'),
  // "All meetings" is the Huddles screen now (live, upcoming and past, quick huddles included).
  meetings: pick(() => import('../features/huddles/HuddlesScreen.jsx'), 'HuddlesScreen'),
  meeting: pick(meetings, 'MeetingScreen'),
  workspace: pick(more, 'WorkspaceScreen'),
  roadmap: pick(roadmap, 'RoadmapScreen'),
  roadmapItem: pick(roadmap, 'RoadmapItemScreen'),
  designReviews: pick(design, 'DesignReviewsScreen'),
  designReview: pick(design, 'DesignReviewScreen'),
  automations: pick(automations, 'AutomationsScreen'),
  automation: pick(automations, 'AutomationScreen'),
  admin: pick(admin, 'AdminScreen'),
  'admin.analytics': pick(admin, 'AdminAnalyticsScreen'),
  'admin.features': pick(admin, 'AdminFeaturesScreen'),
  'admin.permissions': pick(admin, 'AdminPermissionsScreen'),
  'admin.channels': pick(admin, 'AdminChannelsScreen'),
  'admin.directory': pick(admin, 'AdminDirectoryScreen'),
  'admin.org': pick(admin, 'AdminOrgScreen'),
  'admin.departments': pick(admin, 'AdminDepartmentsScreen'),
  'admin.audit': pick(admin, 'AdminAuditScreen'),
  'admin.templates': pick(admin, 'AdminTemplatesScreen'),
  'admin.data': pick(admin, 'AdminDataScreen'),
  settings: pick(settings, 'SettingsScreen'),
  'settings.profile': pick(settings, 'ProfileSettings'),
  'settings.security': pick(settings, 'SecuritySettings'),
  'settings.twofactor': pick(settings, 'TwoFactorSettings'),
  'settings.account-data': pick(settings, 'AccountDataSettings'),
  'settings.devices': pick(settings, 'DevicesSettings'),
  'settings.notifications': pick(settings, 'NotificationSettings'),
  'settings.appearance': pick(settings, 'AppearanceSettings'),
  'settings.privacy': pick(settings, 'PrivacySettings'),
  'settings.ai': pick(settings, 'AiSettings'),
  'settings.plan': pick(() => import('../features/plan/PlanScreen.jsx'), 'PlanScreen'),
  'settings.updates': pick(settings, 'UpdateSettings'),
  'settings.server': pick(settings, 'ServerSettings'),
  'settings.data': pick(settings, 'DataSettings'),
  'settings.about': pick(settings, 'AboutSettings'),
};
