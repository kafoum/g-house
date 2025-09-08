import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import HousingList from './pages/HousingList';
import HousingDetails from './pages/HousingDetails';
import Register from './pages/Register';
import Login from './pages/Login';
import CreateHousing from './pages/CreateHousing';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<HousingList />} />
          <Route path="/housing/:id" element={<HousingDetails />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-housing" element={<CreateHousing />} />
          <Route path="/dashboard" element={<Dashboard />} /> {/* Cette route est essentielle */}
          <Route path="/edit-housing/:id" element={<CreateHousing />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;