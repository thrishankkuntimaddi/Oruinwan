import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Platform, RefreshControl, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useApp } from '../context/AppContext';
import { fetchFiles } from '../services/api/files';
import { absoluteUrl, SERVER_ORIGIN } from '../services/config';
import { getAccessTokenSync, refreshSession } from '../services/tokens';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

function sizeLabel(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
function iconFor(mime = '') {
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊';
  return '📄';
}
// The server has no folder type yet; honour an explicit marker if one is added.
const isFolder = (f) => f.mimeType === 'folder' || f.type === 'folder' || !!f.isFolder;

const FileRow = memo(function FileRow({ item, busy, onPress }) {
  const folder = isFolder(item);
  return (
    <TouchableOpacity style={s.item} onPress={() => onPress(item)} disabled={busy}>
      <Text style={s.icon}>{folder ? '📁' : iconFor(item.mimeType)}</Text>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {folder ? 'Folder' : sizeLabel(item.size)}
          {item.createdBy?.username ? ` · ${item.createdBy.username}` : ''}
          {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString()}` : ''}
        </Text>
      </View>
      {busy ? <ActivityIndicator color={T.accent} /> : <Text style={s.arrow}>{folder ? '›' : '↗'}</Text>}
    </TouchableOpacity>
  );
});

async function openFile(file) {
  const url = absoluteUrl(file.url);
  if (!url) throw new Error('This file has no download URL');
  const needsAuth = url.startsWith(SERVER_ORIGIN) && url.includes('/api/');
  if (!needsAuth || Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }
  // Authenticated download → local cache → system share/open sheet.
  const safe = (file.name || 'file').replace(/[^\w.\- ]+/g, '_');
  const dest = `${FileSystem.cacheDirectory}${file._id}_${safe}`;
  const download = () => FileSystem.downloadAsync(url, dest, { headers: { Authorization: `Bearer ${getAccessTokenSync()}`, 'x-client-platform': Platform.OS } });
  let res = await download();
  if (res.status === 401) {
    await refreshSession();
    res = await download();
  }
  if (res.status >= 400) throw new Error(`Download failed (${res.status})`);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(res.uri, { mimeType: file.mimeType, dialogTitle: file.name });
  else toast('Downloaded to app cache', 'success');
}

export default function FilesScreen({ navigation }) {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [stack, setStack] = useState([{ id: null, name: 'Files' }]);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const folder = stack[stack.length - 1];

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await fetchFiles(wsId, { folderId: search.trim() ? undefined : folder.id, search: search.trim() || undefined });
      setFiles((data?.files || []).filter((f) => !f.isDeleted));
    } catch (err) {
      toast(errorMessage(err, 'Could not load files'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId, folder.id, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const onPress = useCallback(async (item) => {
    if (isFolder(item)) {
      setLoading(true);
      setSearch('');
      setStack((prev) => [...prev, { id: item._id, name: item.name }]);
      return;
    }
    setBusyId(item._id);
    try {
      await openFile(item);
    } catch (err) {
      toast(errorMessage(err, 'Could not open file'), 'error');
    } finally {
      setBusyId(null);
    }
  }, []);

  const back = useCallback(() => {
    if (stack.length > 1) {
      setLoading(true);
      setStack((prev) => prev.slice(0, -1));
    } else navigation.goBack();
  }, [stack.length, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = useCallback(({ item }) => <FileRow item={item} busy={busyId === item._id} onPress={onPress} />, [busyId, onPress]);

  return (
    <View style={s.root}>
      <ScreenHeader title={folder.name} subtitle={stack.length > 1 ? stack.map((f) => f.name).join(' / ') : workspace?.name} onBack={back} />
      <TextInput style={s.search} placeholder="Search files" placeholderTextColor={T.textMuted} value={search} onChangeText={setSearch} />
      {loading && !files.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(f) => String(f._id)}
          renderItem={renderItem}
          extraData={busyId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="🗂" title={search ? 'No matching files' : 'This folder is empty'} body="Upload files from the web app." />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  search: {
    margin: 12, backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 9,
    color: T.textPrimary, fontSize: 13, borderWidth: 1, borderColor: T.borderDefault,
  },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  icon: { fontSize: 22, width: 34 },
  info: { flex: 1 },
  name: { color: T.textPrimary, fontSize: 14, fontWeight: '500' },
  meta: { color: T.textSecondary, fontSize: 11, marginTop: 3 },
  arrow: { color: T.accent, fontSize: 16, marginLeft: 8 },
});
