import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";

// Import extracted view components
import MainMenuView from "../profile/views/MainMenuView";
import ProfileView from "../profile/views/ProfileView";
import PreferencesView from "../profile/views/PreferencesView";
import SecurityView from "../profile/views/SecurityView";
import HelpMenuView from "../profile/views/HelpMenuView";

// Import help sub-views
import HelpAcademyView from "../profile/views/help/HelpAcademyView";
import HelpShortcutsView from "../profile/views/help/HelpShortcutsView";
import HelpBugView from "../profile/views/help/HelpBugView";
import HelpWhatsNewView from "../profile/views/help/HelpWhatsNewView";
import HelpContactView from "../profile/views/help/HelpContactView";

// Import modals
import DeleteAccountModal from "../profile/modals/DeleteAccountModal";

const ProfileMenu = ({ onClose }) => {
  const { user, setUser, updateProfile, updatePassword, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  // View state
  const [view, setView] = useState("menu");
  const [formData, setFormData] = useState({ ...user });
  const [status, setStatus] = useState("active");

  // Email state
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState(user?.phoneCode || "+1");

  // Verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingEmailId, setVerifyingEmailId] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");

  // Password state
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  // Security state
  const [sessions, setSessions] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Sync formData with user object changes
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

  // Load user's current status on mount
  useEffect(() => {
    if (user?.userStatus) {
      setStatus(user.userStatus);
    }
  }, [user]);

  // Load emails from user object
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

  // Fetch sessions when navigating to security view
  useEffect(() => {
    if (view === "security") {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // === Handler Functions ===

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

  // === Render ===

  return (
    <>
      {/* Delete Account Modal */}
      <DeleteAccountModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Backdrop to close */}
      <div className="fixed inset-0 z-[90]" onClick={onClose}></div>

      {/* Popover Positioned Bottom-Left */}
      <div className="fixed bottom-16 left-16 z-[100] animate-fade-in-up">
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

      {/* Email Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-96 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Verify Email</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-center text-2xl font-bold tracking-widest focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4"
              maxLength={6}
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerificationCode("");
                  setVerifyingEmailId(null);
                }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyEmailSubmit}
                disabled={verificationCode.length !== 6}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
