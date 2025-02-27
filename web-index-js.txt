// Create needed Lucide icons components
const {
  BarChart, 
  Search, 
  FileSpreadsheet,
  Save, 
  BookOpen,
  Users,
  User,
  List,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Upload
} = lucide;

// Import the StudentManagementSystem component
const App = () => {
  return (
    <div className="h-full">
      <StudentManagementSystem />
    </div>
  );
};

// Render the App
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
