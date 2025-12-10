import { useState } from 'react';
import { useToast } from "../../contexts/ToastContext";
import { Eye, EyeOff, ChevronDown, Check, Building } from "lucide-react";
import { useEffect } from 'react';

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
  const [companyContext, setCompanyContext] = useState(null);

  useEffect(() => {
    const email = formData.email;
    if (email && email.includes("@")) {
      const domain = email.split("@")[1];
      if (domain && domain.includes(".")) {
        const timer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/companies/check-domain?domain=${domain}`);
            if (res.ok) {
              const data = await res.json();
              setCompanyContext(data.company);
            } else {
              setCompanyContext(null);
            }
          } catch (e) {
            // ignore
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    setCompanyContext(null);
  }, [formData.email]);

  const countries = [
    { code: 'IN', name: 'IND', dial_code: '+91', length: 10, flag: '🇮🇳' },
    { code: 'US', name: 'USA', dial_code: '+1', length: 10, flag: '🇺🇸' },
    { code: 'AE', name: 'UAE', dial_code: '+971', length: 9, flag: '🇦🇪' },
    { code: 'AU', name: 'AUS', dial_code: '+61', length: 9, flag: '🇦🇺' },
    { code: 'GB', name: 'UK', dial_code: '+44', length: 10, flag: '🇬🇧' },
    { code: 'FR', name: 'FRA', dial_code: '+33', length: 9, flag: '🇫🇷' },
    { code: 'CA', name: 'CAN', dial_code: '+1', length: 10, flag: '🇨🇦' },
  ];

  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

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
  const validate = (name, value, country = null) => {
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
        else {
          const digits = value.replace(/\D/g, '');
          const requiredLength = (country || selectedCountry).length;
          if (digits.length !== requiredLength) {
            error = `Phone number must be ${requiredLength} digits`;
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
          phone: `${selectedCountry.dial_code}${formData.phone}`,
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
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
      <div className="text-center mb-5">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Create Account</h1>
        <p className="text-gray-500 mt-1.5 text-xs">Join our community of innovators.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Username */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Choose a username"
            className={getInputClass("username").replace("py-2.5", "py-2").replace("px-4", "px-3")}
          />
          {errors.username && touched.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your email"
            className={getInputClass("email").replace("py-2.5", "py-2").replace("px-4", "px-3")}
          />
          {errors.email && touched.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          {companyContext && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-xs font-medium animate-fade-in">
              <Building size={14} />
              <span>Looks like you're joining {companyContext.name}</span>
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
          <div className="flex gap-2 relative">
            {/* Country Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className={`flex items-center gap-1 px-2 py-2 rounded-lg border bg-white transition-all text-sm shrink-0 ${errors.phone && touched.phone
                  ? "border-red-500"
                  : "border-gray-300 hover:border-blue-500"
                  }`}
              >
                <span className="text-xl leading-none">{selectedCountry.flag}</span>
                <span className="text-gray-700 font-medium ml-1">{selectedCountry.dial_code}</span>
                <ChevronDown size={14} className="text-gray-400 ml-1" />
              </button>

              {showCountryDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCountryDropdown(false)}
                  ></div>
                  <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 max-h-60 overflow-y-auto">
                    {countries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setShowCountryDropdown(false);
                          // Re-validate with new country
                          const error = validate("phone", formData.phone, country);
                          setErrors(prev => ({ ...prev, phone: error }));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left transition-colors"
                      >
                        <span className="text-lg leading-none">{country.flag}</span>
                        <span className="text-sm font-medium text-gray-900">{country.name}</span>
                        <span className="text-xs text-gray-500">{country.dial_code}</span>
                        {selectedCountry.code === country.code && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Phone Input */}
            <div className="flex-1">
              <input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={`${"0".repeat(selectedCountry.length)}`}
                className={getInputClass("phone").replace("py-2.5", "py-2").replace("px-4", "px-3")}
              />
            </div>
          </div>
          {errors.phone && touched.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              name="password"
              type={showPwd ? "text" : "password"}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Create a password"
              className={getInputClass("password").replace("py-2.5", "py-2").replace("px-4", "px-3")}
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
          {formData.password && (
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
              name="confirmPassword"
              type={showConfirmPwd ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Retype password"
              className={getInputClass("confirmPassword").replace("py-2.5", "py-2").replace("px-4", "px-3")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formData.confirmPassword && formData.password === formData.confirmPassword && (
            <div className="flex items-center gap-1 mt-1 text-green-600 text-xs font-medium">
              <Check size={12} />
              <span>Passwords match</span>
            </div>
          )}
          {errors.confirmPassword && touched.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          className={`w-full py-2 rounded-lg text-white font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 mt-2 ${isFormValid
            ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
            : "bg-blue-400 hover:bg-blue-500"
            }`}
        >
          Sign Up
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-4 bg-white text-gray-500 text-xs">Already have an account?</span>
        </div>
      </div>

      <p className="text-center text-xs">
        <button onClick={onSwitch} className="text-blue-600 font-semibold hover:underline">
          Log in instead
        </button>
      </p>
    </div>
  );
};

export default SignupForm;
