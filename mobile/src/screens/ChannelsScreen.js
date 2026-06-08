import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, Pressable
} from 'react-native';
import { fetchWorkspaceChannels, fetchChannelMessages, fetchChannelJumpAnchor } from '../services/api';
import {
  connectSocket, joinChannel, leaveChannel,
  socketSendMessage, markRead, sendTyping, addReaction,
} from '../services/socket';
import { cacheGet, cacheSet } from '../services/storage';
import { useApp } from '../context/AppContext';

const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function groupMessagesWithSeparators(messagesList) {
  const list = [];
  let lastDateStr = null;
  messagesList.forEach((msg) => {
    if (!msg.createdAt) return;
    const date = new Date(msg.createdAt);
    if (isNaN(date.getTime())) return;
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (dateStr !== lastDateStr) {
      list.push({
        _id: `date-divider-${dateStr}`,
        type: 'date-divider',
        dateStr,
        rawDate: msg.createdAt,
      });
      lastDateStr = dateStr;
    }
    list.push(msg);
  });
  return list;
}

export default function ChannelsScreen() {
  const { workspace, user } = useApp();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [typingUser, setTypingUser] = useState(null);

  // Pagination states
  const [hasMore, setHasMore] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [channelJoinedAt, setChannelJoinedAt] = useState(null);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  // Highlighting and Custom Toast states
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const isJumpingRef = useRef(false);

  const minDate = useMemo(() => {
    const chCreated = activeChannel?.createdAt ? new Date(activeChannel.createdAt) : new Date();
    if (channelJoinedAt) {
      const joined = new Date(channelJoinedAt);
      return joined > chCreated ? joined : chCreated;
    }
    return chCreated;
  }, [activeChannel?.createdAt, channelJoinedAt]);

  const maxDate = useMemo(() => {
    return new Date();
  }, []);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const blanks = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < blanks; i++) {
      days.push({ id: `blank-${i}`, isBlank: true });
    }
    
    const minDayMidnight = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime();
    const maxDayMidnight = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime();
    
    for (let d = 1; d <= totalDays; d++) {
      const dayDate = new Date(year, month, d);
      const dayTime = dayDate.getTime();
      const isDisabled = dayTime < minDayMidnight || dayTime > maxDayMidnight;
      
      days.push({
        id: `day-${d}`,
        dayNum: d,
        date: dayDate,
        isDisabled,
      });
    }
    return days;
  }, [viewDate, minDate, maxDate]);

  const isPrevMonthDisabled = useMemo(() => {
    const viewMonthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    return viewMonthStart <= minMonthStart;
  }, [viewDate, minDate]);

  const isNextMonthDisabled = useMemo(() => {
    const viewMonthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    return viewMonthStart >= maxMonthStart;
  }, [viewDate, maxDate]);

  const handlePrevMonth = () => {
    setViewDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      const minMonthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      if (newDate < minMonthStart) return prev;
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setViewDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      if (newDate > maxMonthStart) return prev;
      return newDate;
    });
  };

  const handleOpenDatePicker = (initialDateStr) => {
    const initialDate = initialDateStr ? new Date(initialDateStr) : new Date();
    setViewDate(initialDate);
    setShowDatePicker(true);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  const scrollToMessage = (msgId, msgsList) => {
    const listToSearch = msgsList || messages;
    const grouped = groupMessagesWithSeparators(listToSearch);
    const index = grouped.findIndex((item) => item._id === msgId);
    if (index !== -1) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (err) {
          try {
            flatListRef.current?.scrollToOffset({
              offset: index * 90,
              animated: true,
            });
          } catch (_) {}
        }
      }, 150);
    }
  };

  const handleDateSelect = async (selectedDate) => {
    setShowDatePicker(false);
    if (!selectedDate || !activeChannel) return;

    isJumpingRef.current = true;
    
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
    const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString();

    try {
      const res = await fetchChannelJumpAnchor(activeChannel._id, dayStart, dayEnd);
      const { anchorMessageId, isFallback } = res.data;

      if (anchorMessageId) {
        const freshMsgs = await loadChannelMessages(activeChannel._id, { around: anchorMessageId });
        
        setHighlightedMessageId(anchorMessageId);
        setTimeout(() => {
          setHighlightedMessageId(null);
        }, 3000);

        scrollToMessage(anchorMessageId, freshMsgs);

        if (isFallback) {
          showToast('No messages found on selected date. Showing nearest conversation.');
        }
      }
    } catch (err) {
      console.warn('[ChannelsScreen] handleDateSelect error:', err.message);
    }
  };

  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  const activeChannelRef = useRef(null);
  const typingTimerRef = useRef(null);

  
  useEffect(() => {
    if (!workspace?._id) return;
    setChannels([]);
    setLoadingChannels(true);
    loadChannels();
  }, [workspace?._id]);

  
  useEffect(() => {
    if (!activeChannel) return;
    activeChannelRef.current = activeChannel;
    setMessages([]);
    setHasMore(false);
    setHasMoreNewer(false);
    setChannelJoinedAt(null);
    isJumpingRef.current = false;
    loadChannelMessages(activeChannel._id);
    setupChannelSocket(activeChannel._id);
    return () => teardownChannelSocket(activeChannel._id);
  }, [activeChannel?._id]);

  
  async function loadChannels() {
    try {
      const cacheKey = `channels_${workspace._id}`;
      const cached = await cacheGet(cacheKey);
      if (cached) setChannels(cached);
      const { data } = await fetchWorkspaceChannels(workspace._id);
      const list = data.channels || data || [];
      setChannels(list);
      await cacheSet(cacheKey, list);
    } catch (err) {
      console.warn('[ChannelsScreen] loadChannels:', err.message);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function loadChannelMessages(channelId, opts = {}) {
    try {
      const cacheKey = `ch_msgs_${channelId}`;
      if (!opts.around && !opts.before && !opts.after) {
        const cached = await cacheGet(cacheKey);
        if (cached) setMessages(cached);
      }
      const { data } = await fetchChannelMessages(channelId, opts);
      const msgs = data.messages || data || [];
      setMessages(msgs);
      setHasMore(data.hasMore || false);
      setHasMoreNewer(data.hasMoreNewer || false);
      if (data.userJoinedAt) {
        setChannelJoinedAt(data.userJoinedAt);
      }
      if (!opts.around && !opts.before && !opts.after) {
        await cacheSet(cacheKey, msgs);
      }
    } catch (err) {
      console.warn('[ChannelsScreen] loadMessages:', err.message);
    }
  }

  async function loadOlderChannelMessages() {
    if (loadingMore || !hasMore || !activeChannel) return;
    setLoadingMore(true);
    try {
      const oldestMsg = messages[0];
      if (!oldestMsg) return;
      const { data } = await fetchChannelMessages(activeChannel._id, {
        before: oldestMsg._id,
        limit: 50
      });
      const newMsgs = data.messages || [];
      setMessages((prev) => [...newMsgs, ...prev]);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.warn('[ChannelsScreen] loadOlderMessages:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadNewerChannelMessages() {
    if (loadingMore || !hasMoreNewer || !activeChannel) return;
    setLoadingMore(true);
    try {
      const newestMsg = messages[messages.length - 1];
      if (!newestMsg) return;
      const { data } = await fetchChannelMessages(activeChannel._id, {
        after: newestMsg._id,
        limit: 50
      });
      const newMsgs = data.messages || [];
      setMessages((prev) => [...prev, ...newMsgs]);
      setHasMoreNewer(data.hasMoreNewer || false);
    } catch (err) {
      console.warn('[ChannelsScreen] loadNewerMessages:', err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function setupChannelSocket(channelId) {
    try {
      const s = await connectSocket();
      socketRef.current = s;

      
      joinChannel(channelId, (ack) => {
        if (ack?.error) {
          console.warn('[ChannelsScreen] chat:join rejected:', ack.error);
        }
      });

      
      markRead('channel', channelId);

      s.on('new-message', handleNewMessage);
      s.on('message-sent', handleMessageSent);
      s.on('message-deleted', handleMessageDeleted);
      s.on('typing', handleTyping);
      s.on('reaction-added', handleReactionAdded);
      s.on('reaction-removed', handleReactionRemoved);
    } catch (err) {
      console.warn('[ChannelsScreen] socket setup:', err.message);
    }
  }

  function teardownChannelSocket(channelId) {
    const s = socketRef.current;
    if (s) {
      s.off('new-message', handleNewMessage);
      s.off('message-sent', handleMessageSent);
      s.off('message-deleted', handleMessageDeleted);
      s.off('typing', handleTyping);
      s.off('reaction-added', handleReactionAdded);
      s.off('reaction-removed', handleReactionRemoved);
      leaveChannel(channelId);
    }
  }

  

  
  const handleNewMessage = useCallback(({ message }) => {
    if (!message) return;
    const chId = message.channel?._id || message.channel;
    if (chId && chId !== activeChannelRef.current?._id) return;
    setMessages((prev) => {
      
      if (prev.some((m) => m._id === message._id && !m._tempId)) return prev;
      
      return [...prev.filter((m) => m._id !== message._id), message];
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  
  const handleMessageSent = useCallback(({ message, clientTempId }) => {
    if (!message) return;
    setMessages((prev) => {
      const alreadyReal = prev.some((m) => m._id === message._id && !m._tempId);
      if (alreadyReal) {
        
        return prev.filter((m) => m._tempId !== clientTempId);
      }
      return prev.map((m) => (m._tempId === clientTempId ? message : m));
    });
  }, []);

  const handleMessageDeleted = useCallback(({ messageId, isLocal, isUniversal, deletedByName }) => {
    if (isLocal) {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } else if (isUniversal) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeletedUniversally: true, deletedByName, text: `Deleted by ${deletedByName}` }
            : m
        )
      );
    }
  }, []);

  const handleTyping = useCallback(({ from, fromName }) => {
    if (from === user?._id) return;
    setTypingUser(fromName || 'Someone');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
  }, [user?._id]);

  const handleReactionAdded = useCallback(({ messageId, reactions }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
    );
  }, []);

  const handleReactionRemoved = useCallback(({ messageId, reactions }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
    );
  }, []);

  
  function handleSend() {
    if (!text.trim() || !activeChannel || !workspace?._id) return;
    const draft = text.trim();
    const clientTempId = tempId();
    setText('');

    
    const optimistic = {
      _id: clientTempId,
      _tempId: clientTempId,
      text: draft,
      sender: { _id: user?._id, username: user?.username },
      channel: activeChannel._id,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    socketSendMessage({
      channelId: activeChannel._id,
      workspaceId: workspace._id,
      text: draft,
      clientTempId,
    });
  }

  function handleTypingInput(val) {
    setText(val);
    if (val && activeChannel) {
      sendTyping({ channelId: activeChannel._id });
    }
  }

  function handleBackToList() {
    setActiveChannel(null);
    setMessages([]);
    setText('');
    setTypingUser(null);
  }

  
  if (!workspace) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyIcon}>🏢</Text>
        <Text style={styles.emptyTitle}>No workspace selected</Text>
        <Text style={styles.emptyBody}>Go to Home to select a workspace.</Text>
      </View>
    );
  }

  
  if (!activeChannel) {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <Text style={styles.heading}>Channels</Text>
          <View style={styles.wsBadge}>
            <Text style={styles.wsBadgeText}>{workspace.name}</Text>
          </View>
        </View>

        {loadingChannels ? (
          <ActivityIndicator color="#b8956a" size="large" style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={channels}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.channelItem}
                onPress={() => setActiveChannel(item)}
              >
                <View style={[
                  styles.channelIconWrap,
                  item.type === 'private' && styles.channelIconWrapPrivate,
                ]}>
                  <Text style={styles.channelIconHash}>#</Text>
                </View>
                <View style={styles.channelInfo}>
                  <View style={styles.channelNameRow}>
                    <Text style={styles.channelName}>{item.name}</Text>
                    {item.type === 'private' && <Text style={styles.lockBadge}>🔒</Text>}
                  </View>
                  {!!item.description && (
                    <Text style={styles.channelDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📢</Text>
                <Text style={styles.emptyTitle}>No channels yet</Text>
                <Text style={styles.emptyBody}>
                  Create channels from the web app to get started.
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {}
      <TouchableOpacity onPress={handleBackToList} style={styles.backBar}>
        <Text style={styles.backText}>←</Text>
        <Text style={styles.chatHeader}>#{activeChannel.name}</Text>
        {activeChannel.type === 'private' && (
          <Text style={styles.chatHeaderLock}> 🔒</Text>
        )}
      </TouchableOpacity>

      {}
      <FlatList
        ref={flatListRef}
        data={groupMessagesWithSeparators(messages)}
        keyExtractor={(item) => item._id?.toString() || String(Math.random())}
        renderItem={({ item }) => {
          if (item.type === 'date-divider') {
            return (
              <View style={styles.dateDividerContainer}>
                <TouchableOpacity
                  style={styles.dateDividerPill}
                  onPress={() => handleOpenDatePicker(item.rawDate)}
                >
                  <Text style={styles.dateDividerText}>{item.dateStr}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          if (item.isDeletedUniversally) {
            return (
              <View style={styles.msgRowDeleted}>
                <Text style={styles.msgDeletedText}>🗑 {item.text}</Text>
              </View>
            );
          }
          const senderId = item.sender?._id || item.sender;
          const isOwn = senderId === user?._id;
          const senderName = item.sender?.username || 'User';
          const timeStr = item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          const reactions = item.reactions || [];
          const isHighlighted = item._id === highlightedMessageId;

          return (
            <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
              {!isOwn && (
                <View style={styles.msgAvatar}>
                  <Text style={styles.msgAvatarText}>{senderName[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.msgCol}>
                <View style={[
                  styles.msgBubble, 
                  isOwn && styles.msgBubbleOwn, 
                  item.pending && styles.msgBubblePending,
                  isHighlighted && styles.msgBubbleHighlighted
                ]}>
                  {!isOwn && <Text style={styles.msgSender}>{senderName}</Text>}
                  <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>
                    {item.text || item.content || ''}
                  </Text>
                  {!!timeStr && (
                    <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{timeStr}</Text>
                  )}
                </View>
                {reactions.length > 0 && (
                  <View style={[styles.reactionsRow, isOwn && styles.reactionsRowOwn]}>
                    {reactions.slice(0, 5).map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.reactionChip}
                        onPress={() => addReaction(item._id, r.emoji)}
                      >
                        <Text style={styles.reactionText}>{r.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyBody}>Be the first to post in #{activeChannel.name}</Text>
          </View>
        }
        onContentSizeChange={() => {
          if (!isJumpingRef.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onScroll={(e) => {
          const { contentOffset } = e.nativeEvent;
          if (contentOffset.y <= 50) {
            loadOlderChannelMessages();
          }
        }}
        onEndReached={() => {
          if (hasMoreNewer) {
            loadNewerChannelMessages();
          }
        }}
        onEndReachedThreshold={0.1}
      />

      {}
      {!!typingUser && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingUser} is typing…</Text>
        </View>
      )}

      {}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder={`Message #${activeChannel.name}`}
          placeholderTextColor="#94a3b8"
          value={text}
          onChangeText={handleTypingInput}
          multiline
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>

      {}
      {!!toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jump to Date</Text>
              <TouchableOpacity 
                style={styles.modalCloseBtn} 
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calendarControls}>
              <TouchableOpacity
                disabled={isPrevMonthDisabled}
                onPress={handlePrevMonth}
                style={[styles.calArrowBtn, isPrevMonthDisabled && styles.calArrowBtnDisabled]}
              >
                <Text style={styles.calArrowText}>←</Text>
              </TouchableOpacity>
              
              <Text style={styles.calMonthLabel}>
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </Text>

              <TouchableOpacity
                disabled={isNextMonthDisabled}
                onPress={handleNextMonth}
                style={[styles.calArrowBtn, isNextMonthDisabled && styles.calArrowBtnDisabled]}
              >
                <Text style={styles.calArrowText}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekdaysRow}>
              {weekdayNames.map((day, idx) => (
                <View key={idx} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((item) => {
                if (item.isBlank) {
                  return <View key={item.id} style={styles.dayCellEmpty} />;
                }

                return (
                  <TouchableOpacity
                    key={item.id}
                    disabled={item.isDisabled}
                    onPress={() => handleDateSelect(item.date)}
                    style={[
                      styles.dayCell,
                      item.isDisabled && styles.dayCellDisabled
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      item.isDisabled && styles.dayTextDisabled
                    ]}>
                      {item.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  heading: { color: '#e4e4e4', fontSize: 18, fontWeight: '700' },
  wsBadge: {
    backgroundColor: '#111111', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#222222',
  },
  wsBadgeText: { color: '#b8956a', fontSize: 10, fontWeight: '700' },
  channelItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#191919',
  },
  channelIconWrap: {
    width: 34, height: 34, borderRadius: 4,
    backgroundColor: '#1c1c1c', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: '#383838',
  },
  channelIconWrapPrivate: { borderColor: 'rgba(184,149,106,0.4)' },
  channelIconHash: { color: '#b8956a', fontSize: 16, fontWeight: '800' },
  channelInfo: { flex: 1 },
  channelNameRow: { flexDirection: 'row', alignItems: 'center' },
  channelName: { color: '#e4e4e4', fontSize: 14, fontWeight: '600' },
  lockBadge: { fontSize: 11, marginLeft: 5 },
  channelDesc: { color: '#7a7a7a', fontSize: 12, marginTop: 2 },
  arrow: { color: '#383838', fontSize: 18 },
  backBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#191919',
    backgroundColor: '#0c0c0c',
  },
  backText: { color: '#b8956a', fontSize: 18, marginRight: 10 },
  chatHeader: { color: '#e4e4e4', fontSize: 14, fontWeight: '700' },
  chatHeaderLock: { color: '#7a7a7a', fontSize: 13 },
  msgRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowDeleted: { paddingHorizontal: 20, paddingVertical: 6 },
  msgDeletedText: { color: '#404040', fontSize: 12, fontStyle: 'italic' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 4,
    backgroundColor: '#1c1c1c',
    borderWidth: 1, borderColor: '#383838',
    alignItems: 'center', justifyContent: 'center', marginRight: 8, alignSelf: 'flex-end',
  },
  msgAvatarText: { color: '#7a7a7a', fontSize: 11, fontWeight: '700' },
  msgCol: { maxWidth: '75%' },
  msgBubble: {
    backgroundColor: '#111111', borderRadius: 6,
    borderBottomLeftRadius: 2, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#222222',
  },
  msgBubbleOwn: {
    backgroundColor: 'rgba(184,149,106,0.15)',
    borderColor: 'rgba(184,149,106,0.25)',
    borderBottomLeftRadius: 6, borderBottomRightRadius: 2,
  },
  msgBubblePending: { opacity: 0.5 },
  msgSender: { color: '#b8956a', fontSize: 10, fontWeight: '700', marginBottom: 3 },
  msgText: { color: '#e4e4e4', fontSize: 14, lineHeight: 20 },
  msgTextOwn: { color: '#e4e4e4' },
  msgTime: { color: '#404040', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeOwn: { color: '#7a7a7a' },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  reactionsRowOwn: { justifyContent: 'flex-end' },
  reactionChip: {
    backgroundColor: '#1c1c1c', borderRadius: 4, borderWidth: 1,
    borderColor: '#383838', paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginTop: 2,
  },
  reactionText: { fontSize: 13 },
  typingBar: { paddingHorizontal: 16, paddingVertical: 4 },
  typingText: { color: '#7a7a7a', fontSize: 11, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row', padding: 10,
    borderTopWidth: 1, borderTopColor: '#191919', alignItems: 'flex-end',
    backgroundColor: '#0c0c0c',
  },
  textInput: {
    flex: 1, backgroundColor: '#111111', borderRadius: 4,
    borderWidth: 1, borderColor: '#222222',
    paddingHorizontal: 14, paddingVertical: 10,
    color: '#e4e4e4', fontSize: 14, maxHeight: 120,
  },
  sendBtn: {
    marginLeft: 8, backgroundColor: '#b8956a',
    borderRadius: 4, width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendIcon: { color: '#0c0c0c', fontSize: 15 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 14 },
  emptyTitle: { color: '#e4e4e4', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyBody: { color: '#7a7a7a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  dateDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateDividerPill: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateDividerText: {
    color: '#7a7a7a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  msgBubbleHighlighted: {
    backgroundColor: 'rgba(184,149,106,0.18)',
    borderWidth: 1,
    borderColor: '#b8956a',
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#e4e4e4',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222222',
    width: '100%',
    maxWidth: 340,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#e4e4e4',
    fontSize: 14,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    color: '#7a7a7a',
    fontSize: 16,
  },
  calendarControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calArrowBtn: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 4,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calArrowBtnDisabled: {
    opacity: 0.3,
  },
  calArrowText: {
    color: '#b8956a',
    fontSize: 16,
    fontWeight: '700',
  },
  calMonthLabel: {
    color: '#e4e4e4',
    fontSize: 14,
    fontWeight: '600',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    color: '#404040',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginVertical: 2,
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayText: {
    color: '#e4e4e4',
    fontSize: 13,
    fontWeight: '500',
  },
  dayTextDisabled: {
    color: '#404040',
  },
});

