# Chttrix Communication Spec - Testing Guide

## Overview

This document provides comprehensive testing scenarios for all implemented features of the Chttrix Communication Spec. Use this guide to verify functionality before deployment.

**Test Coverage:**
- ✅ Visual Enhancements (Phase 1)
- ✅ Modal Components (Phase 2)  
- ✅ Header Integration (Phase 3)
- ✅ Message Containers (Phase 4)
- ✅ Thread Panel (Phase 5)
- ✅ Footer Functionality (Phase 6)

---

## Test Environment Setup

### Prerequisites
- ✅ Server running on port 3001
- ✅ Client running on port 3000
- ✅ Active workspace with channels and DMs
- ✅ Multiple test users for collaboration testing

### Test Data Setup

**Required Channels:**
1. **#general** (public channel)
2. **#announcements** (public channel)
3. **#private-team** (private channel)

**Required Messages:**
1. Messages with reactions
2. Messages with threads (at least 3 replies)
3. Pinned messages
4. Messages from different users

**Required Users:**
1. Admin user
2. Regular user
3. Owner user

---

## Phase 1: Visual Enhancements

### Test 1.1: Channel Type Icons

**Test Case:** Verify channel icons display correctly

| Channel Type | Expected Icon | Expected Color |
|--------------|---------------|----------------|
| Public (#general) | `#` | Gray background |
| Private (#private-team) | 🔒 | Blue background |
| Announcements (#announcements) | 📢 | Orange background |

**Steps:**
1. Navigate to each channel type
2. Observe the icon in the header
3. Hover over icon for tooltip

**Expected Results:**
- ✅ Icons match channel type
- ✅ Colors are distinct and appropriate
- ✅ Tooltip shows channel description or type

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 1.2: DM Online/Offline Indicators

**Test Case:** Verify online status indicators in DMs

**Setup:**
1. Open a DM with an online user
2. Open a DM with an offline user

**Steps:**
1. Check avatar for status dot
2. Verify dot color (green = online, gray = offline)
3. Check status text ("Active now" vs "Offline")

**Expected Results:**
- ✅ Green dot appears for online users
- ✅ Gray dot appears for offline users
- ✅ Status text matches online state
- ✅ Dot positioned bottom-right of avatar

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 1.3: Enhanced Status Display

**Test Case:** Verify status messages display correctly

**Channels:**
- Should show member count (e.g., "42 members")

**DMs:**
- Should show custom status if set
- Should show "Active now" if online
- Should show "Offline" if offline

**Expected Results:**
- ✅ Channel member count accurate
- ✅ DM status reflects real-time state
- ✅ Custom status displays when set

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Phase 2: Modal Components

### Test 2.1: ThreadsViewModal

**Test Case:** Filter and display only threaded messages

**Prerequisite:** 
- Channel with at least 5 messages
- At least 2 messages with thread replies

**Steps:**
1. Open any channel with threads
2. Click the 🧵 Threads View button in header
3. Verify only messages with replies appear
4. Search for a keyword
5. Click on a thread to open it
6. Close modal with X or Escape key

**Expected Results:**
- ✅ Modal opens smoothly
- ✅ Only messages with `replyCount > 0` shown
- ✅ Search filters results in real-time
- ✅ Reply count badge displays correctly
- ✅ Last reply time shows
- ✅ Clicking thread opens ThreadPanel
- ✅ Empty state if no threads
- ✅ Modal closes on X or Escape

**Edge Cases:**
- [ ] Channel with 0 threads → Shows empty state
- [ ] Search with no results → Shows "No threads found"
- [ ] Very long thread (50+ replies) → Displays count correctly

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 2.2: MemberListModal

**Test Case:** Display and search channel members

**Setup:**
- Channel with 10+ members
- Mix of online/offline users
- At least 1 admin and 1 owner

**Steps:**
1. Open channel
2. Click menu → "View Members & Info"
3. Verify all members appear
4. Check sorting (online first, then role, then alphabetical)
5. Search for a user by username
6. Search for a user by email
7. Hover over a member to see quick actions
8. Close modal

**Expected Results:**
- ✅ All members listed with avatars
- ✅ Online users appear first
- ✅ Owners have 👑 badge
- ✅ Admins have 🛡️ badge
- ✅ Join dates formatted correctly
- ✅ Search works on username and email
- ✅ Online/offline status accurate
- ✅ Quick actions visible on hover
- ✅ Footer shows correct online count

**Edge Cases:**
- [ ] Member with no profile picture → Shows generated avatar
- [ ] Member who joined today → Shows "Today"
- [ ] Search non-existent user → Shows "No members found"

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 2.3: Enhanced MessageInfoModal

**Test Case:** Display detailed message information

**Setup:**
1. Send a message in a channel
2. Have another user add a reaction
3. Have another user read the message

**Steps:**
1. Right-click message → "Message info"
2. Verify encryption section shows
3. Verify reactions section (if any)
4. Verify "Seen by" list
5. Verify "Delivered to" list
6. Test with your own message
7. Test with someone else's message

**Expected Results:**
- ✅ Encryption status displays correctly
- ✅ Reactions show emoji and user names
- ✅ Read receipts list users who read
- ✅ Delivered list shows unread users
- ✅ Works for all messages (not just own)
- ✅ Profile initials display correctly
- ✅ Modal scrolls if content overflows

**Edge Cases:**
- [ ] Message with no reactions → Section hidden
- [ ] Message everyone has read → "Delivered to" empty
- [ ] Message no one has read → "Seen by" empty

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Phase 3: Header Integration

### Test 3.1: Threads View Button

**Test Case:** Threads button opens modal

**Steps:**
1. Navigate to a channel
2. Locate 🧵 button in header
3. Click button
4. Verify ThreadsViewModal opens

**Expected Results:**
- ✅ Button visible in channels only
- ✅ Button not visible in DMs
- ✅ Hover shows tooltip
- ✅ Clicking opens ThreadsViewModal

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 3.2: Meeting Button

**Test Case:** Meeting button shows placeholder

**Steps:**
1. Navigate to a channel
2. Click 🎥 Meeting button
3. Verify toast notification

**Expected Results:**
- ✅ Button visible in header
- ✅ Clicking shows "Meeting feature coming soon!" toast
- ✅ Toast disappears after 3 seconds

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Phase 4: Message Container Enhancements

### Test 4.1: Message Info in Channels

**Test Case:** Message info available for all messages

**Steps:**
1. Go to any channel
2. Hover over YOUR OWN message
3. Click three dots → "Message info"
4. Close modal
5. Hover over SOMEONE ELSE'S message
6. Click three dots → "Message info"

**Expected Results:**
- ✅ Message info available for own messages
- ✅ Message info available for others' messages
- ✅ Same modal appears for both
- ✅ All sections display correctly

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 4.2: Message Info in DMs

**Test Case:** Message info works in DMs

**Steps:**
1. Open any DM
2. Send a message
3. Click three dots → "Message info"
4. Verify modal displays

**Expected Results:**
- ✅ Message info button visible
- ✅ Modal opens with all sections
- ✅ Encryption status shows
- ✅ Read receipts work in DMs

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Phase 5: Thread Panel

### Test 5.1: Thread Footer Functionality

**Test Case:** Verify footer works in threads

**Setup:**
- Open any thread with a parent message

**Steps:**
1. Click "Reply in thread" on a message
2. Verify footer appears at bottom
3. Test bold formatting button
4. Test italic formatting button
5. Test emoji picker
6. Test file attachment
7. Send a reply
8. Verify reply appears in thread

**Expected Results:**
- ✅ Footer displays correctly
- ✅ All formatting buttons present
- ✅ Emoji picker opens
- ✅ File selector opens
- ✅ Send button enabled when text present
- ✅ Reply posts successfully
- ✅ Optimistic update works

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 5.2: Thread Visual Polish

**Test Case:** Verify thread UI quality

**Steps:**
1. Open a thread
2. Check parent message styling
3. Check separator between parent and replies
4. Scroll through replies
5. Check dark mode

**Expected Results:**
- ✅ Parent message highlighted (blue background)
- ✅ Clear visual separator
- ✅ Replies scroll smoothly
- ✅ Dark mode works correctly

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Phase 6: Footer Component

### Test 6.1: Footer in Channels

**Test Case:** All footer features work in channels

**Steps:**
1. Open a channel
2. Test bold (Ctrl/Cmd + B)
3. Test italic (Ctrl/Cmd + I)
4. Test emoji picker
5. Test file upload
6. Test @ChttrixAI mention
7. Send message with formatting
8. Verify markdown conversion

**Expected Results:**
- ✅ Bold formatting works
- ✅ Italic formatting works
- ✅ Emoji inserts correctly
- ✅ File upload dialog opens
- ✅ @ChttrixAI mention works
- ✅ Enter key sends message
- ✅ Shift+Enter adds new line
- ✅ Markdown sent to backend

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 6.2: Footer in DMs

**Test Case:** Footer works in DMs (no @mentions)

**Steps:**
1. Open a DM
2. Test all formatting options
3. Try typing @ChttrixAI
4. Send message

**Expected Results:**
- ✅ All formatting works
- ✅ @ChttrixAI does NOT trigger (DMs only)
- ✅ Message sends correctly

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 6.3: Footer in Threads

**Test Case:** Footer works in thread replies

**Steps:**
1. Open a thread
2. Test all formatting
3. Send a reply
4. Verify reply appears

**Expected Results:**
- ✅ Formatting toolbar present
- ✅ All options functional
- ✅ Reply posts to thread
- ✅ Not posted to main channel

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Cross-Cutting Tests

### Test 7.1: Dark Mode

**Test Case:** All components work in dark mode

**Steps:**
1. Toggle dark mode in OS/browser
2. Test all modals (Threads, Members, Message Info)
3. Check header icons
4. Check message containers
5. Check footer

**Expected Results:**
- ✅ All text readable
- ✅ All backgrounds appropriate
- ✅ All borders visible
- ✅ No color conflicts
- ✅ Smooth transition

**Areas to Check:**
- [ ] ThreadsViewModal
- [ ] MemberListModal
- [ ] MessageInfoModal
- [ ] Header icons and status
- [ ] Message items
- [ ] Footer input
- [ ] Thread panel

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 7.2: Responsive Design

**Test Case:** UI adapts to different screen sizes

**Screen Sizes to Test:**
- Mobile (375px)
- Tablet (768px)
- Desktop (1440px)

**Steps:**
1. Resize browser window
2. Test each modal at each size
3. Check header layout
4. Check message layout

**Expected Results:**
- ✅ Modals scale appropriately
- ✅ Text doesn't overflow
- ✅ Buttons remain accessible
- ✅ No horizontal scrolling

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 7.3: Keyboard Navigation

**Test Case:** All features accessible via keyboard

**Steps:**
1. Tab through header buttons
2. Use Escape to close modals
3. Use Enter to confirm actions
4. Tab through modal content

**Expected Results:**
- ✅ Focus visible
- ✅ Tab order logical
- ✅ Escape closes modals
- ✅ Enter submits forms
- ✅ No focus traps

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 7.4: Performance

**Test Case:** App remains responsive with load

**Scenarios:**
1. Channel with 1000+ messages
2. Member list with 100+ members
3. 10+ open threads
4. Multiple modals opened/closed rapidly

**Expected Results:**
- ✅ No lag opening modals
- ✅ Search remains instant
- ✅ Scrolling smooth
- ✅ No memory leaks
- ✅ No console errors

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Browser Compatibility

### Test 8.1: Chrome/Edge (Chromium)

**Version:** Latest stable

**Features to Test:**
- [ ] All modals
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] File uploads
- [ ] Copy to clipboard

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 8.2: Firefox

**Version:** Latest stable

**Features to Test:**
- [ ] All modals
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] File uploads
- [ ] Copy to clipboard

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 8.3: Safari

**Version:** Latest stable (macOS)

**Features to Test:**
- [ ] All modals
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] File uploads
- [ ] Copy to clipboard

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Integration Tests

### Test 9.1: Socket Events

**Test Case:** Real-time updates work correctly

**Scenarios:**
1. User A sends message → User B sees it instantly
2. User A adds reaction → User B sees reaction
3. User A joins channel → All users notified
4. User A goes offline → Status updates for all

**Expected Results:**
- ✅ Messages appear in real-time
- ✅ Reactions sync instantly
- ✅ Status updates propagate
- ✅ No duplicate messages

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test 9.2: Optimistic Updates

**Test Case:** UI updates before server confirmation

**Steps:**
1. Send a message (watch it appear immediately)
2. Add a reaction (watch it appear immediately)
3. Pin a message (watch it pin immediately)

**Expected Results:**
- ✅ Immediate UI update
- ✅ Confirmed by server
- ✅ Rollback on failure

**Status:** ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Bug Tracking

Use this section to document any bugs found during testing:

### Bug #1
- **Severity:** High | Medium | Low
- **Component:** [Component name]
- **Description:** [What's broken]
- **Steps to Reproduce:**
  1. Step 1
  2. Step 2
- **Expected:** [What should happen]
- **Actual:** [What actually happens]
- **Status:** Open | Fixed | Won't Fix

---

## Test Summary

**Date:** _____________  
**Tester:** _____________

### Results Summary

| Phase | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Phase 1 | 3 | 0 | 0 | 3 |
| Phase 2 | 3 | 0 | 0 | 3 |
| Phase 3 | 2 | 0 | 0 | 2 |
| Phase 4 | 2 | 0 | 0 | 2 |
| Phase 5 | 2 | 0 | 0 | 2 |
| Phase 6 | 3 | 0 | 0 | 3 |
| Cross-Cutting | 4 | 0 | 0 | 4 |
| Browsers | 3 | 0 | 0 | 3 |
| Integration | 2 | 0 | 0 | 2 |
| **Total** | **24** | **0** | **0** | **24** |

**Overall Pass Rate:** 0% (0/24)

### Critical Issues
- None found

### Recommendations
1. Complete all test scenarios
2. Test in all target browsers
3. Performance test with large datasets
4. Accessibility audit

### Sign-Off

**Approved for Deployment:** ☐ Yes | ☐ No | ☐ With Conditions

**Conditions/Notes:**
_________________________________________________________________
_________________________________________________________________

**Signature:** _________________ **Date:** _____________
