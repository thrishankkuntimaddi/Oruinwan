// src/pages/Home.jsx
import HomeHeader from "../components/HomeHeader";
import MessagePreview from "../components/MessagePreview";
import CalendarWidget from "../components/CalendarWidget";
import PersonalTodoList from "../components/PersonalTodoList";
import SharedTodoList from "../components/SharedTodoList";
import TaskStats from "../components/TaskStats";
import MotivationalQuote from "../components/MotivationalQuote";
import WeatherWidget from "../components/WeatherWidget";
import ClockWidget from "../components/ClockWidget";

const Home = () => {
  return (
    <div className="w-full h-full flex flex-col space-y-6">
      <HomeHeader />
            
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 mt-4">
        {/* Row 1 */}
        <WeatherWidget />
        <ClockWidget />

        {/* Row 4 */}
        <MessagePreview />
        <CalendarWidget />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {/* Row 2 & 3 */}
          <PersonalTodoList />
          <SharedTodoList />
          <TaskStats />
      </div>

      {/* Grid Layout: Responsive 2-column layout */}
      <MotivationalQuote />
      
    </div>
  );
};

export default Home;
