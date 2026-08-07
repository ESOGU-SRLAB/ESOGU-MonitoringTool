import React from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DigitalTwin from './pages/DigitalTwin';

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <DigitalTwin />
      </main>
      <Footer />
    </div>
  );
}
