import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NimbiApp } from "./app/NimbiApp";
import "./styles/tokens.css";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NimbiApp />
  </StrictMode>
);
