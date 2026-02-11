import { useState, useEffect } from 'react';
import { useToast } from "../../contexts/ToastContext";
import { Eye, EyeOff, ChevronDown, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { Button, Input } from "../../shared/components/ui";

const SignupForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({});
  const [validationStatus, setValidationStatus] = useState({
    username: 'idle', // idle | checking | available | taken
    email: 'idle',
    phone: 'idle'
  });
  const { showToast } = useToast();

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

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

  // Debounced validation for username
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.username && formData.username.trim().length >= 3) {
        setValidationStatus(prev => ({ ...prev, username: 'checking' }));
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/check-username`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: formData.username })
          });
          const data = await res.json();

          if (data.exists) {
            setErrors(prev => ({ ...prev, username: 'Username already exists' }));
            setValidationStatus(prev => ({ ...prev, username: 'taken' }));
          } else {
            setErrors(prev => ({ ...prev, username: '' }));
            setValidationStatus(prev => ({ ...prev, username: 'available' }));
          }
        } catch (err) {
          setValidationStatus(prev => ({ ...prev, username: 'idle' }));
        }
      } else {
        setValidationStatus(prev => ({ ...prev, username: 'idle' }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username]);

  // Debounced validation for email
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setValidationStatus(prev => ({ ...prev, email: 'checking' }));
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email })
          });
          const data = await res.json();

          if (data.exists) {
            setErrors(prev => ({ ...prev, email: 'Email already registered' }));
            setValidationStatus(prev => ({ ...prev, email: 'taken' }));
          } else {
            setErrors(prev => ({ ...prev, email: '' }));
            setValidationStatus(prev => ({ ...prev, email: 'available' }));
          }
        } catch (err) {
          setValidationStatus(prev => ({ ...prev, email: 'idle' }));
        }
      } else {
        setValidationStatus(prev => ({ ...prev, email: 'idle' }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.email]);

  // Debounced validation for phone
  useEffect(() => {
    const timer = setTimeout(async () => {
      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length === selectedCountry.length) {
        setValidationStatus(prev => ({ ...prev, phone: 'checking' }));
        try {
          const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/check-phone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: formData.phone,
              phoneCode: selectedCountry.dial_code
            })
          });
          const data = await res.json();

          if (data.exists) {
            setErrors(prev => ({ ...prev, phone: 'Phone number already registered' }));
            setValidationStatus(prev => ({ ...prev, phone: 'taken' }));
          } else {
            setErrors(prev => ({ ...prev, phone: '' }));
            setValidationStatus(prev => ({ ...prev, phone: 'available' }));
          }
        } catch (err) {
          setValidationStatus(prev => ({ ...prev, phone: 'idle' }));
        }
      } else {
        setValidationStatus(prev => ({ ...prev, phone: 'idle' }));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.phone, selectedCountry]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user types
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;

    // Basic validation on blur
    if (!value.trim()) {
      setErrors(prev => ({ ...prev, [name]: `${name.charAt(0).toUpperCase() + name.slice(1)} is required` }));
    }
  };

  // Check if passwords match (for border color)
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
  const passwordsDontMatch = formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword;

  const isFormValid =
    formData.username &&
    formData.email &&
    formData.phone &&
    formData.password &&
    formData.confirmPassword &&
    validationStatus.username === 'available' &&
    validationStatus.email === 'available' &&
    validationStatus.phone === 'available' &&
    passwordsMatch &&
    !Object.values(errors).some(err => err);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid) {
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          phoneCode: selectedCountry.dial_code,
          password: formData.password
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Signup failed");

      showToast("Verification link has been sent to your email. Please check your inbox.", "success");
      onSwitch();
    } catch (err) {
      console.error("Signup Error:", err);
      showToast(err.message, "error");
    }
  };

  return (
    <div className="w-full bg-transparent">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Create Account</h2>
        <p className="text-slate-500 dark:text-slate-400">Join our community of innovators today.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Username */}
        <div className="space-y-1">
          <Input
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Choose a username"
            error={errors.username}
            icon={
              validationStatus.username === 'checking' ? <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /> :
                validationStatus.username === 'available' ? <CheckCircle2 className="text-success-500" size={18} /> :
                  validationStatus.username === 'taken' ? <AlertCircle className="text-danger-500" size={18} /> : null
            }
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter your email"
            error={errors.email}
            icon={
              validationStatus.email === 'checking' ? <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /> :
                validationStatus.email === 'available' ? <CheckCircle2 className="text-success-500" size={18} /> :
                  validationStatus.email === 'taken' ? <AlertCircle className="text-danger-500" size={18} /> : null
            }
          />
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">Phone Number</label>
          <div className="flex gap-2">
            {/* Country Selector - Updating logic to match Input styles */}
            <div className="relative w-32">
              <button
                type="button"
                onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 h-10 border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span>{selectedCountry.flag}</span>
                  <span>{selectedCountry.dial_code}</span>
                </span>
                <ChevronDown size={14} className={`transition-transform text-secondary-500 ${showCountryDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showCountryDropdown && (
                <div className="absolute z-50 w-48 mt-1 bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setShowCountryDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary-50 dark:hover:bg-secondary-700 text-left text-sm text-secondary-900 dark:text-secondary-100"
                    >
                      <span>{country.flag}</span>
                      <span className="flex-1">{country.name}</span>
                      <span className="text-secondary-500">{country.dial_code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Input */}
            <div className="relative flex-1">
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={`${selectedCountry.length} digits`}
                className={`
                    block w-full rounded-lg border-secondary-300 bg-white
                    text-secondary-900 shadow-sm
                    focus:border-primary-500 focus:ring-primary-500
                    disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500
                    dark:bg-secondary-800 dark:border-secondary-700 dark:text-white dark:placeholder-secondary-500
                    dark:focus:border-primary-500 dark:focus:ring-primary-500
                    transition-colors duration-200
                    pl-3 py-2 sm:text-sm h-10
                `}
              />
              {validationStatus.phone === 'checking' && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {validationStatus.phone === 'available' && (
                <CheckCircle2 className="absolute right-3 top-2.5 text-success-500" size={18} />
              )}
              {validationStatus.phone === 'taken' && (
                <AlertCircle className="absolute right-3 top-2.5 text-danger-500" size={18} />
              )}
            </div>

          </div>
          {errors.phone && <p className="text-danger-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Password with Hover Tooltip */}
        <div className="space-y-1">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            Password
            <div className="relative group">
              <Info size={14} className="text-slate-400 hover:text-indigo-500 cursor-help transition-colors" />
              {/* Tooltip */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                <p className="font-bold mb-2 text-indigo-300">Password Requirements:</p>
                <ul className="space-y-1 text-slate-300">
                  <li>• 8-16 characters</li>
                  <li>• At least one uppercase letter</li>
                  <li>• At least one lowercase letter</li>
                  <li>• At least one number</li>
                  <li>• At least one special character</li>
                  <li>• No spaces</li>
                </ul>
              </div>
            </div>
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Create a password"
              className="w-full px-4 py-3 pr-10 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 border rounded-lg outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm Password with Border Color Indicator */}
        <div className="space-y-1">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirmPwd ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Confirm your password"
              className={`w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 border-2 rounded-lg outline-none transition-all ${passwordsMatch
                ? 'border-green-500 focus:ring-2 focus:ring-green-200'
                : passwordsDontMatch
                  ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-200 dark:border-slate-700'
                }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!isFormValid}
          className="w-full p-3 font-bold mt-4"
          variant="primary"
          size="lg"
        >
          Create Account
        </Button>

        {/* Already have account */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitch}
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>
      </form >
    </div >
  );
};

export default SignupForm;
