import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import api from "../../services/api";
import {
  Settings, HelpCircle, LogOut, ChevronLeft, ChevronRight,
  Laptop, Smartphone, Monitor, Plus, Check, Shield, Moon, Sun,
  Monitor as MonitorIcon, AlertCircle, Trash2, Key,
  BookOpen, Command, Bug, Sparkles, MessageCircle, CheckCircle2
} from "lucide-react";

const PasswordInput = ({ label, value, onChange, show, onToggle, placeholder = "" }) => (
  <div className="relative">
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        onChange={onChange}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        {show ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        )}
      </button>
    </div>
  </div>
);

const ProfileMenu = ({ onClose }) => {
  const { user, setUser, updateProfile, updatePassword, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();

  const [view, setView] = useState("menu"); // menu, profile, security, preferences
  const [formData, setFormData] = useState({ ...user });
  const [status, setStatus] = useState("active"); // active, away, dnd

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

      // Also update phoneCode state
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

  // Email State - Load from user.emails array
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState(user?.phoneCode || "+1");

  // Verification Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingEmailId, setVerifyingEmailId] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");

  // Load emails from user object
  useEffect(() => {
    if (user?.emails && user.emails.length > 0) {

      setEmails(user.emails);
    } else if (user?.email) {
      // Fallback: If no emails array, create from primary email

      setEmails([{
        id: 'primary',
        email: user.email,
        verified: user.verified || true,
        isPrimary: true
      }]);
    }
  }, [user]);

  // Password State
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  // Real Sessions State
  const [sessions, setSessions] = useState([]);
  // const [loadingSessions, setLoadingSessions] = useState(false); // Unused for now

  useEffect(() => {
    if (view === "security") {
      fetchSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const fetchSessions = async () => {
    try {
      // setLoadingSessions(true);
      const { data } = await api.get("/api/auth/sessions");

      // Add simple formatting for display if needed, currently backend sends raw date
      // We can format client-side
      const formatted = data.map(s => ({
        ...s,
        lastActive: new Date(s.lastActive).toLocaleDateString() + " " + new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

      setSessions(formatted);
    } catch (err) {
      console.error("Failed to fetch sessions", err);
      showToast("Failed to load sessions", "error");
    } finally {
      // setLoadingSessions(false); 
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

  // Handle status change
  const handleStatusChange = async (newStatus) => {
    try {
      setStatus(newStatus);
      // Optimistically update global user object so UI reflects change immediately
      if (user) {
        setUser({ ...user, userStatus: newStatus });
      }

      await api.patch("/api/users/status", { status: newStatus });
      showToast(`Status updated to ${newStatus.toUpperCase()}`, "success");
    } catch (err) {
      console.error("Status update error:", err);
      showToast("Failed to update status", "error");
      // Revert on error
      setStatus(user?.userStatus || "active");
      if (user) {
        setUser({ ...user, userStatus: user.userStatus || "active" });
      }
    }
  };

  const handleSaveProfile = async () => {
    // Validate Date of Birth
    if (formData.dob) {
      const dob = new Date(formData.dob);
      const today = new Date();
      if (dob > today) {
        return showToast("Date of birth cannot be in the future", "error");
      }
      const minDate = new Date("1900-01-01");
      if (dob < minDate) {
        return showToast("Please enter a valid date of birth (after 1900)", "error");
      }
    }

    // Validate About field
    if (formData.about && formData.about.length > 500) {
      return showToast("About section must be 500 characters or less", "error");
    }

    try {
      // Include phoneCode in the update
      const updateData = {
        ...formData,
        phoneCode
      };

      // Optimistically update global user object
      setUser({ ...user, ...updateData });

      await updateProfile(updateData);
      showToast("Profile updated successfully!", "success");
      setView("menu");
    } catch (err) {
      // Revert on error
      setUser(user);
      showToast(err.message, "error");
    }
  };

  const handleSavePassword = async () => {
    if (passData.new !== passData.confirm) return showToast("Passwords do not match", "error");

    // Password Strength Validation
    if (passData.new.length < 8) return showToast("Password must be at least 8 characters", "error");
    if (!/[A-Z]/.test(passData.new)) return showToast("Password must contain at least one uppercase letter", "error");
    if (!/\d/.test(passData.new)) return showToast("Password must contain at least one number", "error");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(passData.new)) return showToast("Password must contain at least one special character", "error");

    try {
      await updatePassword(passData.old, passData.new);
      showToast("Password updated successfully!", "success");
      setPassData({ old: "", new: "", confirm: "" });
      setView("menu");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail) return;
    if (!newEmail.includes("@")) return showToast("Invalid email address", "error");

    try {
      const { data } = await api.post("/api/auth/me/emails", { email: newEmail });
      setEmails(data.emails);
      setNewEmail("");

      // Show verification modal for the newly added email
      const addedEmail = data.emails[data.emails.length - 1];
      setVerifyingEmailId(addedEmail.id);
      setShowVerifyModal(true);

      showToast("Email added. Please enter the verification code sent to your inbox.", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to add email", "error");
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      return showToast("Please enter a valid 6-digit code", "error");
    }

    try {
      const { data } = await api.post(`/api/auth/me/emails/${verifyingEmailId}/verify`, {
        code: verificationCode
      });

      setEmails(data.emails);
      setShowVerifyModal(false);
      setVerificationCode("");
      setVerifyingEmailId(null);

      showToast("Email verified successfully!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Verification failed", "error");
    }
  };

  const handleResendCode = async (id) => {
    try {
      await api.post(`/api/auth/me/emails/${id}/resend`);
      showToast("Verification code sent. Please check your inbox.", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to resend code", "error");
    }
  };

  const handleMakePrimary = async (id) => {
    try {
      const { data } = await api.put(`/api/auth/me/emails/${id}/primary`);
      setEmails(data.emails);

      // Update user object to reflect new primary email
      const primaryEmail = data.emails.find(e => e.isPrimary);
      if (primaryEmail) {
        setUser({ ...user, email: primaryEmail.email });
      }

      showToast("Primary email updated!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to set primary email", "error");
    }
  };

  const handleDeleteEmail = async (id) => {
    try {
      const { data } = await api.delete(`/api/auth/me/emails/${id}`);
      setEmails(data.emails);
      showToast("Email deleted", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete email", "error");
    }
  };

  // --- SUB-COMPONENTS ---

  const renderMainMenu = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50">
        <div
          onClick={() => setView("profile")}
          className="flex items-center gap-3 mb-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-300 bg-cover bg-center shadow-sm border-2 border-white group-hover:border-blue-100 transition-colors flex-shrink-0" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 dark:text-white text-base truncate group-hover:text-blue-600 transition-colors">{user?.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={(e) => { e.stopPropagation(); handleStatusChange("active"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "active" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div> Active
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleStatusChange("away"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "away" ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          >
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></div> Away
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleStatusChange("dnd"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "dnd" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div> DND
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2 space-y-1">
        <button onClick={() => setView("preferences")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <Settings size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Preferences</span>
        </button>
        <button onClick={() => setView("security")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <Shield size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Security</span>
        </button>
        <button onClick={() => setView("help")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <HelpCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Help & Support</span>
        </button>

        <div className="border-t border-gray-100 my-2 mx-2"></div>

        {/* Admin Dashboard Link (Admin/Owner Only) */}
        {(user?.companyRole === 'admin' || user?.companyRole === 'owner') && (
          <button
            onClick={() => window.location.href = '/admin/company'}
            className="w-full text-left px-3 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center transition-colors group font-semibold"
          >
            <Settings size={18} className="mr-3 group-hover:rotate-90 transition-transform duration-300" />
            <span>Admin Dashboard</span>
          </button>
        )}


        <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center transition-colors group">
          <LogOut size={18} className="mr-3 group-hover:scale-110 transition-transform" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  const renderProfileView = () => (
    <div className="w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
      <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Edit Profile</span>
        <div className="w-8"></div>
      </div>

      <div className="p-4 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
        <div className="flex justify-center">
          <div className="relative group cursor-pointer" onClick={() => showToast("Profile picture upload coming soon!", "info")}>
            <div className="w-20 h-20 rounded-full bg-gray-300 bg-cover bg-center shadow-md border-4 border-white" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-bold">Change</span>
            </div>
            <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-sm hover:bg-blue-700 transition-colors border-2 border-white">
              <Plus size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
            <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={formData.dob || ""}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
                min="1900-01-01"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
              <div className="flex">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg px-2 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                  <option value="+1">+1</option>
                  <option value="+44">+44</option>
                  <option value="+91">+91</option>
                  <option value="+81">+81</option>
                </select>
                <input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-r-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder={
                    phoneCode === "+91" ? "98765 43210" :
                      phoneCode === "+44" ? "7911 123456" :
                        phoneCode === "+81" ? "90-1234-5678" :
                          "123-456-7890"
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email Addresses</label>
            <div className="space-y-3">
              {emails.map(email => (
                <div key={email.id || email._id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.email}</span>
                      {!email.isPrimary && (
                        <button onClick={() => handleDeleteEmail(email.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-1">
                      {email.verified ? (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                          <CheckCircle2 size={10} className="mr-1" /> Verified
                        </span>
                      ) : (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-800">
                          <AlertCircle size={10} className="mr-1" /> Unverified
                        </span>
                      )}
                      {email.isPrimary && (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                      {!email.verified && (
                        <>
                          <button
                            onClick={() => {
                              setVerifyingEmailId(email.id);
                              setShowVerifyModal(true);
                            }}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Verify Now
                          </button>
                          <button
                            onClick={() => handleResendCode(email.id)}
                            className="text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
                          >
                            Resend Code
                          </button>
                        </>
                      )}
                      {email.verified && !email.isPrimary && (
                        <button onClick={() => handleMakePrimary(email.id)} className="text-[10px] font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline">Set as Primary</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Add another email..."
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button onClick={handleAddEmail} className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">About</label>
            <textarea
              value={formData.about || ""}
              onChange={e => setFormData({ ...formData, about: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows="3"
              placeholder="Tell us a bit about yourself..."
              maxLength={500}
            />
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
              {(formData.about || "").length} / 500 characters
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
        <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">Save Changes</button>
      </div>
    </div >
  );

  const renderPreferencesView = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Preferences</span>
        <div className="w-8"></div>
      </div>
      <div className="p-5 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-3">Appearance</h4>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setTheme('light')}
              className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <Sun size={20} className={`mb-2 ${theme === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className={`text-[10px] font-bold ${theme === 'light' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <Moon size={20} className={`mb-2 ${theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Dark</span>
            </button>
            <button
              onClick={() => setTheme('auto')}
              className={`p-2 border-2 rounded-xl flex flex-col items-center transition-all ${theme === 'auto' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <MonitorIcon size={20} className={`mb-2 ${theme === 'auto' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <span className={`text-[10px] font-bold ${theme === 'auto' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>Auto</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-3">Notifications</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Desktop Notifications</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Email Digest</span>
              <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-300">Sound Effects</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityView = () => (
    <div className="w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in max-h-[80vh]">
      <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Security</span>
        <div className="w-8"></div>
      </div>

      <div className="p-5 overflow-y-auto custom-scrollbar space-y-8">
        {/* Password Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <Key size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Password</h4>
          </div>

          <PasswordInput
            label="Current Password"
            value={passData.old}
            onChange={e => setPassData({ ...passData, old: e.target.value })}
            show={showPasswords.old}
            onToggle={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
          />

          <div>
            <PasswordInput
              label="New Password"
              value={passData.new}
              onChange={e => setPassData({ ...passData, new: e.target.value })}
              show={showPasswords.new}
              onToggle={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
            />

            {/* Password Rules Checklist */}
            <div className="mt-3 grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
              <div className={`text-[10px] flex items-center font-medium ${passData.new.length >= 8 ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                <span className="mr-1.5">{passData.new.length >= 8 ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> 8+ chars
              </div>

              <div className={`text-[10px] flex items-center font-medium ${/[A-Z]/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                <span className="mr-1.5">{/[A-Z]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Uppercase
              </div>
              <div className={`text-[10px] flex items-center font-medium ${/\d/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                <span className="mr-1.5">{/\d/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Number
              </div>
              <div className={`text-[10px] flex items-center font-medium ${/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                <span className="mr-1.5">{/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300 dark:border-gray-600"></div>}</span> Special
              </div>
            </div>
          </div>

          <PasswordInput
            label="Confirm New Password"
            value={passData.confirm}
            onChange={e => setPassData({ ...passData, confirm: e.target.value })}
            show={showPasswords.confirm}
            onToggle={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
          />

          <button onClick={handleSavePassword} className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all">Update Password</button>
        </div>

        {/* 2FA Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <Shield size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Two-Factor Authentication</h4>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">Enable 2FA</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Add an extra layer of security</div>
            </div>
            <button className="bg-gray-200 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
            </button>
          </div>
        </div>

        {/* Active Sessions Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            <Laptop size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Logged-in Devices</h4>
          </div>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-start justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300">
                    {session.type === 'laptop' ? <Laptop size={18} /> : session.type === 'mobile' ? <Smartphone size={18} /> : <Monitor size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {session.device}
                        {session.browser && <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">• {session.browser}</span>}
                      </span>
                      {session.current && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">Current</span>}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{session.location} • {session.lastActive}</div>
                  </div>
                </div>
                {!session.current && (
                  <button
                    onClick={() => handleLogoutSession(session.id)}
                    className="text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Log Out
                  </button>
                )}
              </div>
            ))}
          </div>
          {sessions.length > 1 && (
            <button
              onClick={handleLogoutAllSessions}
              className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={14} />
              Log Out All Other Devices
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderHelpView = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Help & Support</span>
        <div className="w-8"></div>
      </div>
      <div className="p-2 space-y-1">
        <button onClick={() => setView("help_academy")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <BookOpen size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Academy</span>
        </button>
        <button onClick={() => setView("help_shortcuts")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <Command size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Keyboard Shortcuts</span>
        </button>
        <button onClick={() => setView("help_bug")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <Bug size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Report a Bug</span>
        </button>
        <button onClick={() => setView("help_whatsnew")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <Sparkles size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">What's New</span>
        </button>
        <button onClick={() => setView("help_contact")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center transition-colors group">
          <MessageCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Contact Support</span>
        </button>
      </div>
    </div>
  );

  // Sub-views for Help
  const renderHelpAcademy = () => (
    <div className="w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Academy</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 overflow-y-auto space-y-2">
        {["Getting Started", "Power User Tips", "Workspace Mgmt", "Integrations"].map((guide, i) => (
          <div key={i} className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">{guide}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Read guide →</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHelpShortcuts = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Shortcuts</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-2">
        {[
          { label: "Quick Search", keys: "Cmd+K" },
          { label: "New Message", keys: "Cmd+N" },
          { label: "Toggle AI", keys: "Cmd+J" },
          { label: "Close", keys: "Esc" }
        ].map((item, i) => (
          <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <span className="text-sm text-gray-600 dark:text-gray-300">{item.label}</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{item.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHelpBug = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Report Bug</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <textarea className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 h-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Describe the issue..." />
        <button className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-700 transition-all">Submit Report</button>
      </div>
    </div>
  );

  const renderHelpWhatsNew = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">What's New</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-4">
        <div className="pl-4 border-l-2 border-pink-500 relative">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
          <div className="text-[10px] font-bold text-pink-500">NOV 2025</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">Chttrix AI 2.0</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">Smarter responses & context awareness.</div>
        </div>
        <div className="pl-4 border-l-2 border-orange-500 relative">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
          <div className="text-[10px] font-bold text-orange-500">OCT 2025</div>
          <div className="text-sm font-bold text-gray-900 dark:text-white">Dark Mode</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">Easy on the eyes.</div>
        </div>
      </div>
    </div>
  );

  const renderHelpContact = () => (
    <div className="w-72 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 dark:text-white text-sm">Contact</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option>General Inquiry</option>
          <option>Billing</option>
          <option>Support</option>
        </select>
        <textarea className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Message..." />
        <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">Send</button>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* Popover Positioned Bottom-Left */}
      <div className="fixed bottom-16 left-16 z-50 animate-fade-in-up">
        {view === "menu" && renderMainMenu()}
        {view === "profile" && renderProfileView()}
        {view === "preferences" && renderPreferencesView()}
        {view === "security" && renderSecurityView()}
        {view === "help" && renderHelpView()}
        {view === "help_academy" && renderHelpAcademy()}
        {view === "help_shortcuts" && renderHelpShortcuts()}
        {view === "help_bug" && renderHelpBug()}
        {view === "help_whatsnew" && renderHelpWhatsNew()}
        {view === "help_contact" && renderHelpContact()}
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
                onClick={handleVerifyEmail}
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
