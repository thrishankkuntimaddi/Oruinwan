// src/components/Header.jsx
import React from "react";

const Header = () => {
  return (
    <header className="flex items-center justify-between border-b border-[#f0f2f5] px-6 md:px-10 py-4">
      {/* Logo and Title */}
      <div className="flex items-center gap-4 text-[#111418]">
        <div className="w-5 h-5">
          {/* SVG Logo */}
          <svg
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-full h-full"
          >
            <path
              d="M13.8261 17.4264C16.7203 18.1174 20.2244 18.5217 24 18.5217C27.7756 18.5217 31.2797 18.1174 34.1739 17.4264C36.9144 16.7722 39.9967 15.2331 41.3563 14.1648L24.8486 40.6391C24.4571 41.267 23.5429 41.267 23.1514 40.6391L6.64374 14.1648C8.00331 15.2331 11.0856 16.7722 13.8261 17.4264Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold tracking-tight leading-none">CollabHub</h2>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex flex-1 justify-end items-center gap-8">
        <div className="flex items-center gap-6">
          {["Home", "Features", "Pricing", "Support"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-[#111418] hover:text-blue-600 transition-colors"
              title={item}
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            className="h-10 px-4 rounded-xl bg-[#0c77f2] text-white text-sm font-bold hover:bg-[#0865d6] focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Register"
          >
            Register
          </button>
          <button
            className="h-10 px-4 rounded-xl bg-[#f0f2f5] text-[#111418] text-sm font-bold hover:bg-[#e3e6ea] focus:outline-none focus:ring-2 focus:ring-gray-300"
            title="Login"
          >
            Login
          </button>
        </div>
      </nav>
    </header>
  );
};

export default Header;
