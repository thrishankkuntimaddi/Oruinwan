import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import api from '@services/api';

import MainMenuView from "../profile/views/MainMenuView";
import ProfileView from "../profile/views/ProfileView";
import PreferencesView from "../profile/views/PreferencesView";
import SecurityView from "../profile/views/SecurityView";
import HelpMenuView from "../profile/views/HelpMenuView";

import HelpAcademyView from "../profile/views/help/HelpAcademyView";
import HelpShortcutsView from "../profile/views/help/HelpShortcutsView";
import HelpBugView from "../profile/views/help/HelpBugView";
import HelpWhatsNewView from "../profile/views/help/HelpWhatsNewView";
import HelpContactView from "../profile/views/help/HelpContactView";

import DeleteAccountModal from "../profile/modals/DeleteAccountModal";

const ProfileMenu = ({ onClose }) => {
  const { user, setUser, updateProfile, updatePassword, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  
  const [view, setView] = useState("menu");
  const [formData, setFormData] = useState({ ...user });
  const [status, setStatus] = useState("active");

  
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState(user?.phoneCode || "+1");

  
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingEmailId, setVerifyingEmailId] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");

  
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  
  const [sessions, setSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        phone: user.phone,
        phoneCode: user.phoneCode,
        dob: user.profile?.dob ? new Date(user.profile.dob).toISOString().split('T')[0] : "",
        about: user.profile?.about || ""
      });

      if (user.phoneCode) {
        setPhoneCode(user.phoneCode);
      }
    }
  }, [user]);

  
  useEffect(() => {
    if (user?.userStatus) {
      setStatus(user.userStatus);
    }
  }, [user]);

  
  useEffect(() => {
    if (user?.emails && user.emails.length > 0) {
      setEmails(user.emails);
    } else if (user?.email) {
      setEmails([{
        id: 'primary',
        email: user.email,
        verified: user.verified || true,
        isPrimary: true
      }]);
    }
  }, [user]);

  
  useEffect(() => {
    if (view === "security") {
      fetchSessions();
    }
    
  }, [view]);

  

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/api/auth/sessions");
      const formatted = data.map(s => ({
        ...s,
        lastActive: new Date(s.lastActive).toLocaleDateString() + " " + new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setSessions(formatted);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
      showToast("Failed to load sessions", "error");
    }
  };

  const handleLogoutSession = async (id) => {
    try {
      await api.delete(`/api/auth/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      showToast("Session logged out successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to log out session", "error");
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await api.delete("/api/auth/sessions/others");
      setSessions(prev => prev.filter(s => s.current));
      showToast("Logged out of all other devices.", "success");
    } catch (err) {
      console.error("Logout All Error:", err);
      showToast("Failed to log out all devices", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.replace("/");
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setStatus(newStatus);
      setUser({ ...user, userStatus: newStatus });
      await api.patch("/api/users/status", { status: newStatus });
      showToast(`Status changed to ${newStatus.toUpperCase()}`, "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  const handleSaveProfile = async () => {
    try {
      const payload = {
        username: formData.username,
        phone: formData.phone,
        phoneCode: phoneCode,
        profile: {
          dob: formData.dob || null,
          about: formData.about || ""
        }
      };

      const updatedUser = await updateProfile(payload);
      setUser(updatedUser);
      showToast("Profile updated successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to update profile", "error");
    }
  };

  const handleSavePassword = async () => {
    if (passData.new.length < 8) {
      return showToast("Password must be at least 8 characters", "error");
    }
    if (!/[A-Z]/.test(passData.new)) {
      return showToast("Password must have an uppercase letter", "error");
    }
    if (!/\d/.test(passData.new)) {
      return showToast("Password must have a number", "error");
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(passData.new)) {
      return showToast("Password must have a special character", "error");
    }
    if (passData.new !== passData.confirm) {
      return showToast("Passwords do not match", "error");
    }

    const isOAuthUser = user?.authProvider && user.authProvider !== 'local';
    if (!isOAuthUser && !passData.old) {
      return showToast("Please enter your current password", "error");
    }

    try {
      const payload = isOAuthUser
        ? { newPassword: passData.new, confirmPassword: passData.confirm }
        : { currentPassword: passData.old, newPassword: passData.new, confirmPassword: passData.confirm };

      await updatePassword(payload);
      showToast(isOAuthUser ? "Password set successfully!" : "Password updated successfully!", "success");
      setPassData({ old: "", new: "", confirm: "" });
      setShowPasswords({ old: false, new: false, confirm: false });
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to update password", "error");
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
      return showToast("Please enter a valid email", "error");
    }

    try {
      const { data } = await api.post("/api/users/emails", { email: newEmail });
      setEmails([...emails, data.email]);
      setNewEmail("");
      showToast("Verification code sent to your email. Please verify.", "success");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to add email", "error");
    }
  };

  const handleVerifyEmail = (emailId) => {
    setVerifyingEmailId(emailId);
    setShowVerifyModal(true);
  };

  const handleVerifyEmailSubmit = async () => {
    try {
      await api.post(`/api/users/emails/${verifyingEmailId}/verify`, { code: verificationCode });
      setEmails(emails.map(e => e.id === verifyingEmailId ? { ...e, verified: true } : e));
      showToast("Email verified successfully!", "success");
      setShowVerifyModal(false);
      setVerificationCode("");
      setVerifyingEmailId(null);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Verification failed", "error");
    }
  };

  const handleResendCode = async (emailId) => {
    try {
      await api.post(`/api/users/emails/${emailId}/resend`);
      showToast("Verification code resent!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to resend code", "error");
    }
  };

  const handleMakePrimary = async (emailId) => {
    try {
      const { data } = await api.patch(`/api/users/emails/${emailId}/primary`);
      setEmails(emails.map(e => ({ ...e, isPrimary: e.id === emailId })));
      setUser({ ...user, email: data.email });
      showToast("Primary email updated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update primary email", "error");
    }
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      await api.delete(`/api/users/emails/${emailId}`);
      setEmails(emails.filter(e => e.id !== emailId));
      showToast("Email removed", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete email", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      return showToast("Please type DELETE to confirm", "error");
    }

    try {
      await api.delete("/api/users/account");
      showToast("Account deleted successfully", "success");
      await logout();
      window.location.replace("/");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete account", "error");
    }
  };

  

  return (
    <>
      {}
      <DeleteAccountModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        onDeleteAccount={handleDeleteAccount}
      />

      {}
      <div className="fixed inset-0 z-[90]" onClick={onClose}></div>

      {}
      <div style={{ position: 'fixed', bottom: '8px', left: '58px', zIndex: 100 }}>
        {view === "menu" && (
          <MainMenuView
            user={user}
            status={status}
            onStatusChange={handleStatusChange}
            onNavigate={setView}
            onLogout={handleLogout}
          />
        )}
        {view === "profile" && (
          <ProfileView
            user={user}
            formData={formData}
            setFormData={setFormData}
            phoneCode={phoneCode}
            setPhoneCode={setPhoneCode}
            emails={emails}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            onBack={() => setView("menu")}
            onSaveProfile={handleSaveProfile}
            onAddEmail={handleAddEmail}
            onDeleteEmail={handleDeleteEmail}
            onMakePrimary={handleMakePrimary}
            onVerifyEmail={handleVerifyEmail}
            onResendCode={handleResendCode}
          />
        )}
        {view === "preferences" && (
          <PreferencesView
            theme={theme}
            setTheme={setTheme}
            onBack={() => setView("menu")}
          />
        )}
        {view === "security" && (
          <SecurityView
            user={user}
            passData={passData}
            setPassData={setPassData}
            showPasswords={showPasswords}
            setShowPasswords={setShowPasswords}
            sessions={sessions}
            onBack={() => setView("menu")}
            onSavePassword={handleSavePassword}
            onLogoutSession={handleLogoutSession}
            onLogoutAllSessions={handleLogoutAllSessions}
            onDeleteAccount={() => setShowDeleteModal(true)}
          />
        )}
        {view === "help" && (
          <HelpMenuView
            onBack={() => setView("menu")}
            onNavigate={setView}
          />
        )}
        {view === "help_academy" && <HelpAcademyView onBack={() => setView("help")} />}
        {view === "help_shortcuts" && <HelpShortcutsView onBack={() => setView("help")} />}
        {view === "help_bug" && <HelpBugView onBack={() => setView("help")} />}
        {view === "help_whatsnew" && <HelpWhatsNewView onBack={() => setView("help")} />}
        {view === "help_contact" && <HelpContactView onBack={() => setView("help")} />}
      </div>

      {}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.75)', padding: '24px', width: '100%', maxWidth: '384px', margin: '0 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Verify Email</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              Enter the 6-digit verification code sent to your email address.
            </p>

            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
              }}
              placeholder="000000"
              style={{
                width: '100%', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px',
                textAlign: 'center', fontSize: '22px', fontWeight: 700, letterSpacing: '0.25em',
                background: 'var(--bg-hover)', color: 'var(--text-primary)', outline: 'none',
                marginBottom: '16px', boxSizing: 'border-box', fontFamily: 'monospace',
                caretColor: '#b8956a',
              }}
              maxLength={6}
              autoFocus
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerificationCode("");
                  setVerifyingEmailId(null);
                }}
                style={{ flex: 1, padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyEmailSubmit}
                disabled={verificationCode.length !== 6}
                style={{ flex: 1, padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#0c0c0c', background: '#b8956a', border: 'none', cursor: verificationCode.length !== 6 ? 'not-allowed' : 'pointer', opacity: verificationCode.length !== 6 ? 0.4 : 1, fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileMenu;
