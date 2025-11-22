import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../contexts/AuthContext";

const LoginForm = ({ onSwitch }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const isPasswordValid =
    formData.password.length >= 8 && formData.password.length <= 16;

  const isFormValid = formData.email !== "" && isPasswordValid;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    try {
      await login(formData); // <-- FIXED
      alert("Login successful!");
      navigate("/");
    } catch (err) {
      alert(err.message || "Login failed");
    }
  };


  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Chttrix</h2>
        <p className="mt-2 text-sm text-gray-600">
          Sign in to start collaborating on your next big idea.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Email */}
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          required
          className="block w-full px-4 py-2 border border-gray-300 rounded-md"
        />

        {/* Password with show/hide */}
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
            className="block w-full px-4 py-2 border border-gray-300 rounded-md"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2 text-xl"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-2 px-4 rounded-md font-medium text-white 
            ${
              isFormValid
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }
          `}
        >
          Login
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Don't have an account?{" "}
        <button onClick={onSwitch} className="text-blue-600 hover:underline font-medium">
          Sign Up
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
