
// client/src/pages/LoginPageComp/ResetPassword.jsx
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { Eye, EyeOff, Check } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const token = params.get("token");
  const email = params.get("email");

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Password Rules Logic (Reused from SignupForm)
  const passwordRules = {
    length: newPassword.length >= 8 && newPassword.length <= 16,
    upper: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword)
  };

  const calculateStrength = () => {
    let score = 0;
    if (passwordRules.length) score++;
    if (passwordRules.upper) score++;
    if (passwordRules.number) score++;
    if (passwordRules.special) score++;
    return score;
  };

  const strength = calculateStrength();
  const strengthColor = ["bg-red-500", "bg-red-400", "bg-yellow-400", "bg-yellow-500", "bg-green-500"];
  const strengthText = ["Weak", "Weak", "Fair", "Good", "Strong"];
  const isPasswordStrong = strength === 4;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirm) {
      showToast("Passwords do not match", "error");
      return;
    }
    if (!isPasswordStrong) {
      showToast("Password does not meet requirements", "error");
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password: newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Reset failed");
      }

      showToast("Password reset successful! Please login.", "success");
      navigate("/login");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Reset Password</h1>
          <p className="text-gray-500 mt-1.5 text-xs">Create a new strong password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* New Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Create new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                required
              />


              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {newPassword && (
              <div className="mt-2 transition-all duration-300 ease-in-out">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Strength</span>
                  <span className={`font-medium ${strength === 4 ? 'text-green-600' : 'text-gray-600'}`}>
                    {strengthText[strength]}
                  </span>
                </div>
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${strengthColor[strength]} transition-all duration-500 ease-out`}
                    style={{ width: `${(strength / 4) * 100}%` }}
                  ></div>
                </div>

                {/* Rules Checklist */}
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                  <div className={`flex items-center transition-colors ${passwordRules.length ? "text-green-600 font-medium" : ""}`}>
                    <span className="mr-1">{passwordRules.length ? "✓" : "○"}</span> 8-16 chars
                  </div>
                  <div className={`flex items-center transition-colors ${passwordRules.upper ? "text-green-600 font-medium" : ""}`}>
                    <span className="mr-1">{passwordRules.upper ? "✓" : "○"}</span> Uppercase
                  </div>
                  <div className={`flex items-center transition-colors ${passwordRules.number ? "text-green-600 font-medium" : ""}`}>
                    <span className="mr-1">{passwordRules.number ? "✓" : "○"}</span> Number
                  </div>
                  <div className={`flex items-center transition-colors ${passwordRules.special ? "text-green-600 font-medium" : ""}`}>
                    <span className="mr-1">{passwordRules.special ? "✓" : "○"}</span> Special char
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPwd ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border outline-none transition-all text-sm ${confirm && newPassword !== confirm
                  ? "border-red-500 focus:ring-2 focus:ring-red-200"
                  : "border-gray-300 focus:ring-2 focus:ring-blue-500"
                  }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirm && newPassword === confirm && (
              <div className="flex items-center gap-1 mt-1 text-green-600 text-xs font-medium">
                <Check size={12} />
                <span>Passwords match</span>
              </div>
            )}
            {confirm && newPassword !== confirm && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isPasswordStrong || newPassword !== confirm}
            className={`w-full py-2 rounded-lg text-white font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 mt-2 ${isPasswordStrong && newPassword === confirm
              ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
              : "bg-gray-300 cursor-not-allowed"
              }`}
          >
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}
