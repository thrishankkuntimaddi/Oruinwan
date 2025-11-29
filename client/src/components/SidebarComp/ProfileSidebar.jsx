import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
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
        value={value}
        onChange={onChange}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-10"
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
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const { showToast } = useToast();

  const [view, setView] = useState("menu"); // menu, profile, security, preferences
  const [formData, setFormData] = useState({ ...user });
  const [status, setStatus] = useState("active"); // active, away, dnd

  // Email State
  const [emails, setEmails] = useState([
    { id: 1, email: user?.email || "user@example.com", verified: true, primary: true }
  ]);
  const [newEmail, setNewEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("+1");

  // Password State
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  // Mock Sessions State
  const [sessions, setSessions] = useState([
    { id: 1, device: "MacBook Pro", os: "macOS", location: "San Francisco, US", current: true, lastActive: "Now", type: "laptop" },
    { id: 2, device: "iPhone 13", os: "iOS", location: "San Francisco, US", current: false, lastActive: "2h ago", type: "mobile" },
    { id: 3, device: "Windows PC", os: "Windows", location: "New York, US", current: false, lastActive: "1d ago", type: "desktop" },
  ]);

  const handleLogoutSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    showToast("Session logged out successfully.", "success");
  };

  const handleLogoutAllSessions = () => {
    setSessions(prev => prev.filter(s => s.current));
    showToast("Logged out of all other devices.", "success");
  };

  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
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

    try {
      await updateProfile(formData);
      showToast("Profile updated successfully!", "success");
      setView("menu");
    } catch (err) {
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

  const handleAddEmail = () => {
    if (!newEmail) return;
    if (!newEmail.includes("@")) return showToast("Invalid email address", "error");

    const emailObj = { id: Date.now(), email: newEmail, verified: false, primary: false };
    setEmails([...emails, emailObj]);
    setNewEmail("");
    showToast("Email added. Please verify it.", "info");
  };

  const handleVerifyEmail = (id) => {
    setEmails(emails.map(e => e.id === id ? { ...e, verified: true } : e));
    showToast("Email verified successfully!", "success");
  };

  const handleMakePrimary = (id) => {
    setEmails(emails.map(e => ({ ...e, primary: e.id === id })));
    showToast("Primary email updated.", "success");
  };

  const handleDeleteEmail = (id) => {
    setEmails(emails.filter(e => e.id !== id));
    showToast("Email removed.", "success");
  };

  // --- SUB-COMPONENTS ---

  const renderMainMenu = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <div
          onClick={() => setView("profile")}
          className="flex items-center gap-3 mb-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-gray-300 bg-cover bg-center shadow-sm border-2 border-white group-hover:border-blue-100 transition-colors flex-shrink-0" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 text-base truncate group-hover:text-blue-600 transition-colors">{user?.username}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("active"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "active" ? "bg-green-50 text-green-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div> Active
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("away"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "away" ? "bg-yellow-50 text-yellow-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></div> Away
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("dnd"); }}
            className={`flex-1 flex items-center justify-center py-1.5 rounded-md text-[10px] font-bold transition-all ${status === "dnd" ? "bg-red-50 text-red-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1.5"></div> DND
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-2 space-y-1">
        <button onClick={() => setView("preferences")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <Settings size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Preferences</span>
        </button>
        <button onClick={() => setView("security")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <Shield size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Security</span>
        </button>
        <button onClick={() => setView("help")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <HelpCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Help & Support</span>
        </button>

        <div className="border-t border-gray-100 my-2 mx-2"></div>

        <button onClick={handleLogout} className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center transition-colors group">
          <LogOut size={18} className="mr-3 group-hover:scale-110 transition-transform" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  const renderProfileView = () => (
    <div className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Edit Profile</span>
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
            <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Phone</label>
              <div className="flex">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="border border-r-0 border-gray-300 rounded-l-lg px-2 py-2 text-sm bg-gray-50 text-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
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
                  className="w-full border border-gray-300 rounded-r-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
                <div key={email.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">{email.email}</span>
                      {!email.primary && (
                        <button onClick={() => handleDeleteEmail(email.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-1">
                      {email.verified ? (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                          <CheckCircle2 size={10} className="mr-1" /> Verified
                        </span>
                      ) : (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-200">
                          <AlertCircle size={10} className="mr-1" /> Unverified
                        </span>
                      )}
                      {email.primary && (
                        <span className="flex-shrink-0 flex items-center text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                          Primary
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1 border-t border-gray-200/50">
                      {!email.verified && (
                        <button onClick={() => handleVerifyEmail(email.id)} className="text-[10px] font-bold text-blue-600 hover:underline">Verify Now</button>
                      )}
                      {email.verified && !email.primary && (
                        <button onClick={() => handleMakePrimary(email.id)} className="text-[10px] font-bold text-gray-600 hover:text-gray-900 hover:underline">Set as Primary</button>
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
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button onClick={handleAddEmail} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">About</label>
            <textarea value={formData.about || ""} onChange={e => setFormData({ ...formData, about: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" rows="3" placeholder="Tell us a bit about yourself..." />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
        <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all">Save Changes</button>
      </div>
    </div>
  );

  const renderPreferencesView = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Preferences</span>
        <div className="w-8"></div>
      </div>
      <div className="p-5 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-gray-900 mb-3">Appearance</h4>
          <div className="grid grid-cols-3 gap-3">
            <button className="p-2 border-2 border-blue-500 bg-blue-50 rounded-xl flex flex-col items-center transition-all">
              <Sun size={20} className="text-blue-600 mb-2" />
              <span className="text-[10px] font-bold text-blue-700">Light</span>
            </button>
            <button className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl flex flex-col items-center transition-all">
              <Moon size={20} className="text-gray-600 mb-2" />
              <span className="text-[10px] font-bold text-gray-600">Dark</span>
            </button>
            <button className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl flex flex-col items-center transition-all">
              <MonitorIcon size={20} className="text-gray-600 mb-2" />
              <span className="text-[10px] font-bold text-gray-600">Auto</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-gray-900 mb-3">Notifications</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Desktop Notifications</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Email Digest</span>
              <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Sound Effects</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityView = () => (
    <div className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in max-h-[80vh]">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Security</span>
        <div className="w-8"></div>
      </div>

      <div className="p-5 overflow-y-auto custom-scrollbar space-y-8">
        {/* Password Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Key size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Password</h4>
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
            <div className="mt-3 grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className={`text-[10px] flex items-center font-medium ${passData.new.length >= 8 ? "text-green-600" : "text-gray-400"}`}>
                <span className="mr-1.5">{passData.new.length >= 8 ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300"></div>}</span> 8+ chars
              </div>
              <div className={`text-[10px] flex items-center font-medium ${/[A-Z]/.test(passData.new) ? "text-green-600" : "text-gray-400"}`}>
                <span className="mr-1.5">{/[A-Z]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300"></div>}</span> Uppercase
              </div>
              <div className={`text-[10px] flex items-center font-medium ${/\d/.test(passData.new) ? "text-green-600" : "text-gray-400"}`}>
                <span className="mr-1.5">{/\d/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300"></div>}</span> Number
              </div>
              <div className={`text-[10px] flex items-center font-medium ${/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? "text-green-600" : "text-gray-400"}`}>
                <span className="mr-1.5">{/[!@#$%^&*(),.?":{}|<>]/.test(passData.new) ? <Check size={10} /> : <div className="w-2.5 h-2.5 rounded-full border border-gray-300"></div>}</span> Special
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

          <button onClick={handleSavePassword} className="w-full bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all">Update Password</button>
        </div>

        {/* 2FA Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Shield size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Two-Factor Authentication</h4>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-bold text-gray-900">Enable 2FA</div>
              <div className="text-xs text-gray-500">Add an extra layer of security</div>
            </div>
            <button className="bg-gray-200 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
            </button>
          </div>
        </div>

        {/* Active Sessions Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Laptop size={16} className="text-gray-400" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Logged-in Devices</h4>
          </div>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-start justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200 text-gray-500">
                    {session.type === 'laptop' ? <Laptop size={18} /> : session.type === 'mobile' ? <Smartphone size={18} /> : <Monitor size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{session.device}</span>
                      {session.current && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Current</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{session.location} • {session.lastActive}</div>
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
              className="w-full border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
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
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Help & Support</span>
        <div className="w-8"></div>
      </div>
      <div className="p-2 space-y-1">
        <button onClick={() => setView("help_academy")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <BookOpen size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Academy</span>
        </button>
        <button onClick={() => setView("help_shortcuts")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <Command size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Keyboard Shortcuts</span>
        </button>
        <button onClick={() => setView("help_bug")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <Bug size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Report a Bug</span>
        </button>
        <button onClick={() => setView("help_whatsnew")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <Sparkles size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">What's New</span>
        </button>
        <button onClick={() => setView("help_contact")} className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center transition-colors group">
          <MessageCircle size={18} className="mr-3 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="font-medium">Contact Support</span>
        </button>
      </div>
    </div>
  );

  // Sub-views for Help (Academy, Shortcuts, etc.) - Simplified for brevity but keeping structure
  const renderHelpAcademy = () => (
    <div className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Academy</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 overflow-y-auto space-y-2">
        {["Getting Started", "Power User Tips", "Workspace Mgmt", "Integrations"].map((guide, i) => (
          <div key={i} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <h3 className="font-bold text-sm text-gray-800">{guide}</h3>
            <p className="text-xs text-gray-500 mt-1">Read guide →</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHelpShortcuts = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Shortcuts</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-2">
        {[
          { label: "Quick Search", keys: "Cmd+K" },
          { label: "New Message", keys: "Cmd+N" },
          { label: "Toggle AI", keys: "Cmd+J" },
          { label: "Close", keys: "Esc" }
        ].map((item, i) => (
          <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{item.label}</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-500 border border-gray-200">{item.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHelpBug = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Report Bug</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 h-32" placeholder="Describe the issue..." />
        <button className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-red-700 transition-all">Submit Report</button>
      </div>
    </div>
  );

  const renderHelpWhatsNew = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">What's New</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-4">
        <div className="pl-4 border-l-2 border-pink-500 relative">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-pink-500"></div>
          <div className="text-[10px] font-bold text-pink-500">NOV 2025</div>
          <div className="text-sm font-bold text-gray-900">Chttrix AI 2.0</div>
          <div className="text-xs text-gray-500 leading-relaxed mt-1">Smarter responses & context awareness.</div>
        </div>
        <div className="pl-4 border-l-2 border-orange-500 relative">
          <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-orange-500"></div>
          <div className="text-[10px] font-bold text-orange-500">OCT 2025</div>
          <div className="text-sm font-bold text-gray-900">Dark Mode</div>
          <div className="text-xs text-gray-500 leading-relaxed mt-1">Easy on the eyes.</div>
        </div>
      </div>
    </div>
  );

  const renderHelpContact = () => (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-bold transition-colors">
          <ChevronLeft size={14} className="mr-1" /> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Contact</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option>General Inquiry</option>
          <option>Billing</option>
          <option>Support</option>
        </select>
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24" placeholder="Message..." />
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
    </>
  );
};

export default ProfileMenu;
