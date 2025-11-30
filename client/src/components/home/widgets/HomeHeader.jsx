const HomeHeader = () => {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h1 className="text-2xl font-bold text-gray-900">Welcome back 👋</h1>
      <p className="text-sm text-gray-500 mt-1">Today is {today}</p>
    </div>
  );
};

export default HomeHeader;
