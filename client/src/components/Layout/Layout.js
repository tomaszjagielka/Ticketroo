import React from "react";
import Navbar from "./Navbar";

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />
      <div className="main-content">{children}</div>
    </>
  );
};

export default Layout;
