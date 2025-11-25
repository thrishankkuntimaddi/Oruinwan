import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

const ProfileMenu = ({ onClose }) => {
  const { user, updateProfile, updatePassword, logout } = useAuth();

  const [view, setView] = useState("menu"); // menu, profile, security, preferences
  const [formData, setFormData] = useState({ ...user });
  const [status, setStatus] = useState("active"); // active, away, dnd

  // Password State
  const [passData, setPassData] = useState({ old: "", new: "", confirm: "" });

  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(formData);
      alert("Profile updated!");
      setView("menu");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSavePassword = async () => {
    if (passData.new !== passData.confirm) return alert("Passwords do not match");
    try {
      await updatePassword(passData.old, passData.new);
      alert("Password updated!");
      setView("menu");
    } catch (err) {
      alert(err.message);
    }
  };

  // --- SUB-COMPONENTS ---

  const MainMenu = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 bg-gray-50/50">
        <div
          onClick={() => setView("profile")}
          className="flex items-center gap-3 mb-2 cursor-pointer p-1.5 -mx-1 rounded-lg hover:bg-white hover:shadow-sm transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-300 bg-cover bg-center shadow-sm border border-white group-hover:border-blue-100 transition-colors flex-shrink-0" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}></div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">{user?.username}</div>
            <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex bg-white rounded-md p-0.5 border border-gray-200 shadow-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("active"); }}
            className={`flex-1 flex items-center justify-center py-1 rounded text-[10px] font-medium transition-all ${status === "active" ? "bg-green-50 text-green-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span> Active
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("away"); }}
            className={`flex-1 flex items-center justify-center py-1 rounded text-[10px] font-medium transition-all ${status === "away" ? "bg-yellow-50 text-yellow-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1"></span> Away
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus("dnd"); }}
            className={`flex-1 flex items-center justify-center py-1 rounded text-[10px] font-medium transition-all ${status === "dnd" ? "bg-red-50 text-red-700 shadow-sm" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></span> DND
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-1.5 space-y-0.5">
        <button onClick={() => setView("preferences")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">⚙️</span>
          <span className="font-medium">Preferences</span>
        </button>
        <button onClick={() => setView("security")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">🔒</span>
          <span className="font-medium">Security</span>
        </button>
        <button onClick={() => setView("help")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">❓</span>
          <span className="font-medium">Help & Support</span>
        </button>

        <div className="border-t border-gray-100 my-1 mx-2"></div>

        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">🚪</span>
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );

  const ProfileView = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[500px] animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Edit Profile</span>
        <div className="w-8"></div>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-full bg-gray-300 bg-cover bg-center shadow-md border-2 border-white relative" style={{ backgroundImage: `url(${user?.profilePicture || "https://ui-avatars.com/api/?name=" + user?.username})` }}>
            <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full shadow-sm hover:bg-blue-700 transition-colors">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
          <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Job Title</label>
          <input type="text" placeholder="e.g. Senior Developer" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
          <input type="text" value={formData.phone || ""} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">About</label>
          <textarea value={formData.about || ""} onChange={e => setFormData({ ...formData, about: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" rows="2" placeholder="Tell us a bit about yourself..." />
        </div>
      </div>

      <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
        <button onClick={handleSaveProfile} className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-blue-700 transition-all">Save</button>
      </div>
    </div>
  );

  const PreferencesView = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Preferences</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-gray-900 mb-2">Appearance</h4>
          <div className="grid grid-cols-3 gap-2">
            <button className="p-1.5 border-2 border-blue-500 bg-blue-50 rounded-md flex flex-col items-center">
              <div className="w-full h-6 bg-white border border-gray-200 rounded-sm mb-1"></div>
              <span className="text-[9px] font-medium text-blue-700">Light</span>
            </button>
            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md flex flex-col items-center">
              <div className="w-full h-6 bg-gray-800 rounded-sm mb-1"></div>
              <span className="text-[9px] font-medium text-gray-600">Dark</span>
            </button>
            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md flex flex-col items-center">
              <div className="w-full h-6 bg-gradient-to-br from-white to-gray-800 rounded-sm mb-1"></div>
              <span className="text-[9px] font-medium text-gray-600">Auto</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-gray-900 mb-2">Notifications</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-700">Desktop Notifications</span>
              <input type="checkbox" defaultChecked className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-700">Email Digest</span>
              <input type="checkbox" className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-700">Sound Effects</span>
              <input type="checkbox" defaultChecked className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const SecurityView = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Security</span>
        <div className="w-8"></div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Current Password</label>
          <input type="password" value={passData.old} onChange={e => setPassData({ ...passData, old: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">New Password</label>
          <input type="password" value={passData.new} onChange={e => setPassData({ ...passData, new: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Confirm Password</label>
          <input type="password" value={passData.confirm} onChange={e => setPassData({ ...passData, confirm: e.target.value })} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>

        <div className="pt-2 border-t border-gray-100 mt-1">
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs font-medium text-gray-900">Two-Factor Auth</div>
              <div className="text-[10px] text-gray-500">Extra security layer</div>
            </div>
            <button className="bg-gray-200 relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <span className="translate-x-0 pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
            </button>
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
        <button onClick={handleSavePassword} className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-blue-700 transition-all">Update</button>
      </div>
    </div>
  );

  const HelpView = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("menu")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Help & Support</span>
        <div className="w-8"></div>
      </div>
      <div className="p-1.5 space-y-0.5">
        <button onClick={() => setView("help_academy")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">🎓</span>
          <span className="font-medium">Academy</span>
        </button>
        <button onClick={() => setView("help_shortcuts")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">⌨️</span>
          <span className="font-medium">Keyboard Shortcuts</span>
        </button>
        <button onClick={() => setView("help_bug")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">🐛</span>
          <span className="font-medium">Report a Bug</span>
        </button>
        <button onClick={() => setView("help_whatsnew")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">✨</span>
          <span className="font-medium">What's New</span>
        </button>
        <button onClick={() => setView("help_contact")} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md flex items-center transition-colors group">
          <span className="mr-2 text-base group-hover:scale-110 transition-transform">📞</span>
          <span className="font-medium">Contact Support</span>
        </button>
      </div>
    </div>
  );

  const HelpAcademy = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[400px] animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Academy</span>
        <div className="w-8"></div>
      </div>
      <div className="p-3 overflow-y-auto space-y-2">
        {["Getting Started", "Power User Tips", "Workspace Mgmt", "Integrations"].map((guide, i) => (
          <div key={i} className="p-2 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <h3 className="font-bold text-xs text-gray-800">{guide}</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Read guide →</p>
          </div>
        ))}
      </div>
    </div>
  );

  const HelpShortcuts = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Shortcuts</span>
        <div className="w-8"></div>
      </div>
      <div className="p-3 space-y-2">
        {[
          { label: "Quick Search", keys: "Cmd+K" },
          { label: "New Message", keys: "Cmd+N" },
          { label: "Toggle AI", keys: "Cmd+J" },
          { label: "Close", keys: "Esc" }
        ].map((item, i) => (
          <div key={i} className="flex justify-between items-center p-1.5 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-600">{item.label}</span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono text-gray-500 border border-gray-200">{item.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );

  const HelpBug = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Report Bug</span>
        <div className="w-8"></div>
      </div>
      <div className="p-3 space-y-3">
        <textarea className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-red-500 focus:border-transparent h-24" placeholder="Describe the issue..." />
        <button className="w-full bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-red-700 transition-all">Submit Report</button>
      </div>
    </div>
  );

  const HelpWhatsNew = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">What's New</span>
        <div className="w-8"></div>
      </div>
      <div className="p-3 space-y-3">
        <div className="pl-3 border-l-2 border-pink-500 relative">
          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-pink-500"></div>
          <div className="text-[10px] font-bold text-pink-500">NOV 2025</div>
          <div className="text-xs font-bold text-gray-900">Chttrix AI 2.0</div>
          <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Smarter responses & context awareness.</div>
        </div>
        <div className="pl-3 border-l-2 border-orange-500 relative">
          <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-orange-500"></div>
          <div className="text-[10px] font-bold text-orange-500">OCT 2025</div>
          <div className="text-xs font-bold text-gray-900">Dark Mode</div>
          <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Easy on the eyes.</div>
        </div>
      </div>
    </div>
  );

  const HelpContact = () => (
    <div className="w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <button onClick={() => setView("help")} className="text-gray-500 hover:text-gray-900 flex items-center text-xs font-medium transition-colors">
          <span className="mr-1">←</span> Back
        </button>
        <span className="font-bold text-gray-900 text-sm">Contact</span>
        <div className="w-8"></div>
      </div>
      <div className="p-3 space-y-3">
        <select className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500">
          <option>General Inquiry</option>
          <option>Billing</option>
          <option>Support</option>
        </select>
        <textarea className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent h-20" placeholder="Message..." />
        <button className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-blue-700 transition-all">Send</button>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* Popover Positioned Bottom-Left */}
      <div className="fixed bottom-16 left-16 z-50 animate-fade-in-up">
        {view === "menu" && <MainMenu />}
        {view === "profile" && <ProfileView />}
        {view === "preferences" && <PreferencesView />}
        {view === "security" && <SecurityView />}
        {view === "help" && <HelpView />}
        {view === "help_academy" && <HelpAcademy />}
        {view === "help_shortcuts" && <HelpShortcuts />}
        {view === "help_bug" && <HelpBug />}
        {view === "help_whatsnew" && <HelpWhatsNew />}
        {view === "help_contact" && <HelpContact />}
      </div>
    </>
  );
};

export default ProfileMenu;
