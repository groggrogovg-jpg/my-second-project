import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const savedTheme = window.localStorage.getItem("theme");
document.documentElement.classList.toggle("dark", savedTheme === "dark");
document.documentElement.setAttribute("data-theme", savedTheme === "dark" ? "dark" : "light");
document.documentElement.style.colorScheme = savedTheme === "dark" ? "dark" : "light";

createRoot(document.getElementById("root")!).render(<App />);
