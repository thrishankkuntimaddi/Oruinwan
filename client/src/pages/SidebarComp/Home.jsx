// src/pages/Home.jsx
import HomeHeader from "../../components/homewidgets/HomeHeader";
import MessagePreview from "../../components/homewidgets/MessagePreview";
import CalendarWidget from "../../components/homewidgets/CalendarWidget";
import PersonalTodoList from "../../components/homewidgets/PersonalTodoList";
import SharedTodoList from "../../components/homewidgets/SharedTodoList";
import TaskStats from "../../components/homewidgets/TaskStats";
import MotivationalQuote from "../../components/homewidgets/MotivationalQuote";
import WeatherWidget from "../../components/homewidgets/WeatherWidget";
import ClockWidget from "../../components/homewidgets/ClockWidget";

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
