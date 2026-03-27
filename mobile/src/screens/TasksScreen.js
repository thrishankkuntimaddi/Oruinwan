/**
 * Chttrix Mobile — Tasks Screen
 * Displays workspace tasks with offline-first caching and quick status toggling.
 */
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const cached = await cacheGet('tasks');
      if (cached && !isRefresh) setTasks(cached);

      const { data } = await fetchTasks();
      const list = data.tasks || data || [];
      setTasks(list);
      await cacheSet('tasks', list);
    } catch (err) {
      console.warn('[TasksScreen] Failed to load tasks:', err.message);
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
      // Revert optimistic update on error
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    }
  }

  const grouped = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    todo: tasks.filter((t) => t.status === 'todo'),
    done: tasks.filter((t) => t.status === 'done'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
  };

  function renderSection(label, data) {
    if (data.length === 0) return null;
    return (
      <View key={label}>
        <Text style={styles.sectionHeader}>{label.replace('_', ' ').toUpperCase()}</Text>
        {data.map((task) => (
          <TouchableOpacity
            key={task._id}
            style={styles.taskCard}
            onPress={() => cycleStatus(task)}
          >
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[task.status] || '#475569' }]}>
              <Text style={styles.statusIcon}>{STATUS_ICONS[task.status] || '○'}</Text>
            </View>
            <View style={styles.taskInfo}>
              <Text style={[styles.taskTitle, task.status === 'done' && styles.strikethrough]}>
                {task.title}
              </Text>
              {task.dueDate && (
                <Text style={styles.dueDate}>
                  Due {new Date(task.dueDate).toLocaleDateString()}
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

  function priorityColor(p) {
    if (p === 'high' || p === 'urgent') return '#ef4444';
    if (p === 'medium') return '#f59e0b';
    return '#475569';
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
      <Text style={styles.heading}>Tasks</Text>
      <FlatList
        data={[]}
        ListHeaderComponent={() => (
          <>
            {renderSection('in_progress', grouped.in_progress)}
            {renderSection('todo', grouped.todo)}
            {renderSection('blocked', grouped.blocked)}
            {renderSection('done', grouped.done)}
            {tasks.length === 0 && (
              <Text style={styles.empty}>No tasks found</Text>
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
  heading: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', padding: 16 },
  sectionHeader: { color: '#64748b', fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, letterSpacing: 1 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 12 },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statusIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: '#475569' },
  dueDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priorityText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
