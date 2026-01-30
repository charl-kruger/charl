import { createRoot } from "react-dom/client";
import App from "./app";
import { HomePage } from "./pages/home-page";
import { Providers } from "@/providers";
import "./index.css";

const rootElement = document.getElementById("root") || document.getElementById("app");

if (rootElement) {
  const root = createRoot(rootElement);

  // Simple client-side routing
  const path = window.location.pathname;

  let component;
  if (path === "/" || path === "/index.html") {
    component = <HomePage />;
  } else if (path.startsWith("/agents/")) {
    component = <App />;
  } else {
    // Fallback/404 - could also be HomePage
    component = <HomePage />;
  }

  root.render(
    <Providers>
      {component}
    </Providers>
  );
}
