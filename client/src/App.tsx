// import './App.css'
import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/auth/LoginPage";

function App() {
  return (
    <Routes>
      <Route path="/auth">
        <Route path="login" index element={<LoginPage/>} />
      </Route>
    </Routes>
  )
}
export default App