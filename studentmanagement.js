import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
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
} from 'lucide-react';

// Map level codes to full names
const levelMapping = {
  'R': 'Rocket',
  'T': 'Top',
  'H': 'High',
  'A': 'Ace',
  'E': 'Elite'
};

// Collapsible Section Component
const CollapsibleSection = ({ title, count, children, isOpen, onToggle, icon }) => {
  return (
    <div className="mb-4">
      <div 
        className="flex items-center justify-between p-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200"
        onClick={onToggle}
      >
        <div className="flex items-center">
          {icon && <span className="mr-2">{icon}</span>}
          <h3 className="font-semibold">{title}</h3>
          {count > 0 && <span className="ml-2 text-sm text-gray-500">({count})</span>}
        </div>
        <span>{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
      </div>
      {isOpen && (
        <div className="mt-2 pl-2">
          {children}
        </div>
      )}
    </div>
  );
};

// Card Components
const Card = ({ children, className = "", onClick }) => (
  <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`} onClick={onClick}>
    {children}
  </div>
);

const CardHeader = ({ children, className = "" }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ children, className = "" }) => (
  <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
);

const CardDescription = ({ children }) => (
  <p className="text-sm text-gray-500">{children}</p>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`px-4 pb-4 ${className}`}>
    {children}
  </div>
);

const CardFooter = ({ children, className = "" }) => (
  <div className={`px-4 py-3 bg-gray-50 border-t ${className}`}>
    {children}
  </div>
);

const StudentManagementSystem = () => {
  // State for managing the application data
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Database state
  const [database, setDatabase] = useState({
    classes: {},
    students: {},
    schedules: {},
    comments: {
      classes: {},
      students: {}
    }
  });
  
  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [commentText, setCommentText] = useState('');
  
  // Grade collapsible sections state
  const [expandedGrades, setExpandedGrades] = useState({});
  
  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    studentsPerGrade: {}
  });

  // Grouping data
  const [classesByGrade, setClassesByGrade] = useState({});
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [gradesList, setGradesList] = useState([]);

  // Process the Excel file and extract data
  const processExcelFile = (arrayBuffer) => {
    try {
      // Parse the Excel file
      const workbook = XLSX.read(arrayBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });
      
      const newDatabase = {
        classes: {},
        students: {},
        schedules: {},
        comments: {
          classes: {},
          students: {}
        }
      };

      // Looking for important sheets
      const dayScheduleSheets = workbook.SheetNames.filter(name => 
        name.includes('MonFri') || 
        name.includes('MonWed') || 
        name.includes('TueThu') || 
        name.includes('WedFri') || 
        name === '2025 Kindy'
      );

      // Grade-specific sheets (G1, G2, etc.)
      const gradeSheets = workbook.SheetNames.filter(name => 
        /^G\d+/.test(name) || name === 'G8 (중2)'
      );
      
      // Function to extract students from grade sheets
      const processGradeSheet = (sheetName) => {
        if (workbook.SheetNames.includes(sheetName)) {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
          
          // Skip empty sheets
          if (data.length < 2) return;
          
          // Grade number from sheet name
          const gradeMatch = sheetName.match(/G(\d+)/);
          const gradeNumber = gradeMatch ? gradeMatch[1] : sheetName.includes('Kindy') ? 'K' : '';
          
          // Find the header row
          const headerRowIndex = data.findIndex(row => 
            row && 
            row.length > 1 && 
            row[0] === 'Class/Level/Time' && 
            row[1] === 'Name '
          );
          
          if (headerRowIndex === -1) {
            // Try alternative header format for Kindy
            if (sheetName.includes('Kindy')) {
              for (let i = 0; i < data.length; i++) {
                if (data[i] && data[i].length > 1 && 
                    data[i][0] === 'Class' && data[i][1] === 'Name') {
                  // Process Kindy data from row i
                  processKindyData(data, i, newDatabase);
                  break;
                }
              }
            }
            return;
          }
          
          // Define header columns
          const headers = data[headerRowIndex];
          
          // Process student rows
          for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;
            
            // Get class information and student name
            const classInfo = row[0];
            const studentName = row[1];
            
            if (!studentName || typeof studentName !== 'string' || studentName.trim() === '') continue;
            
            // Parse student name
            const nameParts = studentName.split(' ');
            let englishName = nameParts[0];
            let koreanName = nameParts.slice(1).join(' ');
            
            // Handle special marks in the name
            const hasF = studentName.includes(' F');
            if (hasF) {
              koreanName = koreanName.replace(' F', '');
            }
            
            const studentId = `${englishName}-${koreanName}`;
            
            // Process class information if available
            if (classInfo && typeof classInfo === 'string' && classInfo.match(/\d+[AEHRTP]/)) {
              const parts = classInfo.split('\n');
              if (parts.length < 1) continue;
              
              const levelMatch = parts[0].match(/(\d+)([AEHRTP])/);
              if (!levelMatch) continue;
              
              const grade = levelMatch[1];
              const levelCode = levelMatch[2];
              const className = parts.length > 1 ? parts[1] : '';
              
              // Create class ID
              const classId = `${grade}${levelCode} ${className}`;
              
              // If class doesn't exist yet, create it
              if (!newDatabase.classes[classId] && className) {
                newDatabase.classes[classId] = {
                  id: classId,
                  name: className,
                  grade: grade,
                  levelCode: levelCode,
                  level: `${grade}${levelCode}`,
                  levelName: levelMapping[levelCode] || levelCode,
                  fullLevelName: `Grade ${grade} ${levelMapping[levelCode] || levelCode}`,
                  additionalInfo: parts.length > 2 ? parts[2] : '',
                  schedule: parts.length > 3 ? parts[3] : '',
                  teachers: parts.length > 4 ? parts[4] : '',
                  students: []
                };
              }
              
              // If this is a valid class, add student to it
              if (className && newDatabase.classes[classId]) {
                // Add class to student
                if (!newDatabase.students[studentId]?.classes?.includes(classId)) {
                  if (!newDatabase.students[studentId]) {
                    newDatabase.students[studentId] = {
                      id: studentId,
                      englishName,
                      koreanName,
                      grade: gradeNumber,
                      classes: [classId],
                      notes: hasF ? 'F' : ''
                    };
                  } else {
                    newDatabase.students[studentId].classes.push(classId);
                    // Set grade if not already set
                    if (!newDatabase.students[studentId].grade) {
                      newDatabase.students[studentId].grade = gradeNumber;
                    }
                  }
                }
                
                // Add student to class
                if (!newDatabase.classes[classId].students.includes(studentId)) {
                  newDatabase.classes[classId].students.push(studentId);
                }
              }
            }
            
            // Add/update student information
            if (!newDatabase.students[studentId]) {
              newDatabase.students[studentId] = {
                id: studentId,
                englishName,
                koreanName,
                grade: gradeNumber,
                classes: [],
                notes: hasF ? 'F' : ''
              };
            }
            
            // Add additional student information from the row
            for (let c = 0; c < headers.length; c++) {
              const header = headers[c];
              if (!header || c >= row.length) continue;
              
              const value = row[c];
              if (value === null || value === undefined) continue;
              
              switch(header) {
                case 'Consent':
                  newDatabase.students[studentId].consent = value;
                  break;
                case 'Hold':
                  newDatabase.students[studentId].hold = value;
                  break;
                case 'Feedback\n1-5':
                  newDatabase.students[studentId].feedback1 = value;
                  break;
                case 'Feedback\n7-11':
                  newDatabase.students[studentId].feedback2 = value;
                  break;
                case 'Phone number ':
                  newDatabase.students[studentId].phoneNumber = value;
                  break;
                case 'email':
                  newDatabase.students[studentId].email = value;
                  break;
                case 'Start Date\nCOUNTER\n월/일 or 월-일\nONLY':
                  newDatabase.students[studentId].startDate = value;
                  break;
                case 'Other Details\n(lvl up, class transfer, etc.)':
                  newDatabase.students[studentId].otherDetails = value;
                  break;
                case '상담 내용\nDate/상담Type/Staff':
                  newDatabase.students[studentId].consultations = value;
                  break;
              }
            }
          }
        }
      };
      
      // Process Kindy data
      const processKindyData = (data, headerRowIndex, newDatabase) => {
        // Define header columns
        const headers = data[headerRowIndex];
        
        // Process student rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          
          // Get class information and student name
          const classInfo = row[0];
          const studentName = row[1];
          
          if (!studentName || typeof studentName !== 'string' || studentName.trim() === '') continue;
          
          // Parse student name
          const nameParts = studentName.split(' ');
          let englishName = nameParts[0];
          let koreanName = nameParts.slice(1).join(' ');
          
          // Handle special marks in the name
          const hasF = studentName.includes(' F');
          if (hasF) {
            koreanName = koreanName.replace(' F', '');
          }
          
          const studentId = `${englishName}-${koreanName}`;
          
          // Create a Kindy class ID
          let classId = 'Kindy';
          if (classInfo && typeof classInfo === 'string') {
            classId = `Kindy ${classInfo}`;
            
            // If class doesn't exist yet, create it
            if (!newDatabase.classes[classId]) {
              newDatabase.classes[classId] = {
                id: classId,
                name: classInfo,
                grade: 'K',
                level: 'Kindy',
                levelName: 'Kindergarten',
                fullLevelName: 'Kindergarten',
                students: []
              };
            }
          }
          
          // Create student if not exists
          if (!newDatabase.students[studentId]) {
            newDatabase.students[studentId] = {
              id: studentId,
              englishName,
              koreanName,
              grade: 'K',
              classes: [classId],
              notes: hasF ? 'F' : ''
            };
          } else {
            // Add class to student if not already there
            if (!newDatabase.students[studentId].classes.includes(classId)) {
              newDatabase.students[studentId].classes.push(classId);
            }
            
            // Set grade if not already set
            if (!newDatabase.students[studentId].grade) {
              newDatabase.students[studentId].grade = 'K';
            }
          }
          
          // Add student to class
          if (!newDatabase.classes[classId].students.includes(studentId)) {
            newDatabase.classes[classId].students.push(studentId);
          }
          
          // Add additional student information from the row
          for (let c = 0; c < headers.length; c++) {
            const header = headers[c];
            if (!header || c >= row.length) continue;
            
            const value = row[c];
            if (value === null || value === undefined) continue;
            
            // Process additional fields like phone, email, etc.
            // (similar to the other processing)
          }
        }
      };
      
      // Process grade sheets first (they have more detailed information)
      gradeSheets.forEach(sheetName => {
        processGradeSheet(sheetName);
      });
      
      // Process Kindy sheet if it exists
      if (workbook.SheetNames.includes('2025 Kindy')) {
        processGradeSheet('2025 Kindy');
      }
      
      // Process day schedule sheets for any additional class/student information
      dayScheduleSheets.forEach(sheetName => {
        if (workbook.SheetNames.includes(sheetName)) {
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
          
          // Skip empty sheets
          if (data.length < 3) return;
          
          // Get header row with class names (row 0) and time row (row 1)
          const classRow = data.find(row => row && row.length > 1 && row[0] === 'Class');
          if (!classRow) return;
          
          const timeRow = data.find(row => row && row.length > 1 && row[0] === 'Time');
          const teacherRow = data.find(row => row && row.length > 1 && row[0] === 'Teacher');
          
          if (!classRow || !timeRow || !teacherRow) return;
          
          // Process each class column
          for (let j = 1; j < classRow.length; j++) {
            const classInfo = classRow[j];
            if (!classInfo || typeof classInfo !== 'string') continue;
            
            // Parse class information
            const parts = classInfo.split('\n');
            if (parts.length < 1) continue;
            
            let gradeNumber = '';
            let levelCode = '';
            let className = '';
            
            // Handle Kindy classes differently
            if (sheetName === '2025 Kindy') {
              className = parts[0];
              gradeNumber = 'K';
              levelCode = 'K';
            } else {
              // Extract grade and level
              const levelMatch = parts[0].match(/(\d+)([AEHRTP])/);
              if (!levelMatch) continue;
              
              gradeNumber = levelMatch[1];
              levelCode = levelMatch[2];
              className = parts.length > 1 ? parts[1] : `Class ${j}`;
            }
            
            const additionalInfo = parts.length > 2 ? parts[2] : '';
            const schedule = timeRow[j] || '';
            const teachers = teacherRow[j] || '';
            
            // Create class ID
            const classId = gradeNumber === 'K' 
              ? `Kindy ${className}`
              : `${gradeNumber}${levelCode} ${className}`;
            
            // Add to database or update existing class
            if (!newDatabase.classes[classId]) {
              newDatabase.classes[classId] = {
                id: classId,
                name: className,
                grade: gradeNumber,
                levelCode: levelCode,
                level: gradeNumber === 'K' ? 'Kindy' : `${gradeNumber}${levelCode}`,
                levelName: gradeNumber === 'K' ? 'Kindergarten' : (levelMapping[levelCode] || levelCode),
                fullLevelName: gradeNumber === 'K' ? 'Kindergarten' : `Grade ${gradeNumber} ${levelMapping[levelCode] || levelCode}`,
                additionalInfo: additionalInfo,
                schedule: schedule,
                teachers: teachers,
                students: []
              };
            } else {
              // Update existing class with any new information
              newDatabase.classes[classId] = {
                ...newDatabase.classes[classId],
                schedule: newDatabase.classes[classId].schedule || schedule,
                teachers: newDatabase.classes[classId].teachers || teachers,
                additionalInfo: newDatabase.classes[classId].additionalInfo || additionalInfo
              };
            }
            
            // Find student rows (starting after the teacher row)
            const teacherRowIndex = data.findIndex(row => row && row.length > 1 && row[0] === 'Teacher');
            if (teacherRowIndex === -1) continue;
            
            // Look for student data after the teacher row
            for (let i = teacherRowIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length <= j) continue;
              
              const studentName = row[j];
              if (!studentName || typeof studentName !== 'string' || studentName.trim() === '') continue;
              
              // Parse student name (format is typically "English Name Korean Name")
              const nameParts = studentName.split(' ');
              let englishName = nameParts[0];
              let koreanName = nameParts.slice(1).join(' ');
              
              // Handle special marks in the name
              const hasF = studentName.includes(' F');
              if (hasF) {
                koreanName = koreanName.replace(' F', '');
              }
              
              const studentId = `${englishName}-${koreanName}`;
              
              // Create student if not exists
              if (!newDatabase.students[studentId]) {
                newDatabase.students[studentId] = {
                  id: studentId,
                  englishName,
                  koreanName,
                  grade: gradeNumber,
                  classes: [],
                  notes: hasF ? 'F' : ''
                };
              }
              
              // Add class to student
              if (!newDatabase.students[studentId].classes.includes(classId)) {
                newDatabase.students[studentId].classes.push(classId);
              }
              
              // Add student to class
              if (!newDatabase.classes[classId].students.includes(studentId)) {
                newDatabase.classes[classId].students.push(studentId);
              }
            }
          }
        }
      });
      
      // Calculate statistics
      const totalStudents = Object.keys(newDatabase.students).length;
      const totalClasses = Object.keys(newDatabase.classes).length;
      
      // Calculate students per grade
      const studentsPerGrade = {};
      
      // First count by direct grade assignment
      Object.values(newDatabase.students).forEach(student => {
        if (student.grade) {
          const grade = student.grade;
          if (!studentsPerGrade[grade]) {
            studentsPerGrade[grade] = 0;
          }
          studentsPerGrade[grade]++;
        }
      });
      
      // Group classes by grade
      const byGrade = {};
      const grades = new Set();
      
      // Process classes
      Object.values(newDatabase.classes).forEach(classInfo => {
        if (classInfo.grade) {
          const grade = classInfo.grade;
          grades.add(grade);
          
          if (!byGrade[grade]) {
            byGrade[grade] = {
              classes: [],
              students: []
            };
          }
          
          byGrade[grade].classes.push(classInfo);
        }
      });
      
      // Sort classes within each grade
      Object.keys(byGrade).forEach(grade => {
        byGrade[grade].classes.sort((a, b) => {
          // First sort by level code
          if (a.levelCode !== b.levelCode) {
            // Custom sort order for level codes
            const levelOrder = { 'R': 1, 'T': 2, 'H': 3, 'A': 4, 'E': 5 };
            return (levelOrder[a.levelCode] || 99) - (levelOrder[b.levelCode] || 99);
          }
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
      });
      
      // Process students - assign them to grades based on their classes
      Object.values(newDatabase.students).forEach(student => {
        // Find all grades this student belongs to
        const studentGrades = new Set();
        
        if (student.grade) {
          studentGrades.add(student.grade);
        }
        
        if (student.classes && student.classes.length > 0) {
          student.classes.forEach(classId => {
            const classInfo = newDatabase.classes[classId];
            if (classInfo && classInfo.grade) {
              studentGrades.add(classInfo.grade);
            }
          });
        }
        
        // Add student to each grade they belong to
        studentGrades.forEach(grade => {
          if (byGrade[grade]) {
            byGrade[grade].students.push(student);
          }
        });
        
        // If student doesn't belong to any grade, add to "Unassigned"
        if (studentGrades.size === 0) {
          if (!byGrade['Unassigned']) {
            byGrade['Unassigned'] = {
              classes: [],
              students: []
            };
            grades.add('Unassigned');
          }
          
          byGrade['Unassigned'].students.push(student);
        }
      });
      
      // Sort students within each grade
      Object.keys(byGrade).forEach(grade => {
        byGrade[grade].students.sort((a, b) => {
          return a.englishName.localeCompare(b.englishName);
        });
      });
      
      // Sort grades with Kindy first, then numeric grades, then Unassigned
      const sortedGrades = Array.from(grades).sort((a, b) => {
        if (a === 'K') return -1;
        if (b === 'K') return 1;
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return parseInt(a) - parseInt(b);
      });
      
      // Initialize expanded state for each grade
      const initialExpandedState = {};
      sortedGrades.forEach(grade => {
        initialExpandedState[grade] = true; // Start with all expanded
      });
      
      return {
        database: newDatabase,
        classesByGrade: byGrade,
        studentsByGrade: byGrade,
        gradesList: sortedGrades,
        expandedGrades: initialExpandedState,
        stats: {
          totalStudents,
          totalClasses,
          studentsPerGrade
        }
      };
    } catch (err) {
      console.error("Error processing Excel file:", err);
      throw new Error(`Error processing file: ${err.message}`);
    }
  };

  // Function to save a comment
  const saveComment = (type, id) => {
    if (!commentText.trim()) return;
    
    // Determine if this is a new comment or appending to existing
    const existingComment = type === 'class' 
      ? database.comments.classes[id] || ''
      : database.comments.students[id] || '';
    
    const newComment = existingComment 
      ? `${existingComment}\n\n${new Date().toLocaleString()}: ${commentText}`
      : `${new Date().toLocaleString()}: ${commentText}`;
    
    setDatabase(prevState => {
      const updatedComments = { ...prevState.comments };
      
      if (type === 'class') {
        updatedComments.classes[id] = newComment;
      } else if (type === 'student') {
        updatedComments.students[id] = newComment;
      }
      
      return {
        ...prevState,
        comments: updatedComments
      };
    });
    
    // Save to localStorage
    saveToLocalStorage({
      ...database,
      comments: {
        classes: {
          ...database.comments.classes,
          [id]: newComment
        },
        students: {
          ...database.comments.students
        }
      }
    });
    
    // Clear comment field
    setCommentText('');
  };
  
  // Function to get current comment
  const getCurrentComment = (type, id) => {
    if (type === 'class') {
      return database.comments.classes[id] || '';
    } else if (type === 'student') {
      return database.comments.students[id] || '';
    }
    return '';
  };

  // Function to handle file upload (for web app)
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Only process Excel files
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = processExcelFile(arrayBuffer);
        
        setDatabase(result.database);
        setClassesByGrade(result.classesByGrade);
        setStudentsByGrade(result.studentsByGrade);
        setGradesList(result.gradesList);
        setExpandedGrades(result.expandedGrades);
        setStats(result.stats);
        
        // Save processed data to localStorage for persistence
        saveToLocalStorage(result.database);
        
        setFileUploaded(true);
        setIsLoading(false);
      } else {
        setError("Please upload an Excel file (.xlsx or .xls)");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      setError(`Error uploading file: ${err.message}`);
      setIsLoading(false);
      
      // Load mock data as fallback
      loadMockData();
    }
  };
  
  // Save data to localStorage
  const saveToLocalStorage = (data) => {
    try {
      localStorage.setItem('studentManagementData', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      // Fallback for large data: just save comments
      try {
        localStorage.setItem('studentManagementComments', JSON.stringify(data.comments));
      } catch (error) {
        console.error('Error saving comments to localStorage:', error);
      }
    }
  };
  
  // Load data from localStorage
  const loadFromLocalStorage = () => {
    try {
      const savedData = localStorage.getItem('studentManagementData');
      if (savedData) {
        return JSON.parse(savedData);
      }
      
      // If full data not found, check for comments
      const savedComments = localStorage.getItem('studentManagementComments');
      if (savedComments) {
        return { comments: JSON.parse(savedComments) };
      }
      
      return null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  };
  
  // Helper function to load mock data when Excel processing fails
  const loadMockData = () => {
    // Create mock data structure similar to what we'd get from the Excel file
    const mockGrades = ['K', '1', '2', '3', '4', '5', '6', 'Unassigned'];
    const mockLevels = ['R', 'T', 'H', 'A', 'E'];
    const mockClasses = {};
    const mockStudents = {};
    const mockComments = { classes: {}, students: {} };
    const mockClassesByGrade = {};
    
    // Create expanded state
    const mockExpandedGrades = {};
    mockGrades.forEach(grade => {
      mockExpandedGrades[grade] = true;
      mockClassesByGrade[grade] = { classes: [], students: [] };
    });
    
    // Create classes
    mockGrades.forEach(grade => {
      if (grade === 'Unassigned') return;
      
      // Special case for Kindy
      if (grade === 'K') {
        ['Yellow', 'Blue', 'Red', 'Green'].forEach((className, idx) => {
          const classId = `Kindy ${className}`;
          mockClasses[classId] = {
            id: classId,
            name: className,
            grade: 'K',
            level: 'Kindy',
            levelName: 'Kindergarten',
            fullLevelName: 'Kindergarten',
            teachers: `Teacher ${idx + 1}`,
            schedule: `M-F ${9 + idx}:00-${10 + idx}:00`,
            students: []
          };
          mockClassesByGrade['K'].classes.push(mockClasses[classId]);
        });
      } else {
        // Regular grades
        mockLevels.forEach((level, idx) => {
          const className = ['Stars', 'Galaxy', 'Moon', 'Planets', 'Rainbow'][idx % 5];
          const classId = `${grade}${level} ${className}`;
          mockClasses[classId] = {
            id: classId,
            name: className,
            grade: grade,
            levelCode: level,
            level: `${grade}${level}`,
            levelName: levelMapping[level],
            fullLevelName: `Grade ${grade} ${levelMapping[level]}`,
            teachers: `Teacher ${idx + 1}`,
            schedule: `M-F ${9 + idx}:00-${10 + idx}:00`,
            students: []
          };
          mockClassesByGrade[grade].classes.push(mockClasses[classId]);
        });
      }
    });
    
    // Create students
    const firstNames = ['Emma', 'Noah', 'Olivia', 'Liam', 'Sophia', 'Jackson', 'Ava', 'Aiden', 'Isabella', 'Lucas'];
    const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
    let studentCounter = 0;
    
    mockGrades.forEach(grade => {
      if (grade === 'Unassigned') return;
      
      // Number of students per grade
      const studentCount = grade === 'K' ? 40 : 30;
      
      for (let i = 0; i < studentCount; i++) {
        const firstName = firstNames[studentCounter % firstNames.length];
        const lastName = lastNames[studentCounter % lastNames.length];
        const koreanName = `${lastName}${studentCounter % 100}`;
        const studentId = `${firstName}-${koreanName}`;
        
        // Assign to a class
        let classId;
        if (grade === 'K') {
          const kindyClass = mockClassesByGrade['K'].classes[i % mockClassesByGrade['K'].classes.length];
          classId = kindyClass.id;
        } else {
          const gradeClass = mockClassesByGrade[grade].classes[i % mockClassesByGrade[grade].classes.length];
          classId = gradeClass.id;
        }
        
        mockStudents[studentId] = {
          id: studentId,
          englishName: firstName,
          koreanName: koreanName,
          grade: grade,
          classes: [classId],
          notes: i % 10 === 0 ? 'F' : ''
        };
        
        // Add student to class
        mockClasses[classId].students.push(studentId);
        
        // Add student to grade
        mockClassesByGrade[grade].students.push(mockStudents[studentId]);
        
        studentCounter++;
      }
    });
    
    // Add some comments
    for (let i = 0; i < 10; i++) {
      const randomClassId = Object.keys(mockClasses)[Math.floor(Math.random() * Object.keys(mockClasses).length)];
      mockComments.classes[randomClassId] = `${new Date().toLocaleString()}: Sample class comment ${i + 1}`;
      
      const randomStudentId = Object.keys(mockStudents)[Math.floor(Math.random() * Object.keys(mockStudents).length)];
      mockComments.students[randomStudentId] = `${new Date().toLocaleString()}: Sample student comment ${i + 1}`;
    }
    
    // Calculate statistics
    const totalStudents = Object.keys(mockStudents).length;
    const totalClasses = Object.keys(mockClasses).length;
    
    // Calculate students per grade
    const studentsPerGrade = {};
    mockGrades.forEach(grade => {
      if (grade === 'Unassigned') return;
      studentsPerGrade[grade] = mockClassesByGrade[grade].students.length;
    });
    
    // Update state with mock data
    setDatabase({
      classes: mockClasses,
      students: mockStudents,
      comments: mockComments
    });
    setClassesByGrade(mockClassesByGrade);
    setStudentsByGrade(mockClassesByGrade);
    setGradesList(mockGrades);
    setExpandedGrades(mockExpandedGrades);
    setStats({
      totalStudents,
      totalClasses,
      studentsPerGrade
    });
    
    setIsLoading(false);
    setError('Demo mode: Using sample data');
  };
  
  // Load data from localStorage on initial mount
  useEffect(() => {
    const loadInitialData = () => {
      // Try to load from localStorage first
      const savedData = loadFromLocalStorage();
      
      if (savedData && Object.keys(savedData).length > 0) {
        // We have data from localStorage
        if (savedData.classes && Object.keys(savedData.classes).length > 0) {
          // Full data available
          setDatabase(savedData);
          
          // Process data into grades
          const result = processExcelFile(null, savedData);
          setClassesByGrade(result.classesByGrade);
          setStudentsByGrade(result.studentsByGrade);
          setGradesList(result.gradesList);
          setExpandedGrades(result.expandedGrades);
          setStats(result.stats);
          
          setFileUploaded(true);
          setIsLoading(false);
        } else if (savedData.comments) {
          // Only comments available, load mock data and apply comments
          loadMockData();
          setDatabase(prevState => ({
            ...prevState,
            comments: savedData.comments
          }));
        } else {
          // Invalid data, load mock data
          loadMockData();
        }
      } else {
        // No saved data, show empty state
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Effect to filter students based on search
  useEffect(() => {
    if (!isLoading && Object.keys(database.students).length > 0) {
      const filtered = Object.values(database.students).filter(student => {
        const nameMatch = 
          student.englishName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.koreanName?.toLowerCase().includes(searchTerm.toLowerCase());
          
        const classMatch = 
          classFilter === 'all' || 
          (student.classes && student.classes.includes(classFilter));
          
        return nameMatch && classMatch;
      });
      
      setFilteredStudents(filtered);
    }
  }, [searchTerm, classFilter, database.students, isLoading]);
  
  // Toggle expansion of a grade section
  const toggleGradeExpansion = (grade) => {
    setExpandedGrades(prev => ({
      ...prev,
      [grade]: !prev[grade]
    }));
  };
  
  // Handle class selection
  const handleClassSelect = (classId) => {
    setSelectedClass(classId);
    setSelectedStudent(null);
    setActiveTab('class-details');
    
    // Load the class comment
    const comment = getCurrentComment('class', classId);
    setCommentText(comment);
  };
  
  // Handle student selection
  const handleStudentSelect = (studentId) => {
    setSelectedStudent(studentId);
    setSelectedClass(null);
    setActiveTab('student-details');
    
    // Load the student comment
    const comment = getCurrentComment('student', studentId);
    setCommentText(comment);
  };

  // Export data function
  const exportData = () => {
    try {
      // Create a blob with the JSON data
      const dataStr = JSON.stringify(database);
      const blob = new Blob([dataStr], { type: 'application/json' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student-management-data.json';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data: ' + error.message);
    }
  };
  
  // Import data function
  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      if (importedData && importedData.classes && importedData.students) {
        setDatabase(importedData);
        
        // Re-process the data
        const result = processExcelFile(null, importedData);
        setClassesByGrade(result.classesByGrade);
        setStudentsByGrade(result.studentsByGrade);
        setGradesList(result.gradesList);
        setExpandedGrades(result.expandedGrades);
        setStats(result.stats);
        
        saveToLocalStorage(importedData);
        
        setFileUploaded(true);
        setError(null);
      } else {
        setError('Invalid import file format');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      setError('Failed to import data: ' + error.message);
    }
  };

  // File upload area component
  const FileUploadArea = () => (
    <div className="flex flex-col items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12">
      <FileSpreadsheet className="h-16 w-16 text-gray-400 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Import Excel File</h2>
      <p className="text-gray-600 mb-6 text-center max-w-md">
        Upload your Excel file to get started. The system will organize all students and classes for easy access.
      </p>
      <input
        type="file"
        id="excel-upload-main"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />
      <label 
        htmlFor="excel-upload-main"
        className="hover:bg-gray-700 bg-gray-600 text-white px-4 py-2 rounded cursor-pointer inline-block mb-4"
      >
        <Upload className="w-4 h-4 mr-2 inline-block" />
        Choose Excel File
      </label>
      <p className="text-gray-500 text-sm">
        Or, try the app with <button 
          onClick={loadMockData} 
          className="text-blue-500 hover:underline"
        >
          sample data
        </button>
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data from Excel file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="p-4 flex items-center justify-between bg-white border-b shadow-sm">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
            <span className="text-gray-600 font-bold text-lg">t.</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            Student Management System
          </h1>
        </div>
        <div className="text-xl font-semibold">
          <span className="text-gray-600">twin</span>
          <span className="text-gray-700">.kle</span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-gray-100 border-r p-4 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <FileSpreadsheet className="w-5 h-5 mr-2" />
              Data Management
            </h2>
            <div className="mt-2 space-y-2">
              <input
                type="file"
                id="excel-upload"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label 
                htmlFor="excel-upload"
                className="text-white px-3 py-2 rounded cursor-pointer inline-block bg-gray-600 hover:bg-gray-700 w-full text-center text-sm"
              >
                <Upload className="w-4 h-4 mr-1 inline-block" />
                Import Excel File
              </label>
              
              <div className="flex space-x-2">
                <button
                  onClick={exportData}
                  className="text-xs px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white flex-1 text-center"
                >
                  Export Data
                </button>
                
                <input
                  type="file"
                  id="json-upload"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
                <label 
                  htmlFor="json-upload"
                  className="text-xs px-3 py-2 rounded bg-green-500 hover:bg-green-600 text-white flex-1 text-center cursor-pointer"
                >
                  Import Data
                </label>
              </div>
              
              {fileUploaded && (
                <div className="text-green-600 flex items-center">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full w-full text-center">
                    Data Loaded Successfully
                  </span>
                </div>
              )}
              
              {error && (
                <div className="text-red-600 text-xs mt-1">
                  Note: {error}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center">
              <List className="w-5 h-5 mr-2" />
              Navigation
            </h2>
            <ul className="space-y-1">
              <li>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left px-3 py-2 rounded ${
                    activeTab === 'dashboard' 
                    ? 'bg-gray-200 text-gray-800' 
                    : 'hover:bg-gray-100'}`}
                >
                  Dashboard
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab('classes')}
                  className={`w-full text-left px-3 py-2 rounded ${
                    activeTab === 'classes' || activeTab === 'class-details'
                    ? 'bg-gray-200 text-gray-800' 
                    : 'hover:bg-gray-100'}`}
                >
                  Class List
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab('students')}
                  className={`w-full text-left px-3 py-2 rounded ${
                    activeTab === 'students' || activeTab === 'student-details'
                    ? 'bg-gray-200 text-gray-800' 
                    : 'hover:bg-gray-100'}`}
                >
                  Student List
                </button>
              </li>
            </ul>
          </div>
          
          {(activeTab === 'students' || activeTab === 'student-details') && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Student Search
              </h2>
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-2"
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="all">All Classes</option>
                {Object.keys(database.classes).map(classId => (
                  <option key={classId} value={classId}>
                    {database.classes[classId].name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!fileUploaded && !Object.keys(database.classes).length ? (
            <FileUploadArea />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <>
                  <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card>
                      <CardHeader className="bg-gray-100">
                        <CardTitle className="text-gray-700 flex items-center">
                          <User className="mr-2 h-5 w-5" />
                          Total Students
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-3xl font-bold">{stats.totalStudents}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="bg-gray-100">
                        <CardTitle className="text-gray-700 flex items-center">
                          <Users className="mr-2 h-5 w-5" />
                          Total Classes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-3xl font-bold">{stats.totalClasses}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="bg-gray-100">
                        <CardTitle className="text-gray-700 flex items-center">
                          <BarChart className="mr-2 h-5 w-5" />
                          Grade with Most Students
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <p className="text-3xl font-bold">
                          {Object.entries(stats.studentsPerGrade).length > 0 ? 
                            Object.entries(stats.studentsPerGrade).reduce(
                              (max, [grade, count]) => (count > (max[1] || 0) ? [grade, count] : max), 
                              ['-', 0]
                            )[0] : '-'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Students by Grade Level</CardTitle>
                      <CardDescription>
                        Distribution of students across different grade levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {Object.entries(stats.studentsPerGrade).map(([grade, count]) => (
                          <div key={grade} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {grade === 'K' ? 'Kindergarten' : `Grade ${grade}`}
                              </span>
                              <span className="text-sm font-medium">{count} students</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="h-2.5 rounded-full bg-gray-500" 
                                style={{ 
                                  width: `${(count / (stats.totalStudents || 1)) * 100}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              
              {activeTab === 'classes' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Class List</h1>
                    <div className="text-sm text-gray-500">
                      {stats.totalClasses} classes in {gradesList.length} grades
                    </div>
                  </div>
                  
                  {/* Classes organized by grade */}
                  {gradesList.map(grade => (
                    <CollapsibleSection
                      key={grade}
                      title={grade === 'K' ? 'Kindergarten' : 
                             grade === 'Unassigned' ? 'Unassigned Classes' : 
                             `Grade ${grade}`}
                      count={classesByGrade[grade]?.classes.length || 0}
                      isOpen={expandedGrades[grade]}
                      onToggle={() => toggleGradeExpansion(grade)}
                      icon={<GraduationCap size={18} />}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {classesByGrade[grade]?.classes.map(classInfo => (
                          <Card 
                            key={classInfo.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleClassSelect(classInfo.id)}
                          >
                            <CardHeader className="pb-2">
                              <CardTitle>{classInfo.name}</CardTitle>
                              <CardDescription>
                                {classInfo.fullLevelName ? `${classInfo.fullLevelName}` : (classInfo.level && `Level: ${classInfo.level}`)}
                                {classInfo.teachers && ` • Teacher: ${classInfo.teachers}`}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                              <p className="text-sm">
                                {classInfo.students ? `${classInfo.students.length} students` : 'No students'}
                              </p>
                            </CardContent>
                            <CardFooter className="text-xs text-gray-500 pt-0">
                              {database.comments.classes[classInfo.id] ? 
                                <div className="flex items-center">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Has comments
                                </div> : 
                                'No comments'
                              }
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleSection>
                  ))}
                </>
              )}
              
              {activeTab === 'students' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Student List</h1>
                    <div className="text-sm text-gray-500">
                      {filteredStudents.length} students found
                    </div>
                  </div>
                  
                  {searchTerm || classFilter !== 'all' ? (
                    // Search results mode - show flat list
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              English Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Korean Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Classes
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Notes
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Comments
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                No students found matching your search criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map(student => (
                              <tr 
                                key={student.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleStudentSelect(student.id)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {student.englishName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {student.koreanName}
                                </td>
                                <td className="px-6 py-4">
                                  {student.classes && student.classes.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {student.classes.map(classId => database.classes[classId] && (
                                        <span 
                                          key={classId} 
                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white bg-gray-600"
                                        >
                                          {database.classes[classId].name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">None</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {student.notes || <span className="text-gray-400">None</span>}
                                </td>
                                <td className="px-6 py-4">
                                  {database.comments.students[student.id] ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                      Has comments
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">None</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Grade-organized mode - show collapsible sections
                    <div>
                      {gradesList.map(grade => (
                        <CollapsibleSection
                          key={grade}
                          title={grade === 'K' ? 'Kindergarten' : 
                                 grade === 'Unassigned' ? 'Unassigned Students' : 
                                 `Grade ${grade}`}
                          count={studentsByGrade[grade]?.students.length || 0}
                          isOpen={expandedGrades[grade]}
                          onToggle={() => toggleGradeExpansion(grade)}
                          icon={<User size={18} />}
                        >
                          <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    English Name
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Korean Name
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Classes
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Notes
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Comments
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {studentsByGrade[grade]?.students.map(student => (
                                  <tr 
                                    key={student.id}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleStudentSelect(student.id)}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {student.englishName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {student.koreanName}
                                    </td>
                                    <td className="px-6 py-4">
                                      {student.classes && student.classes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {student.classes.map(classId => database.classes[classId] && (
                                            <span 
                                              key={classId} 
                                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white bg-gray-600"
                                            >
                                              {database.classes[classId].name}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">None</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">
                                      {student.notes || <span className="text-gray-400">None</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                      {database.comments.students[student.id] ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Has comments
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">None</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CollapsibleSection>
                      ))}
                    </div>
                  )}
                </>
              )}
              
              {activeTab === 'class-details' && selectedClass && database.classes[selectedClass] && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">{database.classes[selectedClass].name}</h1>
                    <button
                      onClick={() => setActiveTab('classes')}
                      className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Back to Class List
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Class Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="space-y-2">
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Level:</dt>
                            <dd>
                              {database.classes[selectedClass].fullLevelName || 
                               database.classes[selectedClass].level || 
                               'Not specified'}
                            </dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Teachers:</dt>
                            <dd>
                              {database.classes[selectedClass].teachers || 
                               database.classes[selectedClass].teacher || 
                               'Not specified'}
                            </dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Schedule:</dt>
                            <dd>
                              {typeof database.classes[selectedClass].schedule === 'string' ? 
                               database.classes[selectedClass].schedule : 
                               'Not specified'}
                            </dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Start Date:</dt>
                            <dd>
                              {typeof database.classes[selectedClass].additionalInfo === 'string' ? 
                               database.classes[selectedClass].additionalInfo : 
                               'Not specified'}
                            </dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Students:</dt>
                            <dd>{database.classes[selectedClass].students?.length || 0}</dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Class Comments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add comments about this class..."
                          className="w-full px-3 py-2 border rounded h-32 resize-none mb-4"
                        ></textarea>
                        
                        {database.comments.classes[selectedClass] && (
                          <div className="mt-4">
                            <h4 className="font-medium text-gray-700 mb-2">Saved Comments:</h4>
                            <div className="bg-gray-50 p-3 rounded border">
                              <p className="whitespace-pre-wrap">{database.comments.classes[selectedClass]}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <button
                          onClick={() => saveComment('class', selectedClass)}
                          className="flex items-center hover:bg-gray-700 bg-gray-600 text-white px-3 py-2 rounded"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Add Comment
                        </button>
                      </CardFooter>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Students in this Class</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {database.classes[selectedClass].students?.length > 0 ? (
                        <div className="bg-white rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  English Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Korean Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Notes
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Comments
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {database.classes[selectedClass].students.map(studentId => (
                                database.students[studentId] && (
                                  <tr 
                                    key={studentId}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleStudentSelect(studentId)}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {database.students[studentId].englishName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {database.students[studentId].koreanName}
                                    </td>
                                    <td className="px-6 py-4">
                                      {database.students[studentId].notes || <span className="text-gray-400">None</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                      {database.comments.students[studentId] ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Has comments
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">None</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No students in this class.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {activeTab === 'student-details' && selectedStudent && database.students[selectedStudent] && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">
                      {database.students[selectedStudent].englishName} ({database.students[selectedStudent].koreanName})
                    </h1>
                    <button
                      onClick={() => setActiveTab('students')}
                      className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Back to Student List
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Student Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="space-y-2">
                          <div className="flex">
                            <dt className="w-1/3 font-medium">English Name:</dt>
                            <dd>{database.students[selectedStudent].englishName}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Korean Name:</dt>
                            <dd>{database.students[selectedStudent].koreanName}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Grade:</dt>
                            <dd>
                              {database.students[selectedStudent].grade === 'K' ? 'Kindergarten' : 
                               database.students[selectedStudent].grade ? `Grade ${database.students[selectedStudent].grade}` : 
                               'Not assigned'}
                            </dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Consent:</dt>
                            <dd>{database.students[selectedStudent].consent || 'None'}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Hold Status:</dt>
                            <dd>{database.students[selectedStudent].hold || 'None'}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Contact:</dt>
                            <dd>{database.students[selectedStudent].phoneNumber || 'None'}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Email:</dt>
                            <dd>{database.students[selectedStudent].email || 'None'}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Start Date:</dt>
                            <dd>{typeof database.students[selectedStudent].startDate === 'string' ? 
                                database.students[selectedStudent].startDate : 'None'}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-1/3 font-medium">Notes:</dt>
                            <dd>{database.students[selectedStudent].notes || 'None'}</dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle>Student Comments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add comments about this student..."
                          className="w-full px-3 py-2 border rounded h-32 resize-none mb-4"
                        ></textarea>
                        
                        {database.comments.students[selectedStudent] && (
                          <div className="mt-4">
                            <h4 className="font-medium text-gray-700 mb-2">Saved Comments:</h4>
                            <div className="bg-gray-50 p-3 rounded border">
                              <p className="whitespace-pre-wrap">{database.comments.students[selectedStudent]}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <button
                          onClick={() => saveComment('student', selectedStudent)}
                          className="flex items-center hover:bg-gray-700 bg-gray-600 text-white px-3 py-2 rounded"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Add Comment
                        </button>
                      </CardFooter>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Classes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {database.students[selectedStudent].classes?.length > 0 ? (
                        <div className="space-y-4">
                          {database.students[selectedStudent].classes.map(classId => (
                            database.classes[classId] && (
                              <div 
                                key={classId}
                                className="p-4 bg-gray-50 rounded-lg flex justify-between items-center cursor-pointer"
                                onClick={() => handleClassSelect(classId)}
                              >
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg mb-1">{database.classes[classId].name}</h3>
                                  <div className="flex flex-wrap gap-x-6 text-sm text-gray-600">
                                    {database.classes[classId].level && (
                                      <span>Level: {database.classes[classId].level}</span>
                                    )}
                                    {database.classes[classId].teachers && (
                                      <span>Teacher: {database.classes[classId].teachers}</span>
                                    )}
                                    <span>
                                      {database.classes[classId].students?.length || 0} students
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">This student is not enrolled in any classes.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t p-4 text-center text-gray-700 text-sm flex items-center justify-center bg-gray-100">
        <div className="text-lg font-semibold">
          <span className="text-gray-600">twin</span>
          <span className="text-gray-700">.kle</span>
        </div>
        <span className="mx-2">•</span>
        <span>Student Management System • {new Date().getFullYear().toString()}</span>
      </footer>
    </div>
  );
};

export default StudentManagementSystem;
