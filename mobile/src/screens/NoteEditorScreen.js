import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { createNote, updateNote, archiveNote } from '../services/api/notes';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import { T } from '../theme';

/** Create / view / edit a note. Only the owner may edit (server enforces it too). */
export default function NoteEditorScreen({ route, navigation }) {
  const { user, workspace } = useApp();
  const initial = route.params?.note || null;
  const [note, setNote] = useState(initial);
  const [title, setTitle] = useState(initial?.title || '');
  const [content, setContent] = useState(initial?.content || '');
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  const ownerId = String(note?.owner?._id ?? note?.owner ?? '');
  const canEdit = !note || ownerId === String(user?._id);

  useEffect(() => {
    dirty.current = title !== (note?.title || '') || content !== (note?.content || '');
  }, [title, content, note]);

  const save = useCallback(async () => {
    const t = title.trim();
    if (!t) {
      toast('A title is required', 'error');
      return false;
    }
    setSaving(true);
    try {
      const { data } = note?._id
        ? await updateNote(note._id, { title: t, content })
        : await createNote({ title: t, content, workspaceId: workspace?._id, type: 'note' });
      setNote(data?.note || note);
      dirty.current = false;
      toast('Note saved', 'success');
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Could not save note'), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [title, content, note, workspace?._id]);

  const back = useCallback(() => {
    if (!canEdit || !dirty.current) return navigation.goBack();
    Alert.alert('Unsaved changes', 'Save before leaving?', [
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: async () => { if (await save()) navigation.goBack(); } },
    ]);
    return undefined;
  }, [canEdit, navigation, save]);

  const archive = useCallback(() => {
    Alert.alert('Archive note?', 'You can restore it from the web app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          try {
            await archiveNote(note._id);
            navigation.goBack();
          } catch (err) {
            toast(errorMessage(err, 'Could not archive note'), 'error');
          }
        },
      },
    ]);
  }, [note?._id, navigation]);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={note?._id ? (canEdit ? 'Edit note' : 'Note') : 'New note'}
        subtitle={note?.owner?.username ? `by ${note.owner.username}` : undefined}
        onBack={back}
        right={canEdit ? (
          <View style={s.actions}>
            {note?._id ? <TouchableOpacity onPress={archive} style={s.ghost}><Text style={s.ghostText}>Archive</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn}>
              {saving ? <ActivityIndicator color={T.bgBase} size="small" /> : <Text style={s.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <TextInput
          style={s.title}
          placeholder="Title"
          placeholderTextColor={T.textMuted}
          value={title}
          onChangeText={setTitle}
          editable={canEdit}
        />
        <TextInput
          style={s.content}
          placeholder="Start writing…"
          placeholderTextColor={T.textMuted}
          value={content}
          onChangeText={setContent}
          editable={canEdit}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  body: { padding: 16 },
  title: { color: T.textPrimary, fontSize: 20, fontWeight: '700', paddingVertical: 8 },
  content: { color: T.textPrimary, fontSize: 15, lineHeight: 22, minHeight: 300, paddingVertical: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { paddingHorizontal: 8, paddingVertical: 5 },
  ghostText: { color: T.textSecondary, fontSize: 12 },
  saveBtn: { backgroundColor: T.accent, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 6, minWidth: 56, alignItems: 'center' },
  saveText: { color: T.bgBase, fontWeight: '700', fontSize: 12 },
});
