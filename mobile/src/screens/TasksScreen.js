import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  fetchTasks, fetchMyTasks, createTask, updateTask, TASK_STATUSES, TASK_PRIORITIES, TASK_TRANSITIONS,
} from '../services/api/tasks';
import { cacheGet, cacheSet } from '../services/storage';
import { errorMessage } from '../services/http';
import { on, toast } from '../services/events';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useSocketEvent } from '../hooks/useSocketEvent';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

const STATUS_META = {
  backlog: { label: 'Backlog', color: T.textMuted, icon: '◌' },
  todo: { label: 'To do', color: T.borderAccent, icon: '○' },
  in_progress: { label: 'In progress', color: T.warning, icon: '◑' },
  review: { label: 'In review', color: '#8a9bd6', icon: '◐' },
  blocked: { label: 'Blocked', color: T.danger, icon: '✕' },
  done: { label: 'Done', color: T.success, icon: '●' },
  cancelled: { label: 'Cancelled', color: T.textMuted, icon: '⊘' },
};
const PRIORITY_COLOR = { highest: T.danger, high: T.danger, medium: T.warning, low: T.borderAccent, lowest: T.borderAccent };
const idOf = (v) => (v == null ? null : String(v._id ?? v.id ?? v));

const TaskRow = memo(function TaskRow({ task, onPress }) {
  const meta = STATUS_META[task.status] || STATUS_META.todo;
  const assignees = (task.assignedTo || []).map((a) => a?.username).filter(Boolean);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && !['done', 'cancelled'].includes(task.status);
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(task)} activeOpacity={0.7}>
      <View style={[s.dot, { borderColor: meta.color }]}><Text style={[s.dotIcon, { color: meta.color }]}>{meta.icon}</Text></View>
      <View style={s.info}>
        <Text style={[s.title, task.status === 'done' && s.strike]} numberOfLines={2}>{task.title}</Text>
        <View style={s.metaRow}>
          {task.issueKey ? <Text style={s.meta}>{task.issueKey}</Text> : null}
          {assignees.length ? <Text style={s.meta} numberOfLines={1}>👤 {assignees.join(', ')}</Text> : null}
          {due ? <Text style={[s.meta, overdue && { color: T.danger }]}>📅 {due.toLocaleDateString()}</Text> : null}
          {task._pending ? <Text style={[s.meta, { color: T.warning }]}>⏳ queued</Text> : null}
        </View>
        {task.status === 'blocked' && task.blockedReason ? <Text style={s.blocked}>Blocked: {task.blockedReason}</Text> : null}
      </View>
      <View style={[s.priority, { backgroundColor: PRIORITY_COLOR[task.priority] || T.borderAccent }]} />
    </TouchableOpacity>
  );
});

export default function TasksScreen() {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [scope, setScope] = useState('mine'); // mine | all
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [blockReason, setBlockReason] = useState(null); // string when entering a reason
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);
  const { dispatch } = useOfflineQueue();
  const cacheKey = `tasks_${wsId}_${scope}`;

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = scope === 'mine' ? await fetchMyTasks() : await fetchTasks(wsId);
      let list = data?.tasks || [];
      if (scope === 'mine') list = list.filter((t) => idOf(t.workspace) === String(wsId));
      setTasks(list);
      cacheSet(cacheKey, list).catch(() => {});
    } catch (err) {
      toast(errorMessage(err, 'Could not load tasks'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId, scope, cacheKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTasks([]);
    cacheGet(cacheKey).then((c) => { if (!cancelled && c) setTasks(c); });
    return () => { cancelled = true; };
  }, [cacheKey]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocketEvent('task-updated', () => load());
  useSocketEvent('task-assigned', () => load());

  // Roll back optimistic status changes the server rejected after an offline flush.
  useEffect(() => on('queue:failed', ({ item, error }) => {
    if (item?.type !== 'UPDATE_TASK') return;
    toast(errorMessage(error, 'Task update was rejected'), 'error');
    load();
  }), [load]);
  useEffect(() => on('queue:processed', ({ item, result }) => {
    if (item?.type !== 'UPDATE_TASK' || !result?._id) return;
    setTasks((prev) => prev.map((t) => (t._id === result._id ? result : t)));
  }), []);

  const sections = useMemo(() => TASK_STATUSES
    .map((st) => ({ key: st, title: STATUS_META[st].label, data: tasks.filter((t) => t.status === st) }))
    .filter((sec) => sec.data.length), [tasks]);

  const changeStatus = useCallback(async (task, status, blockedReason) => {
    setSelected(null);
    setBlockReason(null);
    const updates = status === 'blocked' ? { status, blockedReason } : { status };
    const before = task;
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, ...updates, _pending: true } : t)));
    try {
      const res = await dispatch(
        { type: 'UPDATE_TASK', payload: { taskId: task._id, updates } },
        async () => (await updateTask(task._id, updates)).data?.task,
      );
      setTasks((prev) => prev.map((t) => {
        if (t._id !== task._id) return t;
        if (res.queued) return t;
        return res.result?._id ? res.result : { ...t, _pending: false };
      }));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? before : t)));
      toast(errorMessage(err, 'Could not update task'), 'error');
    }
  }, [dispatch]);

  const submitCreate = useCallback(async () => {
    const title = draft.title.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const { data } = await createTask({ title, workspaceId: wsId, priority: draft.priority, assignmentType: 'self' });
      const created = data?.tasks || (data?.task ? [data.task] : []);
      setTasks((prev) => [...created, ...prev]);
      setCreating(false);
      setDraft({ title: '', priority: 'medium' });
      toast('Task created', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not create task'), 'error');
    } finally {
      setSaving(false);
    }
  }, [draft, saving, wsId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = useCallback(({ item }) => <TaskRow task={item} onPress={setSelected} />, []);

  if (!workspace) {
    return <View style={s.root}><EmptyState icon="🏢" title="No workspace selected" body="Go to Home to select a workspace." /></View>;
  }

  const transitions = selected ? TASK_TRANSITIONS[selected.status] || [] : [];

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Tasks"
        subtitle={workspace.name}
        right={<TouchableOpacity style={s.newBtn} onPress={() => setCreating(true)}><Text style={s.newText}>＋ New</Text></TouchableOpacity>}
      />
      <View style={s.tabs}>
        {[['mine', 'My tasks'], ['all', 'Workspace']].map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.tab, scope === k && s.tabOn]} onPress={() => setScope(k)}>
            <Text style={[s.tabText, scope === k && s.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && !tasks.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => String(t._id)}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={s.section}>{section.title.toUpperCase()} · {section.data.length}</Text>}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="📋" title="No tasks" body={scope === 'mine' ? 'Nothing assigned to you here.' : 'No tasks in this workspace yet.'} actionLabel="Create a task" onAction={() => setCreating(true)} />}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => { setSelected(null); setBlockReason(null); }}>
        <Pressable style={s.overlay} onPress={() => { setSelected(null); setBlockReason(null); }}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle} numberOfLines={2}>{selected?.title}</Text>
            {selected?.description ? <Text style={s.sheetDesc} numberOfLines={4}>{selected.description}</Text> : null}
            {blockReason !== null ? (
              <>
                <Text style={s.label}>WHY IS IT BLOCKED?</Text>
                <TextInput style={s.input} autoFocus placeholder="Reason (required)" placeholderTextColor={T.textMuted} value={blockReason} onChangeText={setBlockReason} />
                <TouchableOpacity style={[s.primary, !blockReason.trim() && s.off]} disabled={!blockReason.trim()} onPress={() => changeStatus(selected, 'blocked', blockReason.trim())}>
                  <Text style={s.primaryText}>Mark blocked</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.label}>MOVE TO</Text>
                {transitions.map((st) => (
                  <TouchableOpacity key={st} style={s.option} onPress={() => (st === 'blocked' ? setBlockReason('') : changeStatus(selected, st))}>
                    <Text style={[s.optionIcon, { color: STATUS_META[st].color }]}>{STATUS_META[st].icon}</Text>
                    <Text style={s.optionText}>{STATUS_META[st].label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <Pressable style={s.overlay} onPress={() => setCreating(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>New task</Text>
            <Text style={s.label}>TITLE</Text>
            <TextInput style={s.input} autoFocus maxLength={500} placeholder="What needs to be done?" placeholderTextColor={T.textMuted}
              value={draft.title} onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))} />
            <Text style={s.label}>PRIORITY</Text>
            <View style={s.chips}>
              {TASK_PRIORITIES.map((p) => (
                <TouchableOpacity key={p} style={[s.chip, draft.priority === p && s.chipOn]} onPress={() => setDraft((d) => ({ ...d, priority: p }))}>
                  <Text style={[s.chipText, draft.priority === p && s.chipTextOn]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[s.primary, (!draft.title.trim() || saving) && s.off]} disabled={!draft.title.trim() || saving} onPress={submitCreate}>
              {saving ? <ActivityIndicator color={T.bgBase} /> : <Text style={s.primaryText}>Create task</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: T.borderDefault },
  tabOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  tabText: { color: T.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: T.accent },
  section: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: T.bgSurface, borderRadius: 6,
    padding: 12, marginBottom: 6, borderWidth: 1, borderColor: T.borderSubtle,
  },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  dotIcon: { fontSize: 11, fontWeight: '800' },
  info: { flex: 1 },
  title: { color: T.textPrimary, fontSize: 14, fontWeight: '500' },
  strike: { textDecorationLine: 'line-through', color: T.textSecondary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  meta: { color: T.textSecondary, fontSize: 11 },
  blocked: { color: T.danger, fontSize: 11, marginTop: 4 },
  priority: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginLeft: 8 },
  newBtn: { borderWidth: 1, borderColor: T.accent, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  newText: { color: T.accent, fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bgSurface, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 20, paddingBottom: 36 },
  sheetTitle: { color: T.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  sheetDesc: { color: T.textSecondary, fontSize: 13, marginBottom: 8 },
  label: { color: T.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  optionIcon: { width: 24, fontSize: 14, fontWeight: '800' },
  optionText: { color: T.textPrimary, fontSize: 14 },
  input: {
    backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 11,
    color: T.textPrimary, fontSize: 14, borderWidth: 1, borderColor: T.borderDefault,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: T.borderDefault },
  chipOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  chipText: { color: T.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  chipTextOn: { color: T.accent, fontWeight: '700' },
  primary: { backgroundColor: T.accent, borderRadius: 4, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  primaryText: { color: T.bgBase, fontWeight: '700' },
  off: { opacity: 0.45 },
});
