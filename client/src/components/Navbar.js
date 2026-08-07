import React from 'react';
import './Navbar.css';

export default function Navbar() {
  return (
    <header className="navbar">
      <a className="navbar-logo" href="/">
        <img src={`${process.env.PUBLIC_URL}/assets/logo/logo.svg`} alt="MATISSE" />
      </a>
      <a className="navbar-home" href="/">
        Home
      </a>
    </header>
  );
}
