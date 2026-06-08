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
  todo: '#383838',
  in_progress: '#c9a87c',
  done: '#5aba8a',
  blocked: '#e05252',
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
    if (p === 'high' || p === 'urgent') return '#e05252';
    if (p === 'medium') return '#c9a87c';
    return '#383838';
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
        <ActivityIndicator color="#b8956a" size="large" />
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
            tintColor="#b8956a"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  heading: { color: '#e4e4e4', fontSize: 18, fontWeight: '700' },
  wsBadge: {
    backgroundColor: '#111111', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#222222',
  },
  wsBadgeText: { color: '#b8956a', fontSize: 10, fontWeight: '700' },
  sectionHeader: {
    color: '#404040', fontSize: 10, fontWeight: '700',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111111', marginHorizontal: 12, marginBottom: 6,
    borderRadius: 6, padding: 12,
    borderWidth: 1, borderColor: '#191919',
  },
  statusDot: {
    width: 28, height: 28, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  statusIcon: { color: '#e4e4e4', fontSize: 13, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskTitle: { color: '#e4e4e4', fontSize: 14, fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: '#404040' },
  assignee: { color: '#7a7a7a', fontSize: 11, marginTop: 3 },
  dueDate: { color: '#7a7a7a', fontSize: 11, marginTop: 2 },
  dueDateOverdue: { color: '#e05252' },
  priorityBadge: { borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  priorityText: { color: '#0c0c0c', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 14 },
  emptyTitle: { color: '#e4e4e4', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyBody: { color: '#7a7a7a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

