import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SurfDiary from './components/SurfDiary';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/surf-diary" element={<SurfDiary />} />
      </Routes>
    </Router>
  );
}

export default App; 