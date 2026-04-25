import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { fetchTasks, updateTask } from '../services/api';
import { cacheGet, cacheSet } from '../services/storage';
import { useApp } from '../context/AppContext';

const STATUS_COLORS = {
  todo: '#475569',
  in_progress: '#f59e0b',
  done: '#10b981',
  blocked: '#ef4444',
};

const STATUS_ICONS = {
  todo: '○',
  in_progress: '◑',
  done: '●',
  blocked: '✕',
};

const NEXT_STATUS = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
  blocked: 'todo',
};

export default function TasksScreen() {
  const { workspace } = useApp();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [workspace?._id]);

  async function loadTasks(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const cacheKey = `tasks_${workspace?._id || 'all'}`;
      const cached = await cacheGet(cacheKey);
      if (cached && !isRefresh) setTasks(cached);

      const { data } = await fetchTasks(workspace?._id);
      const list = data.tasks || data || [];
      setTasks(list);
      await cacheSet(cacheKey, list);
    } catch (err) {
      console.warn('[TasksScreen] loadTasks:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function cycleStatus(task) {
    const next = NEXT_STATUS[task.status] || 'todo';
    const updated = { ...task, status: next };
    
    setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
    try {
      await updateTask(task._id, { status: next });
    } catch (err) {
      
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
      console.warn('[TasksScreen] cycleStatus:', err.message);
    }
  }

  const grouped = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    todo: tasks.filter((t) => t.status === 'todo'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  function priorityColor(p) {
    if (p === 'high' || p === 'urgent') return '#ef4444';
    if (p === 'medium') return '#f59e0b';
    return '#475569';
  }

  function renderSection(label, data) {
    if (data.length === 0) return null;
    const readableLabel = label.replace('_', ' ').toUpperCase();
    return (
      <View key={label}>
        <Text style={styles.sectionHeader}>{readableLabel}</Text>
        {data.map((task) => (
          <TouchableOpacity
            key={task._id}
            style={styles.taskCard}
            onPress={() => cycleStatus(task)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLORS[task.status] || '#475569' },
            ]}>
              <Text style={styles.statusIcon}>
                {STATUS_ICONS[task.status] || '○'}
              </Text>
            </View>
            <View style={styles.taskInfo}>
              <Text style={[
                styles.taskTitle,
                task.status === 'done' && styles.strikethrough,
              ]}>
                {task.title}
              </Text>
              {task.assignee?.username && (
                <Text style={styles.assignee}>
                  👤 {task.assignee.username}
                </Text>
              )}
              {task.dueDate && (
                <Text style={[
                  styles.dueDate,
                  new Date(task.dueDate) < new Date() && task.status !== 'done' && styles.dueDateOverdue,
                ]}>
                  🗓 {new Date(task.dueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColor(task.priority) }]}>
              <Text style={styles.priorityText}>{task.priority || 'med'}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Tasks</Text>
        {workspace && (
          <View style={styles.wsBadge}>
            <Text style={styles.wsBadgeText}>{workspace.name}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={[]}
        ListHeaderComponent={() => (
          <>
            {renderSection('in_progress', grouped.in_progress)}
            {renderSection('todo', grouped.todo)}
            {renderSection('blocked', grouped.blocked)}
            {renderSection('done', grouped.done)}
            {tasks.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No tasks yet</Text>
                <Text style={styles.emptyBody}>
                  Create tasks from the web app and they'll appear here.
                </Text>
              </View>
            )}
          </>
        )}
        renderItem={null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
            tintColor="#6366f1"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  heading: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  wsBadge: {
    backgroundColor: '#1e293b', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#334155',
  },
  wsBadgeText: { color: '#6366f1', fontSize: 11, fontWeight: '700' },
  sectionHeader: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, letterSpacing: 1,
  },
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, padding: 12,
  },
  statusDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  statusIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: '#475569' },
  assignee: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
  dueDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  dueDateOverdue: { color: '#ef4444' },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
