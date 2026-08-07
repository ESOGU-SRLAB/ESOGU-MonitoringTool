import React from 'react';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <span>© {year} MATISSE IFARLAB-EDIH</span>
    </footer>
  );
}
