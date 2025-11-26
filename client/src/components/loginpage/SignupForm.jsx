import { useState } from 'react';
import { useToast } from "../../contexts/ToastContext";
import { Eye, EyeOff } from "lucide-react";

const SignupForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { showToast } = useToast();

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Password Rules
  const passwordRules = {
    length: formData.password.length >= 8 && formData.password.length <= 16,
    upper: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password)
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

  // Validation Logic
  const validate = (name, value) => {
    let error = "";
    switch (name) {
      case "username":
        if (!value.trim()) error = "Username is required";
        else if (value.length < 3) error = "Username must be at least 3 characters";
        break;
      case "email":
        if (!value) error = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Invalid email address";
        break;
      case "phone":
        if (!value) error = "Phone number is required";
        // Allow optional + at start, followed by digits, spaces, or dashes. 
        // We strip non-digits before checking length.
        else {
          const digits = value.replace(/\D/g, '');
          if (digits.length < 10 || digits.length > 15) {
            error = "Invalid phone number (10-15 digits)";
          }
        }
        break;
      case "password":
        // Password strength is handled visually, but we can add error if needed
        if (!value) error = "Password is required";
        break;
      case "confirmPassword":
        if (!value) error = "Confirm Password is required";
        else if (value !== formData.password) error = "Passwords do not match";
        break;
      default:
        break;
    }
    return error;
  };

  // Handle Change with Real-time Validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate immediately if already touched or just validate to clear error
    const error = validate(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));

    // Special case for confirm password to sync with password changes
    if (name === "password") {
      if (formData.confirmPassword && formData.confirmPassword !== value) {
        setErrors(prev => ({ ...prev, confirmPassword: "Passwords do not match" }));
      } else {
        setErrors(prev => ({ ...prev, confirmPassword: "" }));
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validate(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  // Check overall form validity
  const isFormValid =
    Object.values(formData).every(val => val) && // All fields filled
    Object.values(errors).every(err => !err) && // No errors
    isPasswordStrong; // Password meets requirements

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🔵 SIGNUP SUBMIT:", formData);

    // Final validation check
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validate(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0 || !isPasswordStrong) {
      console.log("🔴 Validation Errors:", newErrors);
      setErrors(newErrors);
      setTouched(Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      showToast("Please fix the errors in the form", "error");
      return;
    }

    try {
      console.log("🔵 Sending request to:", `${process.env.REACT_APP_BACKEND_URL}/api/auth/signup`);
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        })
      });

      const data = await res.json();
      console.log("🔵 Response:", data);

      if (!res.ok) throw new Error(data.message || "Signup failed");

      showToast("Signup successful! Please check your email.", "success");
      onSwitch(); // Switch to login
    } catch (err) {
      console.error("🔴 Signup Error:", err);
      // Backend errors (like duplicate email) can be shown as alert or general error
      showToast(err.message, "error");
    }
  };

  // Helper for input classes
  const getInputClass = (fieldName) => {
    const hasError = errors[fieldName] && touched[fieldName];
    return `w-full px-4 py-2.5 rounded-lg border outline-none transition-all text-sm ${hasError
      ? "border-red-500 focus:ring-2 focus:ring-red-200 focus:border-red-500"
      : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      }`;
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Account</h1>
        <p className="text-gray-500 mt-2 text-sm">Join our community of innovators.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Choose a username"
            className={getInputClass("username")}
          />
          {errors.username && touched.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your email"
            className={getInputClass("email")}
          />
          {errors.email && touched.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="+91 9876543210"
            className={getInputClass("phone")}
          />
          {errors.phone && touched.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              name="password"
              type={showPwd ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Create a password"
              className={getInputClass("password")}
            />


            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Strength Meter */}
          {formData.password && (
            <div className="mt-2 transition-all duration-300 ease-in-out">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Strength</span>
                <span className={`font-medium ${strength === 4 ? 'text-green-600' : 'text-gray-600'}`}>
                  {strengthText[strength]}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strengthColor[strength]} transition-all duration-500 ease-out`}
                  style={{ width: `${(strength / 4) * 100}%` }}
                ></div>
              </div>

              {/* Rules Checklist */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div className={`flex items-center transition-colors ${passwordRules.length ? "text-green-600 font-medium" : ""}`}>
                  <span className="mr-1.5">{passwordRules.length ? "✓" : "○"}</span> 8-16 chars
                </div>
                <div className={`flex items-center transition-colors ${passwordRules.upper ? "text-green-600 font-medium" : ""}`}>
                  <span className="mr-1.5">{passwordRules.upper ? "✓" : "○"}</span> Uppercase
                </div>
                <div className={`flex items-center transition-colors ${passwordRules.number ? "text-green-600 font-medium" : ""}`}>
                  <span className="mr-1.5">{passwordRules.number ? "✓" : "○"}</span> Number
                </div>
                <div className={`flex items-center transition-colors ${passwordRules.special ? "text-green-600 font-medium" : ""}`}>
                  <span className="mr-1.5">{passwordRules.special ? "✓" : "○"}</span> Special char
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <input
              name="confirmPassword"
              type={showConfirmPwd ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Retype password"
              className={getInputClass("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && touched.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          className={`w-full py-2.5 rounded-lg text-white font-semibold text-base shadow-md transition-all transform hover:-translate-y-0.5 mt-4 ${isFormValid
            ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
            : "bg-blue-400 hover:bg-blue-500"
            }`}
        >
          Sign Up
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-4 bg-white text-gray-500 text-sm">Already have an account?</span>
        </div>
      </div>

      <p className="text-center text-sm">
        <button onClick={onSwitch} className="text-blue-600 font-semibold hover:underline">
          Log in instead
        </button>
      </p>
    </div>
  );
};

export default SignupForm;
