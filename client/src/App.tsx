// import './App.css'
import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/auth/LoginPage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import MilkrunHomepage from "./pages/milkrun/MilkrunHomepage";

function App() {
  return (
    <Routes>
      /*
        Index route
       */
      <Route path="/">
        <Route path="login" index element={<LoginPage/>} />
      </Route>
      /**
        Authenticator route
       */
      <Route path="/auth">
        <Route path="login" index element={<LoginPage/>} />
      </Route>
      /**
        Admin route
       */
      <Route path="/admin">
        <Route index element={<AdminHomePage/>} />
      </Route>
      /**
        Milkrun route
       */
      <Route path="/milkrun">
        <Route index element={<MilkrunHomepage/>} />
      </Route>
    </Routes>
  )
}
export default App