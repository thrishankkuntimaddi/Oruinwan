// src/components/WeatherWidget.jsx
import { useEffect, useState } from "react";

const WeatherWidget = () => {
  const [weather, setWeather] = useState({ temp: "--", condition: "Loading..." });

  useEffect(() => {
    // Dummy static data; replace with real API in future
    setWeather({ temp: "29°C", condition: "Sunny" });
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <h2 className="text-lg font-semibold mb-2">Weather</h2>
      <div className="flex items-center gap-4">
        <div className="text-5xl">☀️</div>
        <div>
          <p className="text-xl font-bold">{weather.temp}</p>
          <p className="text-gray-500 text-sm">{weather.condition}</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
