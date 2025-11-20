// src/components/SidebarComp/ProfileSidebar.jsx

import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";   // ✅ AUTH CONTEXT
import { useNavigate } from "react-router-dom";         // ✅ For redirect

const ProfileSidebar = ({ user, onClose, onSave }) => {

  const { logout } = useAuth();  // ✅ Access logout function
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    dob: user.dob || "",
    about: user.about || "",
    company: user.company || "",
    showCompany: user.showCompany ?? true,
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showSecurity, setShowSecurity] = useState(false);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState({
    mismatch: false,
    samePassword: false,
    rulesFailed: false,
  });

  const [isChanged, setIsChanged] = useState(false);

  // Track changes to enable Save button
  useEffect(() => {
    const original = JSON.stringify({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      dob: user.dob || "",
      about: user.about || "",
      company: user.company || "",
      showCompany: user.showCompany ?? true,
    });

    const current = JSON.stringify({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      dob: formData.dob,
      about: formData.about,
      company: formData.company,
      showCompany: formData.showCompany,
    });

    let changed = original !== current;

    if (
      formData.oldPassword ||
      formData.newPassword ||
      formData.confirmPassword
    ) {
      changed = true;
    }

    setIsChanged(changed);
  }, [formData, user]);

  const passwordRules = {
    length: formData.newPassword.length >= 8 && formData.newPassword.length <= 16,
    uppercase: /[A-Z]/.test(formData.newPassword),
    number: /\d/.test(formData.newPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword),
  };

  const isPasswordValid =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.number &&
    passwordRules.special;

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const { oldPassword, newPassword, confirmPassword } = formData;

    setErrors({ mismatch: false, samePassword: false, rulesFailed: false });

    if (!oldPassword && !newPassword && !confirmPassword) {
      onSave(formData);
      onClose();
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      setErrors((prev) => ({ ...prev, mismatch: true }));
      return;
    }

    if (oldPassword === newPassword) {
      setErrors((prev) => ({ ...prev, samePassword: true }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors((prev) => ({ ...prev, mismatch: true }));
      return;
    }

    if (!isPasswordValid) {
      setErrors((prev) => ({ ...prev, rulesFailed: true }));
      return;
    }

    onSave(formData);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await logout();          // Clears refresh token cookie & context
      navigate("/login");      // Redirect to login
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Profile Settings</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-lg">
          ✖
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">

        {/* Name */}
        <div>
          <label className="block font-medium mb-1">Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block font-medium mb-1">Email (read-only)</label>
          <input
            type="email"
            className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-600"
            value={formData.email}
            readOnly
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block font-medium mb-1">Phone Number</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
        </div>

        {/* DOB */}
        <div>
          <label className="block font-medium mb-1">Date of Birth</label>
          <input
            type="date"
            className="w-full px-3 py-2 border rounded"
            value={formData.dob}
            onChange={(e) => handleChange("dob", e.target.value)}
          />
        </div>

        {/* About */}
        <div>
          <label className="block font-medium mb-1">About</label>
          <input
            type="text"
            className="w-full px-3 py-2 border rounded"
            value={formData.about}
            onChange={(e) => handleChange("about", e.target.value)}
          />
        </div>

        {/* Show Company Toggle */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={formData.showCompany}
            onChange={(e) => handleChange("showCompany", e.target.checked)}
          />
          <label className="font-medium">Show Company Field</label>
        </div>

        {/* Company */}
        {formData.showCompany && (
          <div>
            <label className="block font-medium mb-1">Company</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              value={formData.company}
              onChange={(e) => handleChange("company", e.target.value)}
            />
          </div>
        )}

        {/* Security */}
        <div className="pt-4 border-t">
          <button
            className="w-full flex justify-between items-center font-semibold text-gray-800"
            onClick={() => setShowSecurity(!showSecurity)}
          >
            <span>Security</span>
            <span>{showSecurity ? "▲" : "▼"}</span>
          </button>

          {showSecurity && (
            <div className="mt-3 space-y-3">

              {/* Old Password */}
              <div>
                <label className="block font-medium mb-1">Old Password</label>
                <div className="relative">
                  <input
                    type={showOld ? "text" : "password"}
                    className="w-full px-3 py-2 border rounded"
                    value={formData.oldPassword}
                    onChange={(e) => handleChange("oldPassword", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-2 top-2 text-gray-500"
                  >
                    {showOld ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block font-medium mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    className="w-full px-3 py-2 border rounded"
                    value={formData.newPassword}
                    onChange={(e) => handleChange("newPassword", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2 top-2 text-gray-500"
                  >
                    {showNew ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-medium mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    className="w-full px-3 py-2 border rounded"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-2 text-gray-500"
                  >
                    {showConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {errors.samePassword && (
                <p className="text-red-600 text-xs">New password cannot be same as old password.</p>
              )}

              {errors.mismatch && (
                <p className="text-red-600 text-xs">Passwords do not match.</p>
              )}

              {errors.rulesFailed && (
                <div className="text-red-600 text-xs space-y-1">
                  <p>Password must include:</p>
                  <ul className="list-disc pl-5">
                    <li className={!passwordRules.length ? "text-red-600" : "text-green-600"}>8–16 characters</li>
                    <li className={!passwordRules.uppercase ? "text-red-600" : "text-green-600"}>Uppercase letter</li>
                    <li className={!passwordRules.number ? "text-red-600" : "text-green-600"}>Number</li>
                    <li className={!passwordRules.special ? "text-red-600" : "text-green-600"}>Special character</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex flex-col space-y-2">

        {/* Logout Button */}
        <button
          onClick={handleLogout}   // ← Fully integrated logout
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded"
        >
          Logout
        </button>

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-red-500 text-sm font-medium"
          >
            Cancel
          </button>

          <button
            disabled={!isChanged}
            onClick={handleSave}
            className={`px-4 py-2 text-sm rounded text-white 
            ${isChanged ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}`}
          >
            Save Changes
          </button>
        </div>
      </div>

    </div>
  );
};

export default ProfileSidebar;
