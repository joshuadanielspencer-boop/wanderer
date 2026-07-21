import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Wanderer from "./wanderer.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Wanderer />
  </React.StrictMode>
);
