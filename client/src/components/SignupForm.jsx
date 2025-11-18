import { useState } from 'react';

const SignupForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [match, setMatch] = useState(null);

  const passwordRules = {
    length: formData.password.length >= 8 && formData.password.length <= 16,
    upper: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password)
  };

  const isPasswordStrong =
    passwordRules.length &&
    passwordRules.upper &&
    passwordRules.number &&
    passwordRules.special;

  const isAllFilled =
    formData.username &&
    formData.email &&
    formData.phone &&
    formData.password &&
    formData.confirmPassword;

  const isFormValid = isAllFilled && isPasswordStrong && match;

  const shouldShowRules = !isPasswordStrong; // Hide rules when valid

  const handleChange = (e) => {
    const updated = { ...formData, [e.target.name]: e.target.value };
    setFormData(updated);

    if (e.target.name === 'password' || e.target.name === 'confirmPassword') {
      setMatch(updated.password === updated.confirmPassword);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
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
      if (!res.ok) throw new Error(data.message || "Signup failed");

      alert("Signup successful!");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Create your Chttrix Account</h2>
        <p className="mt-2 text-sm text-gray-600">Join our community of innovators.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
          required
          className="block w-full px-4 py-2 border border-gray-300 rounded-md"
        />

        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          required
          className="block w-full px-4 py-2 border border-gray-300 rounded-md"
        />

        <input
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Phone"
          required
          className="block w-full px-4 py-2 border border-gray-300 rounded-md"
        />

        {/* Password field with show/hide */}
        <div className="relative">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            required
            className="block w-full px-4 py-2 border border-gray-300 rounded-md"
          />

          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-2 text-xl"
          >
            {showPwd ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <input
            name="confirmPassword"
            type={showConfirmPwd ? "text" : "password"}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Retype Password"
            required
            className="block w-full px-4 py-2 border border-gray-300 rounded-md"
          />

          <button
            type="button"
            onClick={() => setShowConfirmPwd(!showConfirmPwd)}
            className="absolute right-3 top-2 text-xl"
          >
            {showConfirmPwd ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Password Rules */}
        {shouldShowRules && (
          <div className="text-sm space-y-1">
            <p className={passwordRules.length ? "text-green-600" : "text-red-600"}>
              • 8–16 characters
            </p>
            <p className={passwordRules.upper ? "text-green-600" : "text-red-600"}>
              • At least one uppercase letter
            </p>
            <p className={passwordRules.number ? "text-green-600" : "text-red-600"}>
              • At least one number
            </p>
            <p className={passwordRules.special ? "text-green-600" : "text-red-600"}>
              • At least one special character
            </p>
          </div>
        )}

        {/* Password Match */}
        {match === false && (
          <p className="text-red-600 text-sm">Passwords do not match</p>
        )}
        {match === true && (
          <p className="text-green-600 text-sm">Passwords match ✓</p>
        )}

        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-2 px-4 rounded-md font-medium text-white 
            ${isFormValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}
          `}
        >
          Sign Up
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 hover:underline font-medium">
          Login
        </button>
      </p>
    </div>
  );
};

export default SignupForm;
